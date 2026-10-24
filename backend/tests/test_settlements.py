import json
from copy import deepcopy

import pytest

from app.core.config import BACKEND_ROOT
from app.services.reconciliation.engine import reconcile
from test_engine import order, payment, snapshot


def settlement(identity="settlement-1", **changes):
    return {"id": identity, "record_type": "settlement", "provider": "MTN_MOMO", "settlement_ref": identity, "payment_ref": "TX-1", "gross_minor": 10000, "fee_minor": 100, "net_minor": 9900, "currency": "GHS", "row_hash": identity, **changes}


def inputs(records=None, *, rules=True):
    data = snapshot([order()], [payment()])
    data["settlements"] = records if records is not None else [settlement()]
    data["fee_configuration"] = {"rules": {"MTN_MOMO": {"GHS": {"basis_points": 100, "fixed_minor": 0}}}} if rules else {}
    return data


def test_exact_three_source_chain_and_distinct_valuations():
    result = reconcile(inputs())
    assert {match["kind"] for match in result["matches"]} == {"order_payment", "payment_settlement"}
    assert result["discrepancies"] == []
    assert result["summary"]["matched_settlement_value"] == {"GHS": "9900"}
    assert result["summary"]["matched_order_value"] == {"GHS": "10000"}


@pytest.mark.parametrize("changes,kind", [({"fee_minor": 101, "net_minor": 9899}, "fee_discrepancy"), ({"net_minor": 9901}, "settlement_discrepancy"), ({"currency": "USD"}, "settlement_discrepancy"), ({"gross_minor": 9999, "net_minor": 9899}, "settlement_discrepancy")])
def test_reference_linked_differences_are_not_missing_evidence(changes, kind):
    result = reconcile(inputs([settlement(**changes)]))
    assert result["summary"]["category_counts"] == {kind: 1}
    assert result["summary"]["matched_settlement_count"] == 0
    assert result["summary"]["missing_settlement_evidence_count"] == 0


def test_unconfigured_fee_is_never_assumed_zero():
    result = reconcile(inputs(rules=False))
    assert result["summary"]["category_counts"] == {"fee_rule_missing": 1}


def test_missing_evidence_and_provider_identity():
    result = reconcile(inputs([settlement(provider="TELECEL_CASH")]))
    assert result["summary"]["category_counts"] == {"missing_settlement_evidence": 1, "unmatched_settlement": 1}
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "20000"}


def test_multiple_settlements_remain_ambiguous():
    result = reconcile(inputs([settlement(), settlement("settlement-2")]))
    assert result["summary"]["category_counts"] == {"ambiguous_settlement": 1}
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "10000"}


def test_snapshot_order_independence_and_no_mutation():
    data = inputs([settlement(), settlement("settlement-2")])
    before = deepcopy(data)
    result = reconcile(data)
    data["settlements"].reverse()
    assert reconcile(data) == result
    data["settlements"].reverse()
    assert data == before


def test_settlement_import_retains_inconsistent_equation(client):
    text = "Provider,Settlement ID,Transaction ID,Gross,Fees,Net,Date\nMTN,SYN-S1,TX-1,100.00,1.00,98.00,21/10/2026\n"
    response = client.post("/api/imports/preview?source_type=settlements", content=text)
    assert response.status_code == 200, response.text
    batch = response.json()
    assert batch["valid_rows"] == 1
    assert batch["preview"]["items"][0]["warnings"]
    assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 200


def test_settlement_fee_heading_cannot_silently_change_currency(client):
    text = "Provider,Settlement ID,Transaction ID,Gross GHS,Fees (USD),Net GHS,Date\nMTN,SYN-S1,TX-1,100.00,1.00,99.00,21/10/2026\n"
    batch = client.post("/api/imports/preview?source_type=settlements", content=text).json()
    assert batch["invalid_rows"] == 1
    assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 409


def test_full_synthetic_manifest_through_real_api(client):
    root = BACKEND_ROOT.parent / "sample-data"
    client.app.state.settings.fee_rules_path = str(root / "fee-rules.json")
    expected = json.loads((root / "demo" / "expected-results.json").read_text())
    for source in ("orders", "payments", "settlements"):
        response = client.post(f"/api/imports/preview?source_type={source}", content=(root / "demo" / f"{source}.csv").read_bytes())
        assert response.status_code == 200, response.text
        batch = response.json()
        assert batch["invalid_rows"] == 0, batch["preview"]
        assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 200
    response = client.post("/api/runs")
    assert response.status_code == 200, response.text
    run = response.json()
    assert run["original_summary"] == expected["summary"]
    matches = []
    for page in (1, 2):
        matches += client.get(f"/api/runs/{run['id']}/matches?page={page}&page_size=100").json()["items"]
    for kind, field in (("order_payment", "order_payment_numbers"), ("payment_settlement", "payment_settlement_numbers")):
        actual = sorted(int(next(record["transaction_ref"] for record in match["source_records"] if record["record_type"] == "payment").split("-")[-1]) for match in matches if match["kind"] == kind)
        assert actual == expected[field]
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["latest_run"]["current_summary"] == expected["summary"]
    assert client.post("/api/runs").json()["snapshot_hash"] == run["snapshot_hash"]
