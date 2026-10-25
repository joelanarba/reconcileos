from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"
PROVIDERS = ("MTN_MOMO", "TELECEL_CASH", "BANK_TRANSFER", "PAYMENT_GATEWAY")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore", hide_input_in_errors=True)

    database_url: str = "sqlite:///./data/reconcileos.db"
    public_demo_database_url: str | None = None
    app_mode: Literal["local", "aws"] = "local"
    local_operator: str = Field(default="Local operator", min_length=3, max_length=80)
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    max_upload_bytes: int = Field(default=10485760, ge=1024, le=10485760)
    max_import_rows: int = Field(default=10000, ge=1, le=10000)
    fee_rules_path: str | None = None
    llm_base_url: str | None = None
    llm_api_key: SecretStr | None = None
    llm_model: str | None = Field(default=None, max_length=120)
    llm_timeout_seconds: int = Field(default=20, ge=3, le=45)
    llm_response_format: Literal["json_object", "json_schema"] = "json_object"
    llm_allow_loopback: bool = False
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    cognito_issuer: str | None = None
    cognito_client_id: str | None = None
    cognito_operator_group: str = "reconcileos-operators"
    aws_account_id: str | None = Field(default=None, pattern=r"^[0-9]{12}$")
    aws_api_id: str | None = Field(default=None, pattern=r"^[a-z0-9]{6,30}$")

    @model_validator(mode="after")
    def validate_hosted_configuration(self):
        if self.app_mode == "local":
            return self
        import re
        from urllib.parse import urlsplit

        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("AWS mode requires PostgreSQL with Psycopg.")
        try:
            url = make_url(self.database_url)
        except Exception:
            raise ValueError("The hosted database URL is invalid.") from None
        if url.query.get("sslmode") != "verify-full" or not url.query.get("sslrootcert"):
            raise ValueError("AWS PostgreSQL requires full TLS certificate and hostname verification.")
        if not self.cognito_issuer or not re.fullmatch(r"https://cognito-idp\.[a-z0-9-]+\.amazonaws\.com/[A-Za-z0-9_-]+", self.cognito_issuer):
            raise ValueError("AWS mode requires the configured Cognito issuer.")
        if not all((self.cognito_client_id, self.cognito_operator_group, self.aws_account_id, self.aws_api_id)):
            raise ValueError("AWS mode requires the Cognito client, operator group, account, and API identifiers.")
        if not self.allowed_hosts or any(not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+", host) or host in ("localhost", "127.0.0.1", "testserver") for host in self.allowed_hosts):
            raise ValueError("AWS mode requires explicit allowed hosts.")
        if not self.cors_origins or any(urlsplit(origin).scheme != "https" or not urlsplit(origin).hostname or urlsplit(origin).username or urlsplit(origin).password or urlsplit(origin).query or urlsplit(origin).fragment or urlsplit(origin).path not in ("", "/") or "*" in origin for origin in self.cors_origins):
            raise ValueError("AWS mode requires explicit HTTPS browser origins.")
        return self
