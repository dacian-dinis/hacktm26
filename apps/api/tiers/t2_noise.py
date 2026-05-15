"""Tier 2 noise-residual analysis for image forensics."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from models import Finding
from tiers.t2_common import finding, png_base64


def analyze_noise_residual(image_bytes: bytes) -> dict[str, Any]:
    """Run a median-blur residual check on image bytes."""
    timestamp = Finding.now()

    try:
        import numpy as np
        from PIL import Image, ImageFilter
    except ImportError as exc:
        return finding(
            check="forensics.noise_residual",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={
                "error": "Noise-residual dependencies are not installed",
                "detail": str(exc),
            },
        )

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        original = np.asarray(image)

        processor = "opencv"
        try:
            import cv2

            blurred = cv2.medianBlur(original, 3)
        except ImportError:
            processor = "pillow"
            blurred_image = image.filter(ImageFilter.MedianFilter(size=3))
            blurred = np.asarray(blurred_image)

        residual = original.astype(np.int16) - blurred.astype(np.int16)
        abs_residual = np.abs(residual).clip(0, 255).astype(np.uint8)

        max_residual = int(abs_residual.max())
        display_scale = 255.0 / max_residual if max_residual > 0 else 1.0
        display_residual = np.clip(
            abs_residual.astype(np.float32) * display_scale, 0, 255
        )
        png = Image.fromarray(display_residual.astype(np.uint8), mode="RGB")

        return finding(
            check="forensics.noise_residual",
            timestamp=timestamp,
            result="indeterminate",
            confidence="medium",
            evidence={
                "residual_png_base64": png_base64(png),
                "method": "3x3 median blur residual",
                "processor": processor,
                "kernel_size": 3,
                "width": image.width,
                "height": image.height,
                "mean_abs_residual": round(float(abs_residual.mean()), 4),
                "max_abs_residual": max_residual,
                "p95_abs_residual": round(float(np.percentile(abs_residual, 95)), 4),
                "display_scale": round(display_scale, 4),
                "interpretation": (
                    "Inconsistent residual texture may indicate local edits; "
                    "analyst review required."
                ),
            },
        )
    except Exception as exc:
        return finding(
            check="forensics.noise_residual",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={
                "error": "Unable to run noise-residual analysis on the supplied image",
                "detail": str(exc),
            },
        )
