"""Tier 2 error level analysis for image forensics."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from models import Finding
from tiers.t2_common import finding, png_base64


def analyze_ela(image_bytes: bytes) -> dict[str, Any]:
    """Run JPEG recompression error level analysis on image bytes."""
    timestamp = Finding.now()

    try:
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        return finding(
            check="forensics.ela",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={
                "error": "ELA dependencies are not installed",
                "detail": str(exc),
            },
        )

    try:
        original = Image.open(BytesIO(image_bytes)).convert("RGB")

        jpeg_buffer = BytesIO()
        original.save(jpeg_buffer, format="JPEG", quality=95)
        jpeg_buffer.seek(0)

        resaved = Image.open(jpeg_buffer).convert("RGB")

        original_np = np.asarray(original)
        resaved_np = np.asarray(resaved)
        diff = np.abs(
            original_np.astype(np.int16) - resaved_np.astype(np.int16)
        ).astype(np.uint8)

        max_error = int(diff.max())
        display_scale = 255.0 / max_error if max_error > 0 else 1.0
        display_diff = np.clip(diff.astype(np.float32) * display_scale, 0, 255)
        overlay = Image.fromarray(display_diff.astype(np.uint8), mode="RGB")

        return finding(
            check="forensics.ela",
            timestamp=timestamp,
            result="indeterminate",
            confidence="medium",
            evidence={
                "overlay_png_base64": png_base64(overlay),
                "method": "JPEG quality=95 recompression error level analysis",
                "jpeg_quality": 95,
                "width": original.width,
                "height": original.height,
                "mean_channel_error": round(float(diff.mean()), 4),
                "max_channel_error": max_error,
                "p95_channel_error": round(float(np.percentile(diff, 95)), 4),
                "display_scale": round(display_scale, 4),
                "interpretation": (
                    "Bright regions indicate higher recompression error; "
                    "analyst review required."
                ),
            },
        )
    except Exception as exc:
        return finding(
            check="forensics.ela",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={
                "error": "Unable to run ELA on the supplied image",
                "detail": str(exc),
            },
        )
