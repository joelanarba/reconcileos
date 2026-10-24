from collections import Counter, defaultdict

from app.core.money import expected_fee
from app.services.imports.csv_parser import content_hash


RULE_VERSION = "three-source-1"


def record_key(record: dict) -> str:
    return record["record_type"] + ":" + record["id"]


def payment_key(payment: dict) -> str:
    return payment["provider"] + ":" + payment["transaction_ref"]


def money_totals(records, field):
    totals = defaultdict(int)
    for record in records:
        totals[record["currency"]] += int(record[field])
    return {currency: str(amount) for currency, amount in sorted(totals.items())}


def affected_value(snapshot: dict, cases: list, matches: list) -> dict:
    records = {record_key(record): record for source in ("orders", "payments", "settlements") for record in snapshot.get(source, [])}
    parents = {key: key for key in records}

    def root(key):
        while parents[key] != key:
            parents[key] = parents[parents[key]]
            key = parents[key]
        return key

    def connect(keys):
        existing = sorted(key for key in keys if key in parents)
        for key in existing[1:]:
            first_root, other_root = root(existing[0]), root(key)
            parents[max(first_root, other_root)] = min(first_root, other_root)

    active_keys = set()
    for case in cases:
        if case.get("status", "open") == "resolved":
            continue
        keys = case["evidence"]["records"]
        active_keys.update(keys)
        connect(keys)
    for match in matches:
        connect(match["evidence"]["records"])
    active_roots = {root(key) for key in active_keys if key in parents}
    groups = defaultdict(list)
    for key, record in records.items():
        group_root = root(key)
        if group_root in active_roots:
            groups[(group_root, record["currency"])].append(record)
    totals = defaultdict(int)
    for (_, currency), group in groups.items():
        orders = [record for record in group if record["record_type"] == "order" and record["status"] != "cancelled"]
        payments = [record for record in group if record["record_type"] == "payment"]
        if orders:
            totals[currency] += sum(int(record["expected_minor"]) for record in orders)
        elif payments:
            by_transaction = defaultdict(int)
            for record in payments:
                by_transaction[payment_key(record)] = max(by_transaction[payment_key(record)], int(record["amount_minor"]))
            totals[currency] += sum(by_transaction.values())
        else:
            totals[currency] += sum(int(record["gross_minor"]) for record in group if record["record_type"] == "settlement")
    return {currency: str(amount) for currency, amount in sorted(totals.items())}


def summarize(snapshot: dict, matches: list, cases: list, eligible: list, duplicate_count: int) -> dict:
    orders = {record["id"]: record for record in snapshot["orders"]}
    matched_orders = {match["order_id"] for match in matches if match["kind"] == "order_payment"}
    settlements = {record["id"]: record for record in snapshot.get("settlements", [])}
    matched_settlements = {match["settlement_id"] for match in matches if match["kind"] == "payment_settlement"}
    unresolved = [case for case in cases if case.get("status", "open") != "resolved"]
    eligible_ids = {payment["id"] for payment in eligible}
    excluded = [payment for payment in snapshot["payments"] if payment["provider_status"] == "successful" and payment["id"] not in eligible_ids]
    return {
        "total_orders": len(orders),
        "cancelled_orders": sum(order["status"] == "cancelled" for order in orders.values()),
        "total_payment_records": len(snapshot["payments"]),
        "total_eligible_payments": len(eligible),
        "total_payment_value": money_totals(eligible, "amount_minor"),
        "excluded_duplicate_payment_records": len(excluded),
        "excluded_duplicate_payment_value": money_totals(excluded, "amount_minor"),
        "matched_order_count": len(matched_orders),
        "matched_order_value": money_totals([orders[order_id] for order_id in sorted(matched_orders)], "expected_minor"),
        "match_count": len(matches),
        "total_settlement_records": len(settlements),
        "matched_settlement_count": len(matched_settlements),
        "matched_settlement_value": money_totals([settlements[key] for key in sorted(matched_settlements)], "net_minor"),
        "missing_settlement_evidence_count": len({case["payment_id"] for case in unresolved if case["type"] == "missing_settlement_evidence"}),
        "unresolved_discrepancy_count": len(unresolved),
        "unresolved_discrepancy_value": affected_value(snapshot, cases, matches),
        "duplicate_notification_count": duplicate_count,
        "missing_payment_count": len({case["order_id"] for case in unresolved if case["type"] == "missing_payment"}),
        "category_counts": dict(sorted(Counter(case["type"] for case in unresolved).items())),
    }


