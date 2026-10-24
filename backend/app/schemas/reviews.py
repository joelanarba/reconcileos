from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["note", "start_review", "resolve", "reopen", "approve_match", "reject_match", "reverse_match"]
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=2000)
    order_id: str | None = Field(default=None, max_length=36)
    payment_id: str | None = Field(default=None, max_length=36)
    match_id: str | None = Field(default=None, max_length=36)

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Document a reason using at least three characters.")
        return value
