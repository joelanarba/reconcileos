import hashlib
import json
import re

from app.core.money import PRECISION, parse_amount
from app.core.time import parse_timestamp


TEMPLATES = {
    "orders": ["order_ref", "amount", "currency", "ordered_at", "status", "description"],
    "payments": ["provider", "transaction_ref", "order_ref", "amount", "currency", "paid_at", "status", "description"],
}


def content_hash(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def identifier(value: str, *, optional: bool = False) -> str | None:
    cleaned = value.strip()
    if not cleaned and optional:
        return None
    if not cleaned or len(cleaned) > 128 or any(ord(character) < 32 or ord(character) == 127 for character in cleaned):
        raise ValueError("Use a non-empty reference of at most 128 characters without control characters.")
    return cleaned


def parse_row(raw: dict, source_type: str):
    parsed = {}
    errors = []

    def field(name, parser, target=None):
        try:
            parsed[target or name] = parser(raw.get(name, ""))
        except ValueError as error:
            errors.append({"field": name, "message": str(error)})

    field("currency", lambda value: value.strip().upper())
    currency = parsed.get("currency", "")
    if currency not in PRECISION:
        errors.append({"field": "currency", "message": "Unsupported currency. Use GHS, USD, EUR, GBP, JPY, or KWD."})
    field("amount", lambda value: parse_amount(value, currency), "expected_minor" if source_type == "orders" else "amount_minor")
    date_field = "ordered_at" if source_type == "orders" else "paid_at"
    field(date_field, lambda value: parse_timestamp(value).isoformat())
    field("description", lambda value: value.strip())
    if len(parsed.get("description", "")) > 500:
        errors.append({"field": "description", "message": "Description must contain at most 500 characters."})
    status = raw.get("status", "").strip().lower()
    allowed = ("open", "completed", "cancelled") if source_type == "orders" else ("successful", "pending", "failed", "reversed")
    if status not in allowed:
        errors.append({"field": "status", "message": "Supported statuses: " + ", ".join(allowed) + "."})
    parsed["status" if source_type == "orders" else "provider_status"] = status
    field("order_ref", lambda value: identifier(value, optional=source_type == "payments"))
    if source_type == "payments":
        field("transaction_ref", identifier)
        provider = raw.get("provider", "").strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9_]{0,29}", provider):
            errors.append({"field": "provider", "message": "Identify the payment provider using the mapping settings or a source column."})
        parsed["provider"] = provider
    return parsed, errors
