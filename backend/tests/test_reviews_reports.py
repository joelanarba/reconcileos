import csv
import io

import pytest
from sqlalchemy import func, select

from app.models.entities import AuditEvent, Discrepancy, Investigation, MatchAllocation, ReconciliationMatch, ReviewDecision
from app.schemas.reviews import ReviewRequest
from app.services.investigations.review import review_case
from app.services.reports.export import csv_bytes


def prepared_case(client, *, amount="100.00", currency="GHS", reference="WRONG"):
    files = {"orders": "order_ref,amount,currency,ordered_at,status\nSYN-REVIEW,100.00,GHS,2026-10-20,open\n",
             "payments": f"provider,transaction_ref,order_ref,amount,currency,paid_at,status\nMTN,TX-REVIEW,{reference},{amount},{currency},2026-10-20,successful\n"}
    for source, text in files.items():
        batch = client.post(f"/api/imports/preview?source_type={source}", content=text).json()
        assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 200
    run = client.post("/api/runs").json()
    case = client.get(f"/api/discrepancies?run_id={run['id']}&type=unmatched_payment").json()["items"][0]
    candidates = case["evidence"]["candidates"]
    pair = {"order_id": candidates["order_ids"][0], "payment_id": candidates["payment_ids"][0]}
    return run, case, pair


def act(client, case, action, **payload):
    return client.post(f"/api/investigations/{case['id']}/review", json={"action": action, "expected_version": case["version"], "reason": "Checked the synthetic source evidence.", **payload})


def test_transitions_notes_audit_and_original_summary_are_persisted(client):
    run, case, pair = prepared_case(client)
    case = act(client, case, "note").json()
    assert case["version"] == 2 and case["status"] == "open"
    assert case["investigations"][0]["kind"] == "note"
    case = act(client, case, "start_review").json()
    assert case["status"] == "in_review"
    assert act(client, case, "start_review").status_code == 409
    case = act(client, case, "resolve").json()
    updated = client.get(f"/api/runs/{run['id']}").json()
    assert updated["original_summary"] == run["original_summary"]
    assert updated["current_summary"]["unresolved_discrepancy_count"] == run["original_summary"]["unresolved_discrepancy_count"] - 1
    case = act(client, case, "reopen").json()
    assert case["status"] == "reopened"
    assert len(case["audit_history"]) == 4
    assert case["audit_history"][-1]["previous_state"]["status"] == "resolved"
    assert case["audit_history"][-1]["actor"] == "Local operator"
    assert client.get(f"/api/runs/{run['id']}").json()["current_summary"] == run["original_summary"]


def test_stale_review_cannot_create_duplicate_note_or_audit(client):
    run, case, pair = prepared_case(client)
    assert act(client, case, "note").status_code == 200
    assert act(client, case, "note").status_code == 409
    detail = client.get(f"/api/investigations/{case['id']}").json()
    assert len(detail["audit_history"]) == len(detail["investigations"]) == 1
    assert act(client, detail, "resolve", reason="  ").status_code == 422


def test_manual_approval_allocation_conflict_reopen_and_explicit_reversal(client):
    run, case, pair = prepared_case(client)
    case = act(client, case, "approve_match", **pair).json()
    assert case["status"] == "in_review" and len(case["manual_matches"]) == 1
    match_id = case["manual_matches"][0]["id"]
    updated = client.get(f"/api/runs/{run['id']}").json()
    assert updated["current_summary"]["matched_order_value"] == {"GHS": "10000"}
    assert updated["original_summary"]["matched_order_value"] == {}
    assert act(client, case, "approve_match", **pair).status_code == 409
    case = act(client, case, "reject_match", **pair).json()
    assert len(case["manual_matches"]) == 1
    case = act(client, case, "resolve").json()
    assert act(client, case, "approve_match", **pair).status_code == 409
    case = act(client, case, "reopen").json()
    assert len(case["manual_matches"]) == 1
    case = act(client, case, "reverse_match", match_id=match_id).json()
    assert case["manual_matches"] == []
    assert act(client, case, "reverse_match", match_id=match_id).status_code == 409
    updated = client.get(f"/api/runs/{run['id']}").json()
    assert updated["current_summary"] == updated["original_summary"]
    match = client.get(f"/api/runs/{run['id']}/matches").json()["items"][0]
    assert match["active"] is False
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(MatchAllocation)) == 0
        assert session.scalar(select(func.count()).select_from(ReconciliationMatch)) == 1


