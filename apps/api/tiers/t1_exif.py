"""Tier 1 — EXIF / metadata parser.

Prefer `exiftool` (subprocess) because it reads every metadata block (EXIF,
IPTC, XMP, MakerNotes) across formats. If the binary is missing — common on
container images during a hackathon — fall back to Pillow's built-in EXIF
reader so the demo still produces a finding instead of a 500.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from PIL import ExifTags, Image

from models import Finding


_EXIFTOOL = shutil.which("exiftool")

# Fields the analyst actually reads. The raw dict goes into evidence.raw so
# nothing is hidden, but these come up to the top of the JSON for the UI.
_HEADLINE_FIELDS = {
    "Make": "camera_make",
    "Model": "camera_model",
    "DateTimeOriginal": "datetime_original",
    "CreateDate": "create_date",
    "GPSLatitude": "gps_lat",
    "GPSLongitude": "gps_lon",
    "Software": "software",
    "Artist": "artist",
    "Copyright": "copyright",
    "ImageDescription": "description",
}


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    headline = {dst: raw[src] for src, dst in _HEADLINE_FIELDS.items() if src in raw}
    return headline


def _via_exiftool(path: str) -> dict[str, Any] | None:
    if not _EXIFTOOL:
        return None
    try:
        proc = subprocess.run(
            [_EXIFTOOL, "-j", "-n", "-G0", path],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list) or not data:
        return None
    # Flatten exiftool's "GroupName:Tag" keys to just "Tag" for the headline
    # lookup, but keep the prefixed form under raw for transparency.
    raw = data[0]
    flat: dict[str, Any] = {}
    for key, value in raw.items():
        if ":" in key:
            _, tag = key.split(":", 1)
        else:
            tag = key
        # Don't clobber a tag that already exists — exiftool emits the same
        # tag under multiple groups; first wins.
        flat.setdefault(tag, value)
    flat["_raw"] = raw
    return flat


def _via_pillow(path: str) -> dict[str, Any] | None:
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            if not exif:
                return {}
            decoded = {ExifTags.TAGS.get(tag, str(tag)): _coerce(value) for tag, value in exif.items()}
            return decoded
    except Exception:  # noqa: BLE001
        return None


def _coerce(value: Any) -> Any:
    """Pillow returns IFDRationals and bytes — make them JSON-serializable."""
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="replace").strip("\x00")
        except Exception:  # noqa: BLE001
            return f"<{len(value)} bytes>"
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        try:
            return float(value)
        except (TypeError, ZeroDivisionError):
            return str(value)
    if isinstance(value, (list, tuple)):
        return [_coerce(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _coerce(v) for k, v in value.items()}
    return value


def parse_exif(image_path: str | Path) -> Finding:
    """Extract normalized EXIF metadata from an image."""
    path = str(image_path)
    via = "exiftool" if _EXIFTOOL else "pillow"

    raw = _via_exiftool(path) if _EXIFTOOL else _via_pillow(path)
    if raw is None and _EXIFTOOL:
        # Binary failed mid-flight — try the fallback.
        raw = _via_pillow(path)
        via = "pillow (exiftool fallback)"

    if raw is None:
        return Finding(
            tier=1,
            check="exif.metadata.parse",
            result="fail",
            confidence="deterministic",
            evidence={"error": "unreadable image", "via": via},
            source="self",
            timestamp=Finding.now(),
        )

    headline = _normalize(raw)

    # Stripped-but-readable images are themselves a finding — propaganda
    # workflows usually scrub metadata before posting. "pass" only if at least
    # one headline field is present; file-level metadata (FileSize, FileType)
    # doesn't count.
    has_any_useful = bool(headline)

    return Finding(
        tier=1,
        check="exif.metadata.parse",
        result="pass" if has_any_useful else "indeterminate",
        confidence="deterministic",
        evidence={
            "via": via,
            "headline": headline,
            "raw": raw.get("_raw", raw),
        },
        source="self",
        timestamp=Finding.now(),
    )
