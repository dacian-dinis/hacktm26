"""Additional Tier 2 visual maps for the Media Lab."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from models import Finding
from tiers.t2_common import finding, png_base64


def _load_rgb(image_bytes: bytes):
    from PIL import Image

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    max_side = 720
    scale = min(1.0, max_side / max(image.width, image.height))
    if scale < 1.0:
        image = image.resize(
            (max(1, int(image.width * scale)), max(1, int(image.height * scale)))
        )
    return image


def analyze_copy_move_heatmap(image_bytes: bytes) -> dict[str, Any]:
    """Build a simple duplicate-block heatmap for repeated local patches."""
    timestamp = Finding.now()
    try:
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        return finding(
            check="forensics.copy_move_heatmap",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={"error": "Copy-move dependencies are not installed", "detail": str(exc)},
        )

    try:
        image = _load_rgb(image_bytes)
        gray = image.convert("L")
        arr = np.asarray(gray)
        h, w = arr.shape
        block = 24
        stride = 12
        buckets: dict[tuple[int, ...], list[tuple[int, int]]] = {}

        for y in range(0, max(1, h - block + 1), stride):
            for x in range(0, max(1, w - block + 1), stride):
                patch = gray.crop((x, y, min(x + block, w), min(y + block, h)))
                signature = tuple((np.asarray(patch.resize((8, 8))) // 24).astype(int).ravel())
                buckets.setdefault(signature, []).append((x, y))

        heat = np.zeros((h, w), dtype=np.float32)
        duplicate_groups = 0
        for positions in buckets.values():
            if len(positions) < 2:
                continue
            spread = max(
                abs(a[0] - b[0]) + abs(a[1] - b[1])
                for a in positions
                for b in positions
            )
            if spread < block * 2:
                continue
            duplicate_groups += 1
            for x, y in positions[:20]:
                heat[y : min(y + block, h), x : min(x + block, w)] += 1

        if heat.max() > 0:
            heat = heat / heat.max()
        base = np.asarray(image).astype(np.float32)
        overlay = base.copy()
        overlay[..., 0] = np.maximum(overlay[..., 0], heat * 255)
        overlay[..., 1] *= 1 - heat * 0.45
        overlay[..., 2] *= 1 - heat * 0.45
        out = Image.fromarray(np.clip(overlay, 0, 255).astype(np.uint8), mode="RGB")

        return finding(
            check="forensics.copy_move_heatmap",
            timestamp=timestamp,
            result="indeterminate",
            confidence="medium",
            evidence={
                "heatmap_png_base64": png_base64(out),
                "method": "quantized duplicate 24px block scan",
                "duplicate_groups": int(duplicate_groups),
                "interpretation": "Red regions mark repeated local patches for analyst review.",
            },
        )
    except Exception as exc:
        return finding(
            check="forensics.copy_move_heatmap",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={"error": "Unable to build copy-move heatmap", "detail": str(exc)},
        )


def analyze_jpeg_grid_map(image_bytes: bytes) -> dict[str, Any]:
    """Visualize JPEG 8x8 block boundary discontinuities."""
    timestamp = Finding.now()
    try:
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        return finding(
            check="forensics.jpeg_grid_map",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={"error": "JPEG-grid dependencies are not installed", "detail": str(exc)},
        )

    try:
        image = _load_rgb(image_bytes)
        gray = np.asarray(image.convert("L")).astype(np.float32)
        h, w = gray.shape
        grid = np.zeros((h, w), dtype=np.float32)
        for x in range(8, w, 8):
            grid[:, max(0, x - 1) : min(w, x + 1)] = np.abs(gray[:, x - 1 : x] - gray[:, x : x + 1])
        for y in range(8, h, 8):
            grid[max(0, y - 1) : min(h, y + 1), :] = np.maximum(
                grid[max(0, y - 1) : min(h, y + 1), :],
                np.abs(gray[y - 1 : y, :] - gray[y : y + 1, :]),
            )
        if grid.max() > 0:
            grid = grid / grid.max()
        base = np.asarray(image).astype(np.float32) * 0.72
        base[..., 1] = np.maximum(base[..., 1], grid * 255)
        base[..., 2] = np.maximum(base[..., 2], grid * 255)
        out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), mode="RGB")

        return finding(
            check="forensics.jpeg_grid_map",
            timestamp=timestamp,
            result="indeterminate",
            confidence="medium",
            evidence={
                "grid_png_base64": png_base64(out),
                "method": "8x8 JPEG block-boundary discontinuity map",
                "mean_boundary_energy": round(float(grid.mean()), 4),
                "interpretation": "Cyan grid energy highlights compression discontinuities.",
            },
        )
    except Exception as exc:
        return finding(
            check="forensics.jpeg_grid_map",
            timestamp=timestamp,
            result="indeterminate",
            confidence="low",
            evidence={"error": "Unable to build JPEG grid map", "detail": str(exc)},
        )
