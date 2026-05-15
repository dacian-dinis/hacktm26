"""Shared helpers for Tier 2 forensic findings."""

from __future__ import annotations

import base64
from io import BytesIO
from typing import Any


def finding(
    *,
    check: str,
    timestamp: object,
    result: str,
    confidence: str,
    evidence: dict[str, Any],
) -> dict[str, Any]:
    """Build a Finding-shaped dictionary for a Tier 2 check."""
    return {
        "tier": 2,
        "check": check,
        "result": result,
        "confidence": confidence,
        "evidence": evidence,
        "source": "self",
        "timestamp": timestamp,
    }


def png_base64(image: Any) -> str:
    """Encode a Pillow image as an ASCII base64 PNG payload."""
    png_buffer = BytesIO()
    image.save(png_buffer, format="PNG")
    return base64.b64encode(png_buffer.getvalue()).decode("ascii")
