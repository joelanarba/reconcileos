"""Prepare the public synthetic example through the real import and run APIs."""
import json

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import WORKSPACE_ID, Settings
from app.db.session import database_engine, session_factory
from app.models.entities import ReconciliationRun, Workspace


def seed_demo(url, samples):
    from app.main import create_app

    settings = Settings(database_url=url, app_mode="local", allowed_hosts=["testserver"],
                        fee_rules_path=str(samples / "fee-rules.json"), llm_api_key=None, _env_file=None)
    engine = database_engine(url)
    try:
        with session_factory(engine)() as session:
            existing = session.scalar(select(ReconciliationRun))
            if existing:
                return {"seeded": False, "run_id": existing.id, "summary": existing.original_summary}
            workspace = session.get(Workspace, WORKSPACE_ID)
            workspace.name = "Adom Commerce - Synthetic demo"
            session.commit()
    finally:
        engine.dispose()
    with TestClient(create_app(settings)) as client:
        for source in ("orders", "payments", "settlements"):
            response = client.post(f"/api/imports/preview?source_type={source}", headers={"X-Filename": f"synthetic-{source}.csv"}, content=(samples / "demo" / f"{source}.csv").read_bytes())
            if response.status_code != 200 or response.json()["invalid_rows"]:
                raise RuntimeError("Synthetic demo import validation failed.")
            batch = response.json()
            confirmed = client.post(f"/api/imports/{batch['id']}/confirm")
            if confirmed.status_code != 200:
                raise RuntimeError("Synthetic demo import confirmation failed.")
        response = client.post("/api/runs")
        if response.status_code != 200:
            raise RuntimeError("Synthetic demo reconciliation failed.")
        run = response.json()
        expected = json.loads((samples / "demo" / "expected-results.json").read_text())
        if run["original_summary"] != expected["summary"]:
            raise RuntimeError("Synthetic demo results differ from the expected manifest.")
        # A persisted human note demonstrates attribution without inventing an AI response.
        cases = client.get(f"/api/discrepancies?run_id={run['id']}&search=SYN-TXN-0086").json()["items"]
        if not cases:
            cases = client.get(f"/api/discrepancies?run_id={run['id']}").json()["items"]
        if cases:
            case = cases[0]
            result = client.post(f"/api/investigations/{case['id']}/review", json={"action": "note", "expected_version": case["version"], "reason": "Synthetic demonstration: inspect the imported evidence and confirm the reference with the source system before approving an association."})
            if result.status_code != 200:
                raise RuntimeError("Synthetic review preparation failed.")
        return {"seeded": True, "run_id": run["id"], "summary": run["original_summary"]}


def prepare_ai_example(url, samples, ai):
    """Save one actual, validated provider hypothesis for visitors to inspect."""
    from app.main import create_app
    from app.models.entities import Investigation
    engine = database_engine(url)
    try:
        with session_factory(engine)() as session:
            if session.scalar(select(Investigation).where(Investigation.kind == "ai")):
                return {"ai_example": "already_saved"}
    finally:
        engine.dispose()
    if not ai.get("api_key") or not ai.get("model"):
        return {"ai_example": "not_configured"}
    settings = Settings(database_url=url, app_mode="local", allowed_hosts=["testserver"], local_operator="Synthetic demo preparation",
                        fee_rules_path=str(samples / "fee-rules.json"), llm_base_url="https://api.openai.com/v1",
                        llm_api_key=ai["api_key"], llm_model=ai["model"], llm_response_format="json_schema", llm_timeout_seconds=20, _env_file=None)
    with TestClient(create_app(settings)) as client:
        run = client.get("/api/runs").json()["items"][0]
        cases = client.get(f"/api/discrepancies?run_id={run['id']}&search=SYN-TXN-0086").json()["items"]
        if not cases:
            cases = client.get(f"/api/discrepancies?run_id={run['id']}&type=ambiguous_match").json()["items"]
        if not cases:
            return {"ai_example": "no_suitable_case"}
        case = cases[0]
        response = client.post(f"/api/investigations/{case['id']}/ai", json={"consent_to_send_evidence": True, "expected_version": case["version"]})
        if response.status_code != 200:
            return {"ai_example": "provider_unavailable", "status": response.status_code}
        return {"ai_example": "saved", "case_id": case["id"]}
