from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Text500 = Annotated[str, Field(min_length=1, max_length=500)]


class AIExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    discrepancy_id: str = Field(min_length=1, max_length=36)
    proposed_explanation: str = Field(min_length=1, max_length=2000)
    supporting_record_ids: list[Annotated[str, Field(min_length=1, max_length=80)]] = Field(min_length=1, max_length=20)
    confidence_classification: Literal["low", "medium", "high"]
    alternative_explanations: list[Text500] = Field(max_length=5)
    suggested_next_action: str = Field(min_length=1, max_length=1000)
    limitations: list[Text500] = Field(min_length=1, max_length=10)


class AIRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    consent_to_send_evidence: Literal[True]
    expected_version: int = Field(ge=1)
