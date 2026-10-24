"""Make one explicitly requested OpenAI call with isolated synthetic evidence."""
import argparse
import json
from datetime import UTC, datetime
from uuid import uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.core.config import BACKEND_ROOT, Settings
from app.core.errors import AppError
from app.main import create_app
from app.services.investigations.ai import provider_configuration


def check(response):
    if response.status_code != 200:
        detail = response.json().get("detail", {})
        raise SystemExit(detail.get("message", "The verification request failed; no success is claimed."))
    return response.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-synthetic-request", action="store_true", required=True, help="Authorize one bounded API request; the provider can charge for its usage.")
    parser.parse_args()
    settings = Settings()
    try:
        provider = provider_configuration(settings)
    except AppError as error:
        raise SystemExit(error.message) from None
    if provider["hostname"] != "api.openai.com":
        raise SystemExit("This verification script requires the selected OpenAI provider.")
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    database_name = f"ai-check-{timestamp}-{uuid4().hex[:8]}.db"
    url = "sqlite:///" + (BACKEND_ROOT / "data" / database_name).as_posix()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    settings = settings.model_copy(update={"database_url": url, "fee_rules_path": None})
    sources = {
        "orders": "order_ref,amount,currency,ordered_at,status,description\nSYN-AI-ORDER,125.50,GHS,2026-10-20,open,Entirely synthetic office supplies order\n",
        "payments": "provider,transaction_ref,order_ref,amount,currency,paid_at,status,description\nMTN,SYN-AI-PAYMENT,INCORRECT-REFERENCE,125.50,GHS,2026-10-20,successful,Synthetic office supplies payment with a copied reference\n",
    }
    with TestClient(create_app(settings)) as client:
        for source, content in sources.items():
            batch = check(client.post(f"/api/imports/preview?source_type={source}", content=content, headers={"X-Filename": f"synthetic-ai-{source}.csv"}))
            check(client.post(f"/api/imports/{batch['id']}/confirm"))
        run = check(client.post("/api/runs"))
        case = check(client.get(f"/api/discrepancies?run_id={run['id']}&type=unmatched_payment"))["items"][0]
        result = check(client.post(f"/api/investigations/{case['id']}/ai", json={"consent_to_send_evidence": True, "expected_version": case["version"]}))
        saved = [note for note in result["investigations"] if note["kind"] == "ai"]
        if len(saved) != 1 or result["status"] != case["status"]:
            raise SystemExit("The live response was not persisted as the expected hypothesis; verification failed.")
        current = check(client.get(f"/api/runs/{run['id']}"))
        if current["snapshot_hash"] != run["snapshot_hash"] or current["current_summary"] != run["current_summary"] or current["original_summary"] != run["original_summary"]:
            raise SystemExit("Financial output changed during assistance; verification failed.")
        print(json.dumps({"live_verification": "passed", "provider": saved[0]["ai_metadata"]["provider"], "model": saved[0]["ai_metadata"]["model"],
                          "synthetic_database": database_name, "case_id": case["id"], "investigation_id": saved[0]["id"],
                          "confidence": saved[0]["evidence"]["confidence_classification"], "hypothesis": saved[0]["explanation"], "financial_results_unchanged": True}, indent=2))


if __name__ == "__main__":
    main()
