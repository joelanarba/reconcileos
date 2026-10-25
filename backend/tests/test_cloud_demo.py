import json

from app.core.config import BACKEND_ROOT


def test_hosted_fixture_has_independent_expected_results_without_assumed_fees(client):
    root = BACKEND_ROOT.parent / "sample-data" / "cloud-demo"
    client.app.state.settings.fee_rules_path = None
    for source in ("orders", "payments", "settlements"):
        response = client.post(f"/api/imports/preview?source_type={source}", content=(root / f"{source}.csv").read_bytes())
        assert response.status_code == 200
        batch = response.json()
        assert batch["invalid_rows"] == 0
        assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 200
    run = client.post("/api/runs").json()
    assert run["original_summary"] == json.loads((root / "expected-results.json").read_text())["summary"]
