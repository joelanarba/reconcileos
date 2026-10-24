import json

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
import pytest

from app.models.entities import AuditEvent, Discrepancy, MatchAllocation, ReconciliationMatch, ReconciliationRun
from app.main import create_app
from app.core.config import Settings
from fastapi.testclient import TestClient
from conftest import SAMPLE_ROOT, import_fixture


def test_complete_first_slice_matches_independent_manifest(imported_client):
    response = imported_client.post("/api/runs")
    assert response.status_code == 200, response.text
    run = response.json()
    expected = json.loads((SAMPLE_ROOT / "expected-results.json").read_text())
    assert run["status"] == "completed"
    for field, value in expected.items():
        if field in run["original_summary"]:
            assert run["original_summary"][field] == value, field
    matches = imported_client.get(f"/api/runs/{run['id']}/matches").json()
    assert matches["total"] == 1
    sources = matches["items"][0]["source_records"]
    assert {record.get("order_ref") for record in sources} == {"SYN-ORD-1001"}
    assert next(record for record in sources if record["record_type"] == "payment")["transaction_ref"] == "SYN-PAY-1001"
    assert all(record["source_filename"].endswith(".csv") for record in sources)
    assert imported_client.get(f"/api/runs/{run['id']}/matches?search=SYN-PAY-1001").json()["total"] == 1
    cases = imported_client.get(f"/api/discrepancies?run_id={run['id']}&type=partial_payment").json()
    assert cases["total"] == 1
    evidence = imported_client.get("/api/discrepancies/" + cases["items"][0]["id"]).json()
    assert len(evidence["source_records"]) == 2
    assert evidence["snapshot_hash"] == run["snapshot_hash"]


def test_repeated_run_has_identical_snapshot_and_financial_decisions(imported_client):
    first = imported_client.post("/api/runs").json()
    second = imported_client.post("/api/runs").json()
    assert first["id"] != second["id"]
    assert first["snapshot_hash"] == second["snapshot_hash"]
    assert first["original_summary"] == second["original_summary"]
    with imported_client.app.state.sessions() as session:
        first_keys = set(session.scalars(select(Discrepancy.case_key).where(Discrepancy.run_id == first["id"])))
        second_keys = set(session.scalars(select(Discrepancy.case_key).where(Discrepancy.run_id == second["id"])))
        assert first_keys == second_keys


def test_recorded_inputs_survive_restart_and_new_import_marks_old_run_stale(imported_client, database_url):
    run = imported_client.post("/api/runs").json()
    application = create_app(Settings(database_url=database_url, _env_file=None))
    with TestClient(application) as restarted:
        assert restarted.get("/api/imports").json()["total"] == 2
        assert restarted.get(f"/api/runs/{run['id']}").json()["original_summary"] == run["original_summary"]
        content = "order_ref,amount,currency,ordered_at,status\nSYN-NEW,12.00,GHS,2026-10-20T12:00:00Z,open\n"
        batch = restarted.post("/api/imports/preview?source_type=orders", content=content).json()
        restarted.post(f"/api/imports/{batch['id']}/confirm")
        previous = restarted.get(f"/api/runs/{run['id']}").json()
        assert previous["is_stale"] is True
        assert previous["source_counts"]["orders"] == 4
        assert previous["original_summary"] == run["original_summary"]


def test_active_allocation_uniqueness_is_enforced_by_database(imported_client):
    run = imported_client.post("/api/runs").json()
    with imported_client.app.state.sessions() as session:
        allocation = session.scalar(select(MatchAllocation).where(MatchAllocation.run_id == run["id"]))
        session.add(MatchAllocation(run_id=allocation.run_id, match_id=allocation.match_id, kind=allocation.kind, record_key=allocation.record_key))
        with pytest.raises(IntegrityError):
            session.commit()


def test_failed_result_persistence_leaves_no_partial_output(imported_client, monkeypatch):
    import app.services.reconciliation.service as run_service

    def fail_engine(snapshot):
        raise RuntimeError("Simulated engine failure")

    monkeypatch.setattr(run_service, "reconcile", fail_engine)
    response = imported_client.post("/api/runs")
    assert response.status_code == 500
    assert "Simulated" not in response.text
    with imported_client.app.state.sessions() as session:
        run = session.scalar(select(ReconciliationRun))
        assert run.status == "failed"
        assert session.scalar(select(func.count()).select_from(ReconciliationMatch)) == 0
        assert session.scalar(select(func.count()).select_from(Discrepancy)) == 0


def test_no_inputs_and_unknown_ids_are_safe(client):
    assert client.post("/api/runs").status_code == 409
    assert client.get("/api/runs/unknown").status_code == 404
    assert client.get("/api/discrepancies/unknown").status_code == 404
    assert client.get("/api/imports/unknown").status_code == 404
    assert client.get("/api/runs?page_size=1000").status_code == 422


def test_mid_persistence_failure_rolls_back_matches_cases_and_allocations(imported_client, monkeypatch):
    from app.services.reconciliation.service import create_run

    with imported_client.app.state.sessions() as session:
        original_flush = session.flush

        def fail_after_case_insert(*args, **kwargs):
            if any(isinstance(record, Discrepancy) for record in session.new):
                original_flush(*args, **kwargs)
                raise RuntimeError("Simulated persistence failure")
            return original_flush(*args, **kwargs)

        monkeypatch.setattr(session, "flush", fail_after_case_insert)
        from app.core.errors import AppError

        with pytest.raises(AppError, match="No partial result"):
            create_run(session, "Test operator")
    with imported_client.app.state.sessions() as session:
        assert session.scalar(select(ReconciliationRun.status)) == "failed"
        assert session.scalar(select(func.count()).select_from(ReconciliationMatch)) == 0
        assert session.scalar(select(func.count()).select_from(MatchAllocation)) == 0
        assert session.scalar(select(func.count()).select_from(Discrepancy)) == 0


def test_cors_and_host_configuration_are_explicit(client):
    approved = client.options("/api/runs", headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST"})
    assert approved.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    rejected = client.options("/api/runs", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in rejected.headers
    assert client.get("/api/health", headers={"Host": "untrusted.example"}).status_code == 400


def test_application_audit_events_are_append_only(client):
    import_fixture(client, "orders")
    with client.app.state.sessions() as session:
        event = session.scalar(select(AuditEvent))
        event.reason = "Changed history"
        with pytest.raises(ValueError, match="append-only"):
            session.commit()
