"""Tier 1 — C2PA manifest verification.

This is the only check in the entire stack that can claim *deterministic*
confidence: signature verification is a mathematical property of the file's
bytes, not a probability. That is the headline differentiator from
classifier-based competitors. See PLAN.md §1 ("Provenance over prediction").

Three outcomes:
  - pass:           a manifest is embedded and cryptographically valid
  - fail:           a manifest is embedded but tampered / signature broken
  - indeterminate:  no manifest at all (the common 2026 case — still a finding)
"""

from __future__ import annotations

import json
from pathlib import Path

import c2pa

from models import Finding


def _extract_signer_summary(manifest_json: dict) -> dict:
    """Pull the bits an analyst actually reads from the full c2pa JSON."""
    summary: dict = {}
    active_id = manifest_json.get("active_manifest")
    manifests = manifest_json.get("manifests", {})
    active = manifests.get(active_id, {}) if active_id else {}

    summary["claim_generator"] = active.get("claim_generator")
    summary["title"] = active.get("title")
    summary["format"] = active.get("format")
    summary["instance_id"] = active.get("instance_id")

    sig_info = active.get("signature_info") or {}
    summary["signer"] = {
        "issuer": sig_info.get("issuer"),
        "cert_serial_number": sig_info.get("cert_serial_number"),
        "time": sig_info.get("time"),
        "alg": sig_info.get("alg"),
    }

    actions: list[str] = []
    for assertion in active.get("assertions", []) or []:
        if assertion.get("label", "").startswith("c2pa.actions"):
            for action in (assertion.get("data") or {}).get("actions", []) or []:
                a = action.get("action")
                if a:
                    actions.append(a)
    summary["actions"] = actions

    summary["ingredient_count"] = len(active.get("ingredients", []) or [])
    return summary


def verify_c2pa(image_path: str | Path) -> Finding:
    """Verify the C2PA manifest embedded in an image, if any."""
    path = str(image_path)

    try:
        reader = c2pa.Reader(path)
    except c2pa.C2paError.ManifestNotFound:
        return Finding(
            tier=1,
            check="c2pa.signature.verify",
            result="indeterminate",
            confidence="deterministic",
            evidence={
                "manifest_present": False,
                "note": (
                    "No C2PA manifest embedded. Provenance must be established "
                    "through other tiers (reverse image, OSINT, EXIF)."
                ),
            },
            source="self",
            timestamp=Finding.now(),
        )
    except c2pa.C2paError.NotSupported as exc:
        return Finding(
            tier=1,
            check="c2pa.signature.verify",
            result="indeterminate",
            confidence="deterministic",
            evidence={
                "manifest_present": False,
                "error": f"format not supported by c2pa-rs: {exc}",
            },
            source="self",
            timestamp=Finding.now(),
        )
    except c2pa.C2paError as exc:
        return Finding(
            tier=1,
            check="c2pa.signature.verify",
            result="fail",
            confidence="deterministic",
            evidence={"manifest_present": True, "error": f"{type(exc).__name__}: {exc}"},
            source="self",
            timestamp=Finding.now(),
        )

    try:
        manifest_json = json.loads(reader.json())
        validation_state = str(reader.get_validation_state())
        is_valid = bool(reader.is_valid())
        is_embedded = bool(reader.is_embedded())
        signer_summary = _extract_signer_summary(manifest_json)
    finally:
        reader.close()

    evidence: dict = {
        "manifest_present": True,
        "is_embedded": is_embedded,
        "validation_state": validation_state,
        **signer_summary,
    }

    return Finding(
        tier=1,
        check="c2pa.signature.verify",
        result="pass" if is_valid else "fail",
        confidence="deterministic",
        evidence=evidence,
        source="self",
        timestamp=Finding.now(),
    )
