"""Tier registry. Each tier exposes one entry point that returns Finding[s].

Tier 1 (provenance), Tier 2 (forensic), and Tier 4 (OSINT) are wired here.
Tier 3 (AI deepfake) lands on its own branch. The `/verify` endpoint in
main.py should call `run_tier1(image_bytes, filename)`, `analyze_tier2(image_bytes)`,
and `get_tier4_findings(query, url)`.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from models import Finding
from tiers.t1_c2pa import verify_c2pa
from tiers.t1_exif import parse_exif
from tiers.t1_phash import match_wire_phash
from tiers.t1_reverse_image import reverse_image_search
from tiers.t2_forensic import analyze_tier2
from tiers.t4_interface import get_tier4_findings

__all__ = [
    "run_tier1",
    "verify_c2pa",
    "parse_exif",
    "match_wire_phash",
    "reverse_image_search",
    "analyze_tier2",
    "get_tier4_findings",
]


def run_tier1(image_bytes: bytes, filename: str | None = None) -> list[Finding]:
    """Run every Tier 1 check against an in-memory image.

    Each sub-check is wrapped so one failure cannot crash the whole tier —
    we always return four findings, one per check. Failures surface as
    `result="fail"` findings with the exception in evidence, which is what
    the report should display anyway.
    """
    suffix = Path(filename).suffix if filename else ".bin"
    # `delete=False` so subprocess/c2pa can re-open the path on Windows
    # (handle is still open in NamedTemporaryFile's default mode otherwise).
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(image_bytes)
        tmp.flush()
        tmp.close()
        path = tmp.name

        findings: list[Finding] = []
        for check_name, fn in (
            ("c2pa.signature.verify", lambda: verify_c2pa(path)),
            ("exif.metadata.parse", lambda: parse_exif(path)),
            ("phash.wire_match", lambda: match_wire_phash(path)),
            ("reverse_image.lookup", lambda: reverse_image_search(image_bytes)),
        ):
            try:
                findings.append(fn())
            except Exception as exc:  # noqa: BLE001
                findings.append(
                    Finding(
                        tier=1,
                        check=check_name,
                        result="fail",
                        confidence="deterministic",
                        evidence={"error": f"{type(exc).__name__}: {exc}"},
                        source="self",
                        timestamp=Finding.now(),
                    )
                )
        return findings
    finally:
        try:
            Path(tmp.name).unlink(missing_ok=True)
        except OSError:
            pass
