from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sheet: str | None = Field(default=None, max_length=160)
    header_row: int | None = Field(default=None, ge=0, le=25)
    column_map: dict[str, str | None] = Field(default_factory=dict, max_length=20)
    default_currency: str = Field(default="GHS", max_length=3)
    default_provider: str = Field(default="", max_length=80)
    default_status: str = Field(default="", max_length=30)
    status_map: dict[str, str] = Field(default_factory=dict, max_length=50)
    default_date: str = Field(default="", max_length=40)
    timezone: str = Field(default="Africa/Accra", max_length=80)
    date_order: Literal["DMY", "MDY"] = "DMY"
    decimal_style: Literal["auto", "dot", "comma"] = "auto"
    amount_unit: Literal["major", "minor"] = "major"
    allow_cached_formulas: bool = False
    corrections: dict[str, dict[str, str]] = Field(default_factory=dict, max_length=10000)
    excluded_rows: list[int] = Field(default_factory=list, max_length=10000)
    reason: str = Field(default="", max_length=2000)
    expected_revision: int | None = Field(default=None, ge=1)

    @field_validator("corrections")
    @classmethod
    def bounded_corrections(cls, value):
        for row_number, fields in value.items():
            if not row_number.isdecimal() or len(fields) > 20 or any(len(text) > 2000 for text in fields.values()):
                raise ValueError("Corrections must identify a source row and contain bounded text values.")
        return value
