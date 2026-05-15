"""Pydantic models for the Veritas Stack evidence chain.

The `Finding` shape is the contract every tier (T1-T4) emits. The frontend
renders these — no business logic lives in the UI. Keep this file in sync with
`apps/web/types/report.ts`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


Tier = Literal[1, 2, 3, 4]
Result = Literal["pass", "fail", "indeterminate"]
Confidence = Literal["deterministic", "high", "medium", "low"]


class Finding(BaseModel):
    tier: Tier
    check: str
    result: Result
    confidence: Confidence
    evidence: dict[str, Any] = Field(default_factory=dict)
    source: str
    timestamp: datetime

    @staticmethod
    def now() -> datetime:
        return datetime.now(timezone.utc)


class Report(BaseModel):
    input_hash: str
    findings: list[Finding]
    analyst_signature: Optional[str] = None
    signed_at: Optional[datetime] = None
