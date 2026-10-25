import io
import csv
from typing import Literal

from fastapi import APIRouter, Body, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.core.config import PROVIDERS, WORKSPACE_ID
from app.core.errors import AppError
from app.core.fees import fee_configuration
from app.core.money import PRECISION
from app.models.entities import Discrepancy, ImportBatch, Investigation, ReconciliationMatch, ReconciliationRun, Workspace
from app.services.imports.csv_parser import TEMPLATES
from app.services.imports.service import confirm_batch, preview_batch, remap_batch
from app.schemas.imports import ImportOptions
from app.services.reconciliation.service import create_run
from app.services.reconciliation.engine import RULE_VERSION
from app.services.investigations.review import active_matches, current_summary
from app.services.investigations.ai import availability
from app.core.security import authorize_operator


router = APIRouter(prefix="/api", dependencies=[Depends(authorize_operator)])


def get_session(request: Request):
    with request.app.state.sessions() as session:
        yield session


def public(value):
    if isinstance(value, dict):
        return {key: str(item) if key.endswith("_minor") and item is not None else public(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def entity_data(entity):
    return {column.name: getattr(entity, column.name) for column in entity.__table__.columns}


def paginate(items: list, page: int, page_size: int):
    offset = (page - 1) * page_size
    return {"items": items[offset:offset + page_size], "total": len(items), "page": page, "page_size": page_size}


def batch_data(batch, page=1, page_size=25, invalid_only=False):
    data = entity_data(batch)
    rows = batch.preview["rows"]
    if invalid_only:
        rows = [row for row in rows if row["errors"] and not row.get("excluded")]
    data["preview"] = {"columns": batch.preview["columns"], **paginate(rows, page, page_size)}
    data["import_info"] = batch.preview.get("import_info")
    return public(data)


def get_run(session, run_id):
    run = session.scalar(select(ReconciliationRun).where(ReconciliationRun.id == run_id, ReconciliationRun.workspace_id == WORKSPACE_ID))
    if not run:
        raise AppError("not_found", "Reconciliation run was not found.", 404)
    return run


def run_data(run, current_revision, session):
    data = entity_data(run)
    data.pop("snapshot")
    data["current_summary"] = current_summary(session, run)
    data["is_stale"] = run.input_revision != current_revision or run.rule_version != RULE_VERSION
    data["fee_configuration"] = run.snapshot.get("fee_configuration")
    data["source_counts"] = {source: len(run.snapshot[source]) for source in ("orders", "payments", "settlements")}
    return public(data)


def evidence_records(run, evidence):
    keys = set(evidence["records"])
    return [record for source in ("orders", "payments", "settlements") for record in run.snapshot[source] if record["record_type"] + ":" + record["id"] in keys]


def matches_search(run, evidence, search):
    if not search:
        return True
    query = search.casefold()
    return any(query in str(record.get(field, "")).casefold() for record in evidence_records(run, evidence)
               for field in ("order_ref", "transaction_ref", "settlement_ref", "provider", "description"))


@router.get("/health")
def health(request: Request, session=Depends(get_session)):
    workspace = session.get(Workspace, WORKSPACE_ID)
    return {"status": "ok" if workspace else "not_ready", "mode": request.app.state.settings.app_mode, "database": "ready" if workspace else "unavailable"}


@router.get("/workspace")
def workspace(request: Request, session=Depends(get_session)):
    data = entity_data(session.get(Workspace, WORKSPACE_ID))
    if getattr(request.app.state, "public_demo", False):
        example = session.scalar(select(Investigation).where(Investigation.kind == "ai").order_by(Investigation.created_at.desc()))
        data["demo"] = {"read_only": True, "ai_case_id": example.discrepancy_id if example else None}
    return public(data | {"operator": request.state.actor, "mode": "demo" if getattr(request.app.state, "public_demo", False) else request.app.state.settings.app_mode, "currency_precision": PRECISION, "providers": PROVIDERS,
                          "available_sources": list(TEMPLATES), "capabilities": ["file_import", "column_mapping", "excel_import", "three_source_reconciliation", "source_evidence"], "rule_scope": "Orders, payments, and settlements", "max_upload_bytes": request.app.state.settings.max_upload_bytes, "max_import_rows": request.app.state.settings.max_import_rows,
                          "fee_configuration": fee_configuration(request.app.state.settings), "ai": availability(request.app.state.settings)})


@router.get("/templates/{source_type}")
def template(source_type: Literal["orders", "payments", "settlements"]):
    output = io.StringIO(newline="")
    csv.writer(output).writerow(TEMPLATES[source_type])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{source_type}-template.csv"'})


@router.post("/imports/preview")
async def preview(request: Request, source_type: Literal["orders", "payments", "settlements"], session=Depends(get_session)):
    limit = request.app.state.settings.max_upload_bytes
    content_length = request.headers.get("content-length")
    if content_length and (not content_length.isdecimal() or int(content_length) > limit):
        raise AppError("file_too_large", "The file exceeds the workspace upload limit.", 413)
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise AppError("file_too_large", "The file exceeds the workspace upload limit.", 413)
        body.extend(chunk)
    batch = await run_in_threadpool(preview_batch, session, request.app.state.settings, source_type, request.headers.get("x-filename", "upload.csv"), bytes(body))
    return batch_data(batch)


@router.get("/imports")
def imports(page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), session=Depends(get_session)):
    batches = session.scalars(select(ImportBatch).where(ImportBatch.workspace_id == WORKSPACE_ID).order_by(ImportBatch.created_at.desc(), ImportBatch.id)).all()
    return public(paginate([{key: value for key, value in entity_data(batch).items() if key != "preview"} for batch in batches], page, page_size))


@router.get("/imports/{batch_id}")
def import_detail(batch_id: str, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), invalid_only: bool = False, session=Depends(get_session)):
    batch = session.scalar(select(ImportBatch).where(ImportBatch.id == batch_id, ImportBatch.workspace_id == WORKSPACE_ID))
    if not batch:
        raise AppError("not_found", "Import batch was not found.", 404)
    return batch_data(batch, page, page_size, invalid_only)


