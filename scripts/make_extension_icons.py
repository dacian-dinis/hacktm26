"""Generate placeholder Veritas Stack extension icons.

Run from repo root with the apps/api venv:
    apps/api/.venv/Scripts/python scripts/make_extension_icons.py

Writes 16/48/128 PNGs to packages/extension/icons/. Replace with a real
designed mark before any public release.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
ICONS = REPO / "packages" / "extension" / "icons"
ICONS.mkdir(parents=True, exist_ok=True)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Deep navy background, subtle radial fade by drawing two circles.
    margin = max(1, size // 16)
    draw.ellipse(
        (margin, margin, size - margin, size - margin),
        fill=(15, 23, 42, 255),
        outline=(99, 102, 241, 255),
        width=max(1, size // 32),
    )
    # "V" mark — Veritas. Draw as two strokes meeting at the bottom-centre.
    cx, cy = size / 2, size / 2
    arm = size * 0.30
    top_y = cy - arm
    bot_y = cy + arm
    stroke = max(2, size // 12)
    draw.line(
        [(cx - arm, top_y), (cx, bot_y)],
        fill=(248, 250, 252, 255),
        width=stroke,
    )
    draw.line(
        [(cx + arm, top_y), (cx, bot_y)],
        fill=(248, 250, 252, 255),
        width=stroke,
    )
    return img


for px in (16, 48, 128):
    out = ICONS / f"icon-{px}.png"
    draw_icon(px).save(out, "PNG")
    print(f"wrote {out.relative_to(REPO)}")
