"""Pydantic models for the Veritas Stack evidence chain.

The `Finding` shape is the contract every tier (T1-T4) emits. The frontend
renders these — no business logic lives in the UI. Keep this file in sync with
`apps/web/types/report.ts`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


Tier = Literal[1, 2, 3, 4]
Result = Literal["pass", "fail", "indeterminate"]
Confidence = Literal["deterministic", "high", "medium", "low"]


def _to_native(value: Any) -> Any:
    """Recursively coerce numpy / non-JSON-native scalars to Python types.

    Defensive: tiers should already return native types, but numpy types
    sneak in via imagehash, opencv, etc. Without this any np.int64 in
    evidence kills pydantic's JSON serializer.
    """
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, dict):
        return {str(k): _to_native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_native(v) for v in value]
    # numpy duck-typing: scalar arrays have .item(); arrays have .tolist().
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return _to_native(item())
        except Exception:  # noqa: BLE001
            pass
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        try:
            return _to_native(tolist())
        except Exception:  # noqa: BLE001
            pass
    return str(value)


class Finding(BaseModel):
    tier: Tier
    check: str
    result: Result
    confidence: Confidence
    evidence: dict[str, Any] = Field(default_factory=dict)
    source: str
    timestamp: datetime

    @field_validator("evidence", mode="before")
    @classmethod
    def _coerce_evidence(cls, v: Any) -> dict[str, Any]:
        if v is None:
            return {}
        if not isinstance(v, dict):
            raise TypeError("evidence must be a dict")
        return {str(k): _to_native(val) for k, val in v.items()}

    @staticmethod
    def now() -> datetime:
        return datetime.now(timezone.utc)


class Report(BaseModel):
    input_hash: str
    findings: list[Finding]
    analyst_signature: Optional[str] = None
    signed_at: Optional[datetime] = None