@router.post("/imports/{batch_id}/confirm")
def confirm(batch_id: str, request: Request, payload: dict | None = Body(default=None), session=Depends(get_session)):
    revision = (payload or {}).get("expected_revision")
    if revision is not None and (type(revision) is not int or revision < 1):
        raise AppError("invalid_revision", "Refresh the preview before confirming.")
    return batch_data(confirm_batch(session, batch_id, request.state.actor, revision))


@router.post("/imports/{batch_id}/mapping")
def apply_mapping(batch_id: str, options: ImportOptions, request: Request, session=Depends(get_session)):
    return batch_data(remap_batch(session, request.app.state.settings, batch_id, options, request.state.actor))


@router.post("/runs")
def run_reconciliation(request: Request, session=Depends(get_session)):
    run = create_run(session, request.state.actor, fee_configuration(request.app.state.settings))
    return run_data(run, session.get(Workspace, WORKSPACE_ID).input_revision, session)


@router.get("/runs")
def runs(page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), session=Depends(get_session)):
    records = session.scalars(select(ReconciliationRun).where(ReconciliationRun.workspace_id == WORKSPACE_ID).order_by(ReconciliationRun.started_at.desc(), ReconciliationRun.id)).all()
    revision = session.get(Workspace, WORKSPACE_ID).input_revision
    return paginate([run_data(run, revision, session) for run in records], page, page_size)


@router.get("/runs/{run_id}")
def run_detail(run_id: str, session=Depends(get_session)):
    return run_data(get_run(session, run_id), session.get(Workspace, WORKSPACE_ID).input_revision, session)


@router.get("/dashboard")
def dashboard(session=Depends(get_session)):
    revision = session.get(Workspace, WORKSPACE_ID).input_revision
    records = session.scalars(select(ReconciliationRun).where(ReconciliationRun.workspace_id == WORKSPACE_ID).order_by(ReconciliationRun.started_at.desc(), ReconciliationRun.id).limit(10)).all()
    latest = next((run for run in records if run.status == "completed"), None)
    if latest is None:
        latest = session.scalar(select(ReconciliationRun).where(ReconciliationRun.workspace_id == WORKSPACE_ID, ReconciliationRun.status == "completed").order_by(ReconciliationRun.started_at.desc()).limit(1))
    batches = session.scalars(select(ImportBatch).where(ImportBatch.workspace_id == WORKSPACE_ID).order_by(ImportBatch.created_at.desc(), ImportBatch.id).limit(8)).all()
    return public({"latest_run": run_data(latest, revision, session) if latest else None, "recent_runs": [run_data(run, revision, session) for run in records],
                   "recent_imports": [{key: value for key, value in entity_data(batch).items() if key != "preview"} for batch in batches]})


@router.get("/runs/{run_id}/matches")
def run_matches(run_id: str, search: str = Query("", max_length=128), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), active_only: bool = True, session=Depends(get_session)):
    run = get_run(session, run_id)
    records = session.scalars(select(ReconciliationMatch).where(ReconciliationMatch.run_id == run.id, ReconciliationMatch.workspace_id == WORKSPACE_ID).order_by(ReconciliationMatch.id)).all()
    accepted_ids = {match.id for match in active_matches(session, run.id)}
    items = [entity_data(match) | {"active": match.id in accepted_ids, "source_records": evidence_records(run, match.evidence)} for match in records if (not active_only or match.id in accepted_ids) and matches_search(run, match.evidence, search)]
    return public(paginate(items, page, page_size))


@router.get("/discrepancies")
def discrepancies(run_id: str, search: str = Query("", max_length=128), type: str = Query("", max_length=50), status: str = Query("", max_length=20),
                  page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), session=Depends(get_session)):
    run = get_run(session, run_id)
    query = select(Discrepancy).where(Discrepancy.run_id == run.id, Discrepancy.workspace_id == WORKSPACE_ID)
    if type:
        query = query.where(Discrepancy.type == type)
    if status:
        query = query.where(Discrepancy.status == status)
    cases = session.scalars(query.order_by(Discrepancy.type, Discrepancy.case_key)).all()
    items = [entity_data(case) | {"source_records": evidence_records(run, case.evidence)} for case in cases
             if not search or search.casefold() in case.description.casefold() or matches_search(run, case.evidence, search)]
    return public(paginate(items, page, page_size))


@router.get("/discrepancies/{case_id}")
def discrepancy_detail(case_id: str, session=Depends(get_session)):
    case = session.scalar(select(Discrepancy).where(Discrepancy.id == case_id, Discrepancy.workspace_id == WORKSPACE_ID))
    if not case:
        raise AppError("not_found", "Discrepancy was not found.", 404)
    run = get_run(session, case.run_id)
    return public(entity_data(case) | {"source_records": evidence_records(run, case.evidence), "snapshot_hash": run.snapshot_hash})