def reconcile_orders(snapshot: dict) -> dict:
    orders = sorted(snapshot["orders"], key=lambda record: record["id"])
    payments = sorted(snapshot["payments"], key=lambda record: record["id"])
    cases = {}
    matches = []

    def add_case(case_type, description, related, *, severity="medium", rule=None, candidates=None):
        linked = sorted({record_key(record) for record in related})
        case_key = content_hash([case_type, linked])
        primary = {kind + "_id": next((record["id"] for record in related if record["record_type"] == kind), None) for kind in ("order", "payment", "settlement")}
        cases[case_key] = {"case_key": case_key, "type": case_type, "severity": severity, "description": description, "status": "open", **primary,
                           "evidence": {"records": linked, "rule": rule or description, "candidates": candidates or {}}}

    active_orders = [order for order in orders if order["status"] != "cancelled"]
    orders_by_ref = defaultdict(list)
    for order in active_orders:
        orders_by_ref[order["order_ref"]].append(order)
    grouped_payments = defaultdict(list)
    for payment in payments:
        grouped_payments[payment_key(payment)].append(payment)
    blocked_ids = set()
    duplicate_count = 0
    for key in sorted(grouped_payments):
        group = grouped_payments[key]
        if len(group) > 1:
            blocked_ids.update(payment["id"] for payment in group)
            duplicate_count += len(group) - 1
            related_orders = {order["id"]: order for payment in group for order in orders_by_ref.get(payment["order_ref"], [])}
            add_case("duplicate_notification", "Repeated provider transaction references require review. All members are excluded from automatic allocation.", group + list(related_orders.values()))
    for source in (orders, payments):
        duplicate_rows = defaultdict(list)
        for record in source:
            duplicate_rows[record["row_hash"]].append(record)
        for row_hash in sorted(duplicate_rows):
            if len(duplicate_rows[row_hash]) > 1:
                add_case("duplicate_import_row", "Identical imported rows were retained as source evidence.", duplicate_rows[row_hash], severity="low")

    successful = [payment for payment in payments if payment["provider_status"] == "successful"]
    eligible = [payment for payment in successful if payment["id"] not in blocked_ids]
    order_groups = defaultdict(list)
    payment_groups = defaultdict(list)
    for order in active_orders:
        order_groups[(order["order_ref"], order["currency"], int(order["expected_minor"]))].append(order)
    for payment in eligible:
        payment_groups[(payment["order_ref"], payment["currency"], int(payment["amount_minor"]))].append(payment)
    matched_order_ids, matched_payment_ids, ambiguous_order_ids = set(), set(), set()
    for key in sorted(order_groups):
        order_candidates = order_groups[key]
        payment_candidates = payment_groups.get(key, [])
        if not payment_candidates:
            continue
        if len(order_candidates) == len(payment_candidates) == 1:
            order, payment = order_candidates[0], payment_candidates[0]
            matched_order_ids.add(order["id"])
            matched_payment_ids.add(payment["id"])
            matches.append({"kind": "order_payment", "order_id": order["id"], "payment_id": payment["id"], "settlement_id": None, "origin": "automatic",
                            "evidence": {"records": sorted([record_key(order), record_key(payment)]), "rule": "Unique order reference, equal currency and amount, successful payment, and no conflicting allocation."}})
        else:
            ambiguous_order_ids.update(order["id"] for order in order_candidates)
            add_case("ambiguous_match", "Multiple exact candidates exist. No relationship was selected automatically.", order_candidates + payment_candidates,
                     candidates={"order_ids": [order["id"] for order in order_candidates], "payment_ids": [payment["id"] for payment in payment_candidates]})
    successful_by_ref = defaultdict(list)
    for payment in successful:
        successful_by_ref[payment["order_ref"]].append(payment)
    for order in active_orders:
        if order["id"] in matched_order_ids or order["id"] in ambiguous_order_ids:
            continue
        related = successful_by_ref.get(order["order_ref"], [])
        if not related:
            add_case("missing_payment", "No successful payment with this order reference exists in the input snapshot.", [order], severity="high")
            continue
        compatible = [payment for payment in related if payment["currency"] == order["currency"] and payment["id"] not in blocked_ids]
        partial = [payment for payment in compatible if int(payment["amount_minor"]) < int(order["expected_minor"])]
        excessive = [payment for payment in compatible if int(payment["amount_minor"]) > int(order["expected_minor"])]
        different_currency = [payment for payment in related if payment["currency"] != order["currency"]]
        if partial:
            add_case("partial_payment", "Related payment amounts are below the expected order amount. Partial payments are not combined automatically.", [order] + partial)
        if excessive:
            add_case("amount_mismatch", "Related payment amounts exceed the expected order amount.", [order] + excessive, severity="high")
        if different_currency:
            add_case("currency_mismatch", "Order and payment references agree but currencies differ. No conversion or automatic match is permitted.", [order] + different_currency, severity="high")
    for payment in eligible:
        if payment["id"] in matched_payment_ids:
            continue
        related_orders = orders_by_ref.get(payment["order_ref"], [])
        candidates = related_orders or [order for order in active_orders if order["id"] not in matched_order_ids and order["currency"] == payment["currency"] and int(order["expected_minor"]) == int(payment["amount_minor"])]
        reason = "Successful payment has no accepted exact order match."
        if not related_orders:
            reason += " Its order reference is absent or does not identify an active order. Equal amounts only suggest a relationship for human review."
        add_case("unmatched_payment", reason, [payment] + candidates,
                 candidates={"order_ids": [order["id"] for order in candidates], "payment_ids": [payment["id"]]})
    case_list = [cases[key] for key in sorted(cases)]
    return {"matches": matches, "discrepancies": case_list, "summary": summarize(snapshot, matches, case_list, eligible, duplicate_count)}


