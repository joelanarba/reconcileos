"""Generate synthetic source files and an independent, scenario-defined oracle."""
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "sample-data" / "demo"


def amount(minor):
    return f"{minor // 100}.{minor % 100:02d}"


def generate():
    TARGET.mkdir(parents=True, exist_ok=True)
    orders, payments, settlements = [], [], []
    for number in range(1, 101):
        orders.append({"order_ref": f"SYN-ORD-{number:04}", "amount": amount(10000 + number * 100), "currency": "GHS", "ordered_at": "2026-10-20T10:00:00Z", "status": "open", "description": f"Synthetic Keta Supply order {number}"})
    for number in range(1, 96):
        reference, value, currency = number, 10000 + number * 100, "GHS"
        if 81 <= number <= 85:
            value -= 1000
        if 86 <= number <= 90:
            reference = f"UNKNOWN-{number}"
        if number == 92:
            value += 500
        if number == 93:
            currency = "USD"
        if number == 95:
            reference, value = 94, 19400
        order_reference = f"SYN-ORD-{reference:04}" if isinstance(reference, int) else reference
        payments.append({"provider": "MTN_MOMO", "transaction_ref": f"SYN-TXN-{number:04}", "order_ref": order_reference, "amount": amount(value), "currency": currency, "paid_at": "2026-10-20T10:05:00Z", "status": "successful", "description": f"Synthetic notification {number}"})
    payments.extend([dict(payments[0]), dict(payments[1])])
    for number, status in ((98, "successful"), (99, "pending"), (100, "failed")):
        payments.append({"provider": "MTN_MOMO", "transaction_ref": f"SYN-TXN-{number:04}", "order_ref": "UNIDENTIFIED" if number == 98 else f"SYN-ORD-{number:04}", "amount": amount(25000 if number == 98 else 10000 + number * 100), "currency": "GHS", "paid_at": "2026-10-20T10:05:00Z", "status": status, "description": f"Synthetic notification {number}"})
    for number in range(1, 91):
        value = 10000 + number * 100 - (1000 if 81 <= number <= 85 else 0)
        fee = value // 100 + (10 if 76 <= number <= 80 else 0)
        settlements.append({"provider": "MTN_MOMO", "settlement_ref": f"SYN-SET-{number:04}", "payment_ref": f"SYN-TXN-{88 if number == 90 else number:04}", "gross_amount": amount(value), "fee_amount": amount(fee), "net_amount": amount(value - fee + (1 if number == 89 else 0)), "currency": "GHS", "settled_at": "2026-10-21T09:00:00Z", "description": f"Synthetic settlement evidence {number}"})
    for source, records in (("orders", orders), ("payments", payments), ("settlements", settlements)):
        with (TARGET / f"{source}.csv").open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=list(records[0]))
            writer.writeheader()
            writer.writerows(records)
    expected = {
        "synthetic": True, "rule_version": "three-source-1", "fee_configuration": "../fee-rules.json",
        "summary": {"total_orders": 100, "cancelled_orders": 0, "total_payment_records": 100, "total_settlement_records": 90, "total_eligible_payments": 94,
                    "total_payment_value": {"GHS": "1386800", "USD": "19300"}, "excluded_duplicate_payment_records": 4, "excluded_duplicate_payment_value": {"GHS": "40600"},
                    "matched_order_count": 79, "matched_order_value": {"GHS": "1122800"}, "matched_settlement_count": 80, "matched_settlement_value": {"GHS": "1127115"}, "match_count": 159,
                    "unresolved_discrepancy_count": 54, "unresolved_discrepancy_value": {"GHS": "515300", "USD": "19300"}, "duplicate_notification_count": 2, "missing_payment_count": 11, "missing_settlement_evidence_count": 7,
                    "category_counts": {"duplicate_notification": 2, "duplicate_import_row": 2, "ambiguous_match": 1, "partial_payment": 5, "amount_mismatch": 1, "currency_mismatch": 1, "unmatched_payment": 15, "missing_payment": 11, "missing_settlement_evidence": 7, "unmatched_settlement": 2, "fee_discrepancy": 5, "settlement_discrepancy": 1, "ambiguous_settlement": 1}},
        "order_payment_numbers": list(range(3, 81)) + [91],
        "payment_settlement_numbers": list(range(3, 76)) + list(range(81, 88)),
    }
    (TARGET / "expected-results.json").write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    print("Generated 100 synthetic orders, 100 payment records, and 90 settlement records.")


if __name__ == "__main__":
    generate()
