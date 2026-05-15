"""Tier 1 — perceptual hash match against the wire-service seed DB.

A pHash/dHash collision against a known wire-service photo is *evidence*: the
analyst still decides what it means (image reused, miscaptioned, etc.), but the
match itself is mathematical, not probabilistic — hence "high" confidence even
though it is not "deterministic" (Hamming threshold is a tuning choice).
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Optional

import imagehash
from PIL import Image

from models import Finding


# 64-bit pHash → 0..64 Hamming distance. <=10 is a confident perceptual match
# in the imagehash docs and matches what TinEye/Bellingcat workflows use.
DEFAULT_HAMMING_THRESHOLD = 10

_DEFAULT_DB = Path(__file__).resolve().parents[3] / "data" / "wire_phashes.json"


def _load_db(db_path: Path) -> list[dict]:
    if not db_path.exists():
        return []
    with db_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _hex_to_hash(hex_str: str) -> imagehash.ImageHash:
    return imagehash.hex_to_hash(hex_str)


def _load_image(image_path: str | Path | bytes) -> Image.Image:
    if isinstance(image_path, (bytes, bytearray)):
        return Image.open(io.BytesIO(image_path))
    return Image.open(str(image_path))


def match_wire_phash(
    image_path: str | Path | bytes,
    db_path: str | Path | None = None,
    threshold: int = DEFAULT_HAMMING_THRESHOLD,
) -> Finding:
    """Compute pHash + dHash for the input and look for wire-service matches."""
    db_file = Path(db_path) if db_path else _DEFAULT_DB
    db = _load_db(db_file)

    try:
        img = _load_image(image_path)
        # Pillow lazy-loads — force decode so a corrupt file fails here, not later.
        img.load()
        phash = imagehash.phash(img)
        dhash = imagehash.dhash(img)
    except Exception as exc:  # noqa: BLE001 — surface decode errors as fail
        return Finding(
            tier=1,
            check="phash.wire_match",
            result="fail",
            confidence="deterministic",
            evidence={"error": f"could not decode image: {exc!s}"},
            source="self",
            timestamp=Finding.now(),
        )

    best: Optional[dict] = None
    best_distance = 65  # max possible + 1
    for entry in db:
        if "phash" not in entry:
            continue
        distance = phash - _hex_to_hash(entry["phash"])
        if distance < best_distance:
            best_distance = distance
            best = entry

    evidence: dict = {
        "input_phash": str(phash),
        "input_dhash": str(dhash),
        "db_size": len(db),
        "threshold": threshold,
    }

    if best is None:
        # Empty DB — surface that so the analyst knows the check didn't run blind.
        evidence["note"] = "wire seed DB is empty; run scripts/build_wire_phashes.py"
        return Finding(
            tier=1,
            check="phash.wire_match",
            result="indeterminate",
            confidence="high",
            evidence=evidence,
            source="self",
            timestamp=Finding.now(),
        )

    evidence["best_match"] = {
        "url": best.get("url"),
        "caption": best.get("caption"),
        "hamming_distance": best_distance,
    }

    matched = best_distance <= threshold
    return Finding(
        tier=1,
        check="phash.wire_match",
        result="pass" if matched else "indeterminate",
        confidence="high",
        evidence=evidence,
        source="self",
        timestamp=Finding.now(),
    )
