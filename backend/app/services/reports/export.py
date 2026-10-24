import csv
import io
import json

from sqlalchemy import select

from app.core.errors import AppError
from app.core.money import PRECISION
from app.models.entities import Discrepancy
from app.services.investigations.review import current_summary


DEFINITIONS = {
    "total_payment_value": "Successful payment rows outside repeated provider transaction groups; each currency stays separate.",
    "matched_order_value": "Expected amounts of currently accepted order relationships, counted once per order.",
    "matched_settlement_value": "Recorded net amounts of currently accepted settlement relationships, counted once per settlement.",
    "unresolved_discrepancy_value": "Affected recorded value of connected unresolved evidence: orders first, otherwise logical payments, otherwise settlement gross. Not a loss total.",
    "duplicate_notification_count": "Extra rows in repeated provider transaction groups. No fraud conclusion is implied.",
    "missing_settlement_evidence_count": "Eligible payments with no corresponding provider/reference settlement record. Does not prove settlement failure.",
    "category_counts": "Unresolved case counts by category. Categories overlap and cannot be added as separate financial losses.",
}


def report_data(session, run):
    if run.status != "completed":
        raise AppError("incomplete_run", "Reports require a completed reconciliation run.", 409)
    return {"run_id": run.id, "snapshot_hash": run.snapshot_hash, "rule_version": run.rule_version, "input_revision": run.input_revision,
            "started_at": run.started_at, "original_summary": run.original_summary, "current_summary": current_summary(session, run), "metric_definitions": DEFINITIONS}


def decimal_amount(minor, currency):
    amount, precision = int(minor), PRECISION[currency]
    sign = "-" if amount < 0 else ""
    whole, fraction = divmod(abs(amount), 10 ** precision)
    return sign + str(whole) + ("." + str(fraction).zfill(precision) if precision else "")


def safe_cell(value):
    text = str(value) if value is not None else ""
    if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
        return "'" + text
    return text


def csv_bytes(rows):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    for row in rows:
        writer.writerow([safe_cell(cell) for cell in row])
    return output.getvalue().encode("utf-8-sig")


def export_report(session, run, kind):
    data = report_data(session, run)
    if kind == "summary":
        rows = [["run_id", "snapshot_hash", "summary_basis", "metric", "currency", "minor_units", "decimal_amount", "count"]]
        for basis in ("original_summary", "current_summary"):
            for metric, value in data[basis].items():
                if isinstance(value, dict):
                    for key, amount in sorted(value.items()):
                        if metric == "category_counts":
                            rows.append([run.id, run.snapshot_hash, basis, "category:" + key, "", "", "", amount])
                        else:
                            rows.append([run.id, run.snapshot_hash, basis, metric, key, amount, decimal_amount(amount, key), ""])
                else:
                    rows.append([run.id, run.snapshot_hash, basis, metric, "", "", "", value])
    else:
        rows = [["run_id", "snapshot_hash", "case_id", "type", "severity", "status", "version", "description", "rule", "source_record_ids", "recorded_values_json"]]
        records = {record["record_type"] + ":" + record["id"]: record for source in ("orders", "payments", "settlements") for record in run.snapshot[source]}
        cases = session.scalars(select(Discrepancy).where(Discrepancy.run_id == run.id).order_by(Discrepancy.type, Discrepancy.case_key)).all()
        for case in cases:
            values = [{"record_id": key, "currency": records[key]["currency"], "amounts": {field: {"minor_units": str(value), "decimal_amount": decimal_amount(value, records[key]["currency"])} for field, value in records[key].items() if field.endswith("_minor")}} for key in case.evidence["records"]]
            rows.append([run.id, run.snapshot_hash, case.id, case.type, case.severity, case.status, case.version, case.description, case.evidence["rule"], json.dumps(case.evidence["records"]), json.dumps(values, ensure_ascii=False)])
    return csv_bytes(rows)