@pytest.mark.parametrize("amount,currency", [("50.00", "GHS"), ("100.00", "USD"), ("100.01", "GHS")])
def test_human_approval_cannot_waive_currency_or_amount(client, amount, currency):
    run, case, pair = prepared_case(client, amount=amount, currency=currency, reference="SYN-REVIEW")
    response = act(client, case, "approve_match", **pair)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "unsafe_match"
    assert client.get(f"/api/runs/{run['id']}/matches").json()["total"] == 0


def test_unsupported_evidence_and_automatic_reversal_are_rejected(imported_client):
    run = imported_client.post("/api/runs").json()
    case = imported_client.get(f"/api/discrepancies?run_id={run['id']}").json()["items"][0]
    assert act(imported_client, case, "approve_match", order_id="outside", payment_id="outside").status_code == 409
    automatic = imported_client.get(f"/api/runs/{run['id']}/matches").json()["items"][0]
    assert act(imported_client, case, "reverse_match", match_id=automatic["id"]).status_code == 409


def test_review_failure_rolls_back_note_case_and_audit(client, monkeypatch):
    run, case, pair = prepared_case(client)
    with client.app.state.sessions() as session:
        original = session.flush

        def fail_flush(*args, **kwargs):
            if any(isinstance(record, AuditEvent) for record in session.new):
                original(*args, **kwargs)
                raise RuntimeError("Simulated write failure")
            return original(*args, **kwargs)

        monkeypatch.setattr(session, "flush", fail_flush)
        with pytest.raises(RuntimeError):
            review_case(session, case["id"], ReviewRequest(action="note", expected_version=1, reason="Synthetic failure check"), "Test operator")
    with client.app.state.sessions() as session:
        assert session.get(Discrepancy, case["id"]).version == 1
        assert session.scalar(select(func.count()).select_from(Investigation)) == 0
        assert session.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_type == "discrepancy")) == 0


@pytest.mark.parametrize("model", [Investigation, ReviewDecision])
def test_review_history_is_append_only(client, model):
    run, case, pair = prepared_case(client)
    assert act(client, case, "note" if model is Investigation else "resolve").status_code == 200
    with client.app.state.sessions() as session:
        record = session.scalar(select(model))
        if model is Investigation:
            record.explanation = "Changed"
        else:
            record.reason = "Changed"
        with pytest.raises(ValueError, match="append-only"):
            session.commit()


def test_summary_and_case_exports_agree_with_current_report(client):
    run, case, pair = prepared_case(client)
    case = act(client, case, "approve_match", **pair).json()
    report = client.get(f"/api/reports/{run['id']}").json()
    response = client.get(f"/api/reports/{run['id']}/export?kind=summary")
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    matched = next(row for row in rows if row["summary_basis"] == "current_summary" and row["metric"] == "matched_order_value")
    assert matched["currency"] == "GHS" and matched["minor_units"] == "10000" and matched["decimal_amount"] == "100.00"
    assert report["original_summary"]["matched_order_value"] == {}
    response = client.get(f"/api/reports/{run['id']}/export?kind=discrepancies")
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert len(rows) == report["original_summary"]["unresolved_discrepancy_count"]
    assert all(row["snapshot_hash"] == run["snapshot_hash"] for row in rows)
    assert "recorded_values_json" in rows[0]


def test_csv_formula_neutralization_and_quoted_multiline_text():
    values = ["=1+1", "+SUM(A1)", " -1+2", "@SUM(A1)", "\tformula", 'ordinary,"quoted"\ntext']
    decoded = list(csv.reader(io.StringIO(csv_bytes([values]).decode("utf-8-sig"))))[0]
    assert decoded[:5] == ["'" + value for value in values[:5]]
    assert decoded[5] == values[5]
