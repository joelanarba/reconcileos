import hashlib
import re
from urllib.parse import unquote

from sqlalchemy import select, update

from app.core.config import WORKSPACE_ID
from app.core.errors import AppError
from app.core.time import parse_timestamp, utcnow
from app.models.entities import AuditEvent, ImportBatch, Order, Payment, Settlement, Workspace
from app.schemas.imports import ImportOptions
from app.services.imports.file_reader import SUPPORTED_EXTENSIONS, read_file
from app.services.imports.mapping import build_preview


def lock_workspace(session):
    session.execute(update(Workspace).where(Workspace.id == WORKSPACE_ID).values(write_revision=Workspace.write_revision + 1))
    return session.get(Workspace, WORKSPACE_ID, populate_existing=True)


def preview_batch(session, settings, source_type: str, filename: str, content: bytes):
    if len(content) > settings.max_upload_bytes:
        raise AppError("file_too_large", "Files may not exceed 10 MiB.", 413)
    display_name = unquote(filename).replace("\\", "/").split("/")[-1]
    display_name = re.sub(r"[\x00-\x1f\x7f]", "", display_name)[:160]
    if not display_name.lower().endswith(SUPPORTED_EXTENSIONS):
        raise AppError("invalid_filename", "Upload a CSV, TSV, XLSX, or XLS transaction file.")
    checksum = hashlib.sha256(content).hexdigest()
    document = read_file(content, display_name, settings.max_import_rows)
    preview = build_preview(document, source_type, ImportOptions(), settings.max_import_rows, infer_defaults=True)
    invalid = sum(bool(record["errors"]) and not record.get("excluded") for record in preview["rows"])
    preview["import_info"]["revision"] = 1
    with session.begin():
        lock_workspace(session)
        existing = session.scalar(select(ImportBatch).where(ImportBatch.workspace_id == WORKSPACE_ID, ImportBatch.source_type == source_type, ImportBatch.checksum == checksum))
        if existing:
            if existing.status != "confirmed" and not existing.preview.get("import_info"):
                existing.preview = preview
                existing.total_rows = len(preview["rows"])
                existing.invalid_rows = invalid
                existing.valid_rows = existing.total_rows - invalid
                existing.status = "invalid" if invalid else "previewed"
                session.flush()
            return existing
        batch = ImportBatch(workspace_id=WORKSPACE_ID, source_type=source_type, filename=display_name, checksum=checksum,
                            status="invalid" if invalid else "previewed", total_rows=len(preview["rows"]), valid_rows=len(preview["rows"]) - invalid, invalid_rows=invalid, preview=preview)
        session.add(batch)
        session.flush()
        return batch


def remap_batch(session, settings, batch_id: str, options: ImportOptions, actor: str):
    with session.begin():
        lock_workspace(session)
        batch = session.scalar(select(ImportBatch).where(ImportBatch.id == batch_id, ImportBatch.workspace_id == WORKSPACE_ID))
        if not batch:
            raise AppError("not_found", "Import batch was not found.", 404)
        if batch.status == "confirmed":
            raise AppError("already_confirmed", "Confirmed source records cannot be changed. Start a new import for different data.", 409)
        previous = batch.preview.get("import_info", {})
        revision = previous.get("revision", 1)
        if options.expected_revision is not None and options.expected_revision != revision:
            raise AppError("stale_preview", "This preview changed in another window. Refresh it before applying corrections.", 409)
        document = batch.preview.get("_source")
        if document is None:
            columns = batch.preview["columns"]
            document = {"format": "CSV", "encoding": "utf-8-sig", "delimiter": ",", "tables": [{"name": "CSV", "rows": [{"source_row": 1, "cells": columns}] + [{"source_row": row["source_row"], "cells": [row["raw"].get(column, "") for column in columns]} for row in batch.preview["rows"]], "formulas": {}, "numeric_cells": []}]}
        updated = build_preview(document, batch.source_type, options, settings.max_import_rows)
        updated["import_info"]["revision"] = revision + 1
        updated["interpretation_history"] = batch.preview.get("interpretation_history", []) + [{"revision": revision, "options": previous.get("options", {}), "actor": actor, "changed_at": utcnow().isoformat()}]
        if len(updated["interpretation_history"]) > 50:
            raise AppError("preview_revision_limit", "This preview has reached its revision limit. Upload a corrected source file.", 409)
        batch.preview = updated
        batch.total_rows = len(updated["rows"])
        batch.invalid_rows = sum(bool(row["errors"]) and not row.get("excluded") for row in updated["rows"])
        batch.valid_rows = sum(not row["errors"] and not row.get("excluded") for row in updated["rows"])
        batch.status = "invalid" if batch.invalid_rows or not batch.valid_rows else "previewed"
        session.flush()
        return batch


def confirm_batch(session, batch_id: str, actor: str, expected_revision: int | None = None):
    with session.begin():
        workspace = lock_workspace(session)
        batch = session.scalar(select(ImportBatch).where(ImportBatch.id == batch_id, ImportBatch.workspace_id == WORKSPACE_ID))
        if not batch:
            raise AppError("not_found", "Import batch was not found.", 404)
        if batch.status == "confirmed":
            return batch
        if expected_revision is not None and expected_revision != batch.preview.get("import_info", {}).get("revision", 1):
            raise AppError("stale_preview", "This preview changed. Inspect the current interpretation before confirming.", 409)
        if batch.status != "previewed" or batch.invalid_rows or not batch.valid_rows:
            raise AppError("invalid_batch", "Review the column mapping and rows that need attention before confirming.", 409)
        model = {"orders": Order, "payments": Payment, "settlements": Settlement}[batch.source_type]
        for record in batch.preview["rows"]:
            if record.get("excluded"):
                continue
            values = dict(record["parsed"])
            date_field = {"orders": "ordered_at", "payments": "paid_at", "settlements": "settled_at"}[batch.source_type]
            values[date_field] = parse_timestamp(values[date_field])
            session.add(model(workspace_id=WORKSPACE_ID, import_batch_id=batch.id, source_row=record["source_row"], row_hash=record["row_hash"], raw=record["raw"], **values))
        batch.status = "confirmed"
        batch.confirmed_at = utcnow()
        workspace.input_revision += 1
        session.add(AuditEvent(workspace_id=WORKSPACE_ID, entity_type="import_batch", entity_id=batch.id, action="import_confirmed", actor=actor,
                               reason="Confirmed validated file import.", previous_state={"status": "previewed"}, new_state={"status": "confirmed", "records": batch.valid_rows, "interpretation": batch.preview.get("import_info", {})}))
        session.flush()
        return batch
