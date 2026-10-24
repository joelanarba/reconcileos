import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import BACKEND_ROOT
from app.core.errors import AppError
from app.core.money import MAX_MINOR, PRECISION
from app.services.imports.mapping import normalize_provider


class FeeRule(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    basis_points: int = Field(ge=0, le=10000)
    fixed_minor: int = Field(default=0, ge=0, le=MAX_MINOR)


class FeeConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(max_length=120)
    synthetic: bool = False
    rules: dict[str, dict[str, FeeRule]]


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Repeated configuration keys are not permitted.")
        result[key] = value
    return result


def fee_configuration(settings):
    if not settings.fee_rules_path:
        return {"name": "No fee rules configured", "synthetic": False, "rules": {}}
    path = Path(settings.fee_rules_path)
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    try:
        with path.open("rb") as source:
            content = source.read(65537)
        if len(content) > 65536:
            raise ValueError("Fee configuration exceeds the supported limit.")
        configuration = FeeConfiguration.model_validate(json.loads(content, object_pairs_hook=unique_keys))
        if len(configuration.rules) > 100:
            raise ValueError("Too many configured providers.")
        rules = {}
        for provider, currencies in configuration.rules.items():
            normalized = normalize_provider(provider)
            if not normalized or len(normalized) > 30 or normalized in rules:
                raise ValueError("Provider keys are ambiguous or invalid.")
            if any(currency not in PRECISION for currency in currencies):
                raise ValueError("Fee rules contain an unsupported currency.")
            rules[normalized] = {currency: rule.model_dump() for currency, rule in currencies.items()}
        return {"name": configuration.name, "synthetic": configuration.synthetic, "rules": rules}
    except (OSError, ValueError, ValidationError) as error:
        raise AppError("invalid_fee_configuration", "Fee configuration could not be validated. Review the server's fee-rule file; no default fees were assumed.", 409) from error
