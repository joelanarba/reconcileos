from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"
PROVIDERS = ("MTN_MOMO", "TELECEL_CASH", "BANK_TRANSFER", "PAYMENT_GATEWAY")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")

    database_url: str = "sqlite:///./data/reconcileos.db"
    app_mode: Literal["local"] = "local"
    local_operator: str = Field(default="Local operator", min_length=3, max_length=80)
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    max_upload_bytes: int = Field(default=10485760, ge=1024, le=10485760)
    max_import_rows: int = Field(default=10000, ge=1, le=10000)
    fee_rules_path: str | None = None