def eligible_payments(snapshot):
    counts = Counter(payment_key(payment) for payment in snapshot["payments"])
    return [payment for payment in snapshot["payments"] if payment["provider_status"] == "successful" and counts[payment_key(payment)] == 1]


def reconcile(snapshot: dict) -> dict:
    result = reconcile_orders(snapshot)
    cases = {case["case_key"]: case for case in result["discrepancies"]}
    matches = result["matches"]
    eligible = sorted(eligible_payments(snapshot), key=lambda record: record["id"])
    settlements = sorted(snapshot.get("settlements", []), key=lambda record: record["id"])
    by_reference, payments_by_reference = defaultdict(list), defaultdict(list)
    for settlement in settlements:
        if settlement.get("payment_ref"):
            by_reference[settlement["provider"] + ":" + settlement["payment_ref"]].append(settlement)
    for payment in sorted(snapshot["payments"], key=lambda record: record["id"]):
        payments_by_reference[payment_key(payment)].append(payment)

    def add_case(kind, description, related, *, candidates=None, details=None, severity="medium"):
        linked = sorted({record_key(record) for record in related})
        key = content_hash([kind, linked])
        primary = {record_type + "_id": next((record["id"] for record in related if record["record_type"] == record_type), None) for record_type in ("order", "payment", "settlement")}
        cases[key] = {"case_key": key, "type": kind, "description": description, "severity": severity, "status": "open", **primary,
                      "evidence": {"records": linked, "rule": description, "candidates": candidates or {}, "details": details or {}}}

    examined = set()
    fee_rules = snapshot.get("fee_configuration", {}).get("rules", {})
    for payment in eligible:
        related = by_reference.get(payment_key(payment), [])
        if not related:
            add_case("missing_settlement_evidence", "No settlement record identifies this provider transaction. This is an evidence gap, not proof of a failed settlement.", [payment])
            continue
        examined.update(record["id"] for record in related)
        if len(related) != 1:
            add_case("ambiguous_settlement", "Multiple settlement records identify the same provider transaction. No settlement was allocated automatically.", [payment] + related,
                     candidates={"payment_ids": [payment["id"]], "settlement_ids": [record["id"] for record in related]})
            continue
        settlement = related[0]
        if settlement["currency"] != payment["currency"] or int(settlement["gross_minor"]) != int(payment["amount_minor"]) or int(settlement["gross_minor"]) - int(settlement["fee_minor"]) != int(settlement["net_minor"]):
            add_case("settlement_discrepancy", "Provider and transaction reference agree, but currency, gross amount, or the gross-minus-fee equation differs. No amount tolerance or currency conversion is applied.", [payment, settlement], severity="high")
            continue
        rule = fee_rules.get(payment["provider"], {}).get(payment["currency"])
        if rule is None:
            add_case("fee_rule_missing", "Settlement evidence exists, but no fee rule is configured for this provider and currency. An exact settlement match cannot be confirmed.", [payment, settlement])
            continue
        expected = expected_fee(int(settlement["gross_minor"]), rule["basis_points"], rule["fixed_minor"])
        details = {"fee_rule": rule, "expected_fee_minor": expected, "recorded_fee_minor": int(settlement["fee_minor"])}
        if int(settlement["fee_minor"]) != expected:
            add_case("fee_discrepancy", "Recorded settlement fee differs from the configured expectation. The recorded gross, fee, and net amounts remain unchanged.", [payment, settlement], details=details)
            continue
        matches.append({"kind": "payment_settlement", "order_id": None, "payment_id": payment["id"], "settlement_id": settlement["id"], "origin": "automatic",
                        "evidence": {"records": sorted([record_key(payment), record_key(settlement)]), "rule": "Unique provider transaction reference, equal currency and gross, exact configured fee, and net equal to gross minus fee.", "details": details}})
    for settlement in settlements:
        if settlement["id"] not in examined:
            related = payments_by_reference.get(settlement["provider"] + ":" + (settlement.get("payment_ref") or ""), [])
            add_case("unmatched_settlement", "Settlement has no reliable eligible payment. Missing references, ineligible statuses, and repeated payment notifications require human review.", [settlement] + related)
    rows = defaultdict(list)
    for settlement in settlements:
        rows[settlement["row_hash"]].append(settlement)
    for group in rows.values():
        if len(group) > 1:
            add_case("duplicate_import_row", "Identical imported settlement rows were retained as source evidence.", group, severity="low")
    case_list = [cases[key] for key in sorted(cases)]
    matches.sort(key=lambda match: (match["kind"], match["payment_id"], match.get("order_id") or "", match.get("settlement_id") or ""))
    return {"matches": matches, "discrepancies": case_list, "summary": summarize(snapshot, matches, case_list, eligible, result["summary"]["duplicate_notification_count"])}
