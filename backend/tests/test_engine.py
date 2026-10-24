from copy import deepcopy

from app.services.reconciliation.engine import reconcile


def order(identity="order-1", reference="SYN-1", amount=10000, currency="GHS", status="open"):
    return {"id": identity, "record_type": "order", "order_ref": reference, "expected_minor": amount, "currency": currency, "status": status, "row_hash": identity}


def payment(identity="payment-1", reference="SYN-1", amount=10000, currency="GHS", transaction="TX-1", status="successful", provider="MTN_MOMO"):
    return {"id": identity, "record_type": "payment", "order_ref": reference, "amount_minor": amount, "currency": currency, "transaction_ref": transaction, "provider_status": status, "provider": provider, "row_hash": identity}


def snapshot(orders=None, payments=None):
    return {"orders": orders or [], "payments": payments or [], "settlements": []}


def test_unique_exact_match_has_source_evidence():
    result = reconcile(snapshot([order()], [payment()]))
    assert len(result["matches"]) == 1
    assert result["matches"][0]["evidence"]["records"] == ["order:order-1", "payment:payment-1"]
    assert result["summary"]["matched_order_value"] == {"GHS": "10000"}
    assert result["discrepancies"] == []


def test_missing_payment_is_an_evidence_gap():
    result = reconcile(snapshot([order()]))
    assert result["summary"]["missing_payment_count"] == 1
    assert result["discrepancies"][0]["type"] == "missing_payment"


def test_partial_payments_are_not_combined():
    result = reconcile(snapshot([order()], [payment(amount=3000), payment(identity="payment-2", amount=7000, transaction="TX-2")]))
    assert result["matches"] == []
    assert result["summary"]["category_counts"] == {"partial_payment": 1, "unmatched_payment": 2}
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "10000"}


def test_ambiguous_candidates_are_never_selected():
    result = reconcile(snapshot([order()], [payment(), payment(identity="payment-2", transaction="TX-2")]))
    assert result["matches"] == []
    assert result["summary"]["category_counts"]["ambiguous_match"] == 1
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "10000"}


def test_payment_cannot_match_two_identical_reference_orders():
    result = reconcile(snapshot([order(), order(identity="order-2")], [payment()]))
    assert result["matches"] == []
    assert result["summary"]["category_counts"]["ambiguous_match"] == 1


def test_duplicate_reference_groups_are_excluded_without_losing_evidence():
    result = reconcile(snapshot([order()], [payment(), payment(identity="payment-2", currency="USD")]))
    assert result["matches"] == []
    assert result["summary"]["total_eligible_payments"] == 0
    assert result["summary"]["duplicate_notification_count"] == 1
    duplicate = next(case for case in result["discrepancies"] if case["type"] == "duplicate_notification")
    assert duplicate["evidence"]["records"] == ["order:order-1", "payment:payment-1", "payment:payment-2"]


def test_currencies_never_match_or_sum_together():
    result = reconcile(snapshot([order()], [payment(currency="USD")]))
    assert result["matches"] == []
    assert result["summary"]["category_counts"]["currency_mismatch"] == 1
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "10000", "USD": "10000"}


def test_unsuccessful_payments_and_cancelled_orders_are_ineligible():
    pending = reconcile(snapshot([order()], [payment(status="pending")]))
    assert pending["matches"] == []
    assert pending["summary"]["missing_payment_count"] == 1
    cancelled = reconcile(snapshot([order(status="cancelled")], [payment()]))
    assert cancelled["matches"] == []
    assert cancelled["summary"]["missing_payment_count"] == 0
    assert cancelled["summary"]["cancelled_orders"] == 1


def test_unknown_reference_can_only_suggest_an_equal_amount_relationship():
    result = reconcile(snapshot([order()], [payment(reference="INCORRECT")]))
    assert result["matches"] == []
    case = next(case for case in result["discrepancies"] if case["type"] == "unmatched_payment")
    assert case["evidence"]["candidates"]["order_ids"] == ["order-1"]
    assert result["summary"]["unresolved_discrepancy_value"] == {"GHS": "10000"}


def test_no_hidden_tolerance():
    result = reconcile(snapshot([order()], [payment(amount=9999)]))
    assert result["matches"] == []
    assert result["summary"]["category_counts"]["partial_payment"] == 1


def test_reconciliation_is_pure_deterministic_and_order_independent():
    inputs = snapshot([order(), order(identity="order-2", reference="SYN-2")], [payment(), payment(identity="payment-2", reference="SYN-2", transaction="TX-2")])
    original = deepcopy(inputs)
    first = reconcile(inputs)
    inputs["orders"].reverse()
    inputs["payments"].reverse()
    assert first == reconcile(inputs)
    inputs["orders"].reverse()
    inputs["payments"].reverse()
    assert inputs == original
    assert len({match["order_id"] for match in first["matches"]}) == len(first["matches"])
    assert len({match["payment_id"] for match in first["matches"]}) == len(first["matches"])
