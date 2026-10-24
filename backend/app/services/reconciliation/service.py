from sqlalchemy import select

from app.core.config import WORKSPACE_ID
from app.core.errors import AppError
from app.core.money import PRECISION
from app.core.time import utcnow
from app.models.entities import AuditEvent, Discrepancy, ImportBatch, MatchAllocation, Order, Payment, ReconciliationMatch, ReconciliationRun
from app.services.imports.csv_parser import content_hash
from app.services.imports.service import lock_workspace
from app.services.reconciliation.engine import RULE_VERSION, payment_key, reconcile


def source_data(record, record_type):
    return {column.name: (value.isoformat() if hasattr(value, "isoformat") else value)
            for column in record.__table__.columns if (value := getattr(record, column.name)) is not None} | {"record_type": record_type}


def create_run(session, actor: str):
    with session.begin():
        workspace = lock_workspace(session)
        orders = session.scalars(select(Order).where(Order.workspace_id == WORKSPACE_ID).order_by(Order.id)).all()
        payments = session.scalars(select(Payment).where(Payment.workspace_id == WORKSPACE_ID).order_by(Payment.id)).all()
        if not orders and not payments:
            raise AppError("no_inputs", "Confirm an order or payment import before starting reconciliation.", 409)
        batches = {batch.id: batch for batch in session.scalars(select(ImportBatch).where(ImportBatch.workspace_id == WORKSPACE_ID))}
        source_rows = {(batch.id, row["source_row"]): row for batch in batches.values() for row in batch.preview["rows"]}

        def capture_record(record, kind):
            batch = batches[record.import_batch_id]
            info = batch.preview.get("import_info", {})
            row = source_rows[(batch.id, record.source_row)]
            options = info.get("options", {})
            interpretation = {"sheet": info.get("sheet"), "column_mapping": info.get("mapping", {}), "timezone": options.get("timezone"), "date_order": options.get("date_order"),
                              "row_changes": row.get("transformations", []), "corrections": options.get("corrections", {}).get(str(record.source_row), {}),
                              "correction_reason": options.get("reason") if str(record.source_row) in options.get("corrections", {}) else None}
            return source_data(record, kind) | {"source_filename": batch.filename, "interpretation": interpretation}

        snapshot = {"orders": [capture_record(record, "order") for record in orders], "payments": [capture_record(record, "payment") for record in payments],
                    "settlements": [], "input_revision": workspace.input_revision, "rule_version": RULE_VERSION, "currency_precision": PRECISION}
        run = ReconciliationRun(workspace_id=WORKSPACE_ID, input_revision=workspace.input_revision, snapshot_hash=content_hash(snapshot), snapshot=snapshot, rule_version=RULE_VERSION)
        session.add(run)
        session.flush()
        run_id = run.id
    try:
        result = reconcile(snapshot)
        with session.begin():
            lock_workspace(session)
            payments_by_id = {payment["id"]: payment for payment in snapshot["payments"]}
            for decision in result["matches"]:
                match = ReconciliationMatch(workspace_id=WORKSPACE_ID, run_id=run_id, **decision)
                session.add(match)
                session.flush()
                keys = ["order:" + match.order_id, "payment:" + match.payment_id, "payment_key:" + payment_key(payments_by_id[match.payment_id])]
                for key in keys:
                    session.add(MatchAllocation(match_id=match.id, run_id=run_id, kind=match.kind, record_key=key))
            for discrepancy in result["discrepancies"]:
                session.add(Discrepancy(workspace_id=WORKSPACE_ID, run_id=run_id, **discrepancy))
            run = session.get(ReconciliationRun, run_id)
            run.original_summary = result["summary"]
            run.status = "completed"
            run.completed_at = utcnow()
            session.add(AuditEvent(workspace_id=WORKSPACE_ID, entity_type="reconciliation_run", entity_id=run_id, action="reconciliation_completed", actor=actor,
                                   reason="Completed deterministic order-payment reconciliation.", previous_state={"status": "running"}, new_state={"status": "completed", "snapshot_hash": run.snapshot_hash}))
            session.flush()
            return run
    except Exception:
        session.rollback()
        with session.begin():
            failed = session.get(ReconciliationRun, run_id)
            failed.status = "failed"
            failed.failure_code = "reconciliation_failed"
            failed.completed_at = utcnow()
        raise AppError("reconciliation_failed", "Reconciliation failed. No partial result was accepted.", 500) from None
