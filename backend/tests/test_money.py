import pytest

from app.core.money import expected_fee, parse_amount
from app.core.time import parse_timestamp


@pytest.mark.parametrize("amount,currency,expected", [("125.50", "GHS", 12550), ("0.01", "GHS", 1), ("125", "JPY", 125), ("1.005", "KWD", 1005), ("10000000000.00", "GHS", 1000000000000)])
def test_exact_currency_precision(amount, currency, expected):
    assert parse_amount(amount, currency) == expected


@pytest.mark.parametrize("amount,currency", [("NaN", "GHS"), ("Infinity", "GHS"), ("1e2", "GHS"), ("-1", "GHS"), ("+1", "GHS"), ("1,000", "GHS"), ("", "GHS"), ("0", "GHS"), ("1.000", "GHS"), ("1.0", "JPY"), ("1.0011", "KWD"), ("1", "ZZZ"), ("10000000000.01", "GHS")])
def test_reject_malformed_or_unsupported_amounts(amount, currency):
    with pytest.raises(ValueError):
        parse_amount(amount, currency)


def test_integer_arithmetic_and_half_up_fee():
    assert parse_amount("0.10", "GHS") + parse_amount("0.20", "GHS") == 30
    assert expected_fee(100, 50) == 1
    assert expected_fee(99, 50) == 0
    assert expected_fee(12550, 150, 10) == 198
    assert parse_amount("0.00", "GHS", allow_zero=True) == 0
    with pytest.raises(ValueError):
        expected_fee(100.0, 50)


def test_timestamps_require_timezone_and_normalize_utc():
    assert parse_timestamp("2026-10-20T10:00:00+01:00").isoformat() == "2026-10-20T09:00:00+00:00"
    with pytest.raises(ValueError):
        parse_timestamp("2026-10-20T10:00:00")
