"""Opt-in verification for an operator-provided, empty PostgreSQL test database."""
import argparse
import csv
import io
import json
import os

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

from app.core.config import BACKEND_ROOT, Settings
from app.db.session import database_engine
from app.main import create_app
from app.models.entities import MatchAllocation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-dedicated-test-database", action="store_true", required=True)
    parser.parse_args()
    url = os.environ.get("POSTGRES_TEST_DATABASE_URL", "")
    if not url.startswith("postgresql+psycopg://"):
        raise SystemExit("Set POSTGRES_TEST_DATABASE_URL to an explicitly authorized PostgreSQL test database.")
    verify(url, BACKEND_ROOT.parent / "sample-data")


def verify(url, samples):
    engine = database_engine(url)
    try:
        if inspect(engine).get_table_names():
            raise SystemExit("The test requires an empty dedicated database. Existing tables are never cleared.")
    finally:
        engine.dispose()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    command.check(config)
    expected = json.loads((samples / "demo" / "expected-results.json").read_text())
    settings = Settings(database_url=url, app_mode="local", allowed_hosts=["testserver"], fee_rules_path=str(samples / "fee-rules.json"), _env_file=None)
    with TestClient(create_app(settings)) as client:
        for source in ("orders", "payments", "settlements"):
            response = client.post(f"/api/imports/preview?source_type={source}", content=(samples / "demo" / f"{source}.csv").read_bytes())
            assert response.status_code == 200, "Preview failed"
            batch = response.json()
            assert batch["invalid_rows"] == 0
            assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 200
        run = client.post("/api/runs").json()
        assert run["original_summary"] == expected["summary"]
        case = client.get(f"/api/discrepancies?run_id={run['id']}").json()["items"][0]
        for action in ("note", "resolve", "reopen"):
            response = client.post(f"/api/investigations/{case['id']}/review", json={"action": action, "expected_version": case["version"], "reason": "Dedicated PostgreSQL synthetic verification"})
            assert response.status_code == 200
            case = response.json()
        assert len(case["audit_history"]) == 3
        exported = client.get(f"/api/reports/{run['id']}/export?kind=discrepancies")
        assert len(list(csv.DictReader(io.StringIO(exported.content.decode("utf-8-sig"))))) == 54
        with client.app.state.sessions() as session:
            allocation = session.scalar(select(MatchAllocation))
            session.add(MatchAllocation(match_id=allocation.match_id, run_id=allocation.run_id, kind=allocation.kind, record_key=allocation.record_key))
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
            else:
                raise AssertionError("Active allocation uniqueness was not enforced")
    print("PostgreSQL migration, schema parity, synthetic reconciliation, review, export, and uniqueness checks passed.")
    print("Synthetic verification records remain in the dedicated test database for inspection.")


if __name__ == "__main__":
    main()
