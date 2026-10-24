import re
from decimal import Decimal


PRECISION = {"GHS": 2, "USD": 2, "EUR": 2, "GBP": 2, "JPY": 0, "KWD": 3}
MAX_MINOR = 1_000_000_000_000


def parse_amount(value: str, currency: str, *, allow_zero: bool = False) -> int:
    if currency not in PRECISION:
        raise ValueError("Unsupported currency. Use GHS, USD, EUR, GBP, JPY, or KWD.")
    text = value.strip()
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", text):
        raise ValueError("Use an ordinary non-negative decimal amount without symbols or separators.")
    fraction = text.partition(".")[2]
    if len(fraction) > PRECISION[currency]:
        raise ValueError(f"{currency} permits at most {PRECISION[currency]} fractional digits.")
    if len(text) > 30:
        raise ValueError("Amount exceeds the supported limit.")
    minor = int(Decimal(text) * (10 ** PRECISION[currency]))
    if minor > MAX_MINOR or minor < (0 if allow_zero else 1):
        raise ValueError("Amount is outside the supported range.")
    return minor


def expected_fee(gross_minor: int, basis_points: int, fixed_minor: int = 0) -> int:
    if any(type(value) is not int for value in (gross_minor, basis_points, fixed_minor)):
        raise ValueError("Fee inputs must be integers.")
    if min(gross_minor, basis_points, fixed_minor) < 0:
        raise ValueError("Fee inputs must be non-negative integers.")
    return (gross_minor * basis_points + 5000) // 10000 + fixed_minor
