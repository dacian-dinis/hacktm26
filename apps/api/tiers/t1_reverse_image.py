"""Tier 1 — reverse-image search via SerpAPI (Google Lens engine).

Microsoft retired the Bing Search APIs on 2025-08-11. We migrated to SerpAPI's
google_lens engine, which proxies Google Lens results. SerpAPI requires a
publicly reachable image URL — it does not accept raw bytes.

Two execution paths, in priority order:

  1. Pre-cached results — `sha256(image_bytes)` looked up in
     `data/reverse_cache.json`. When the hash is present (even with an empty
     hit list), the cache is treated as authoritative. This is how demo-day
     paths get deterministic results without burning live quota.
  2. Live SerpAPI lookup — only fires when the `/verify` call provided a
     `url` field (so we have something publicly hosted to send to Lens) AND
     `SERPAPI_API_KEY` is in the environment. Uploaded-bytes-only verifications
     stay cache-only because we have no temp host to publish the bytes to.

The finding declares its source ("serpapi.google_lens" or
"serpapi.google_lens.cached") so the analyst sees how the hit was obtained.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from models import Finding


SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
TIMEOUT = 20
_CACHE_PATH = Path(__file__).resolve().parents[3] / "data" / "reverse_cache.json"

# Strip key=... / api_key=... from any error string before it lands in evidence.
# Mirrors the redaction in t4_factcheck.py — SerpAPI puts the key on the URL.
_SECRET_QS = re.compile(r"([?&])(api_key|apikey|key|token)=[^&\s]+", re.IGNORECASE)


def _redact(s: str) -> str:
    return _SECRET_QS.sub(r"\1\2=<redacted>", s)


def _load_cache() -> dict[str, list[dict]]:
    if not _CACHE_PATH.exists():
        return {}
    try:
        return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _earliest_date(hits: list[dict]) -> str | None:
    dates: list[str] = []
    for h in hits:
        d = h.get("date_discovered") or h.get("datePublished")
        if not d:
            continue
        try:
            datetime.fromisoformat(d.replace("Z", "+00:00"))
            dates.append(d)
        except ValueError:
            continue
    return min(dates) if dates else None


def _parse_serpapi(payload: dict[str, Any]) -> list[dict]:
    """Extract human-readable hits from SerpAPI's google_lens response.

    SerpAPI returns `visual_matches`: list of {position, title, link, source,
    thumbnail, date, ...}. We normalize to the same shape the cache uses so
    the orchestrator and frontend don't care which path produced the hit.
    """
    hits: list[dict] = []
    for match in payload.get("visual_matches", []) or []:
        link = match.get("link")
        if not link:
            continue
        hits.append({
            "url": link,
            "thumbnail": match.get("thumbnail"),
            "name": match.get("title"),
            "host": match.get("source"),
            "datePublished": match.get("date"),
        })
    return hits


def _live_search(image_url: str, api_key: str) -> list[dict]:
    """Query SerpAPI's google_lens engine for visual matches of `image_url`.

    Caller must guarantee `image_url` is publicly reachable — SerpAPI fetches
    it server-side and feeds it to Google Lens.
    """
    params = {
        "engine": "google_lens",
        "url": image_url,
        "api_key": api_key,
    }
    resp = requests.get(SERPAPI_ENDPOINT, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    return _parse_serpapi(resp.json())


def reverse_image_search(
    image_path_or_bytes: str | Path | bytes,
    image_url: str | None = None,
) -> Finding:
    """Reverse-image search the input.

    Lookup order: pre-cached results (by SHA-256) → live SerpAPI Google Lens
    (only when both `image_url` and `SERPAPI_API_KEY` are present, since Lens
    needs a publicly reachable URL).
    """
    if isinstance(image_path_or_bytes, (bytes, bytearray)):
        image_bytes = bytes(image_path_or_bytes)
    else:
        image_bytes = Path(image_path_or_bytes).read_bytes()

    img_hash = hashlib.sha256(image_bytes).hexdigest()
    api_key = os.environ.get("SERPAPI_API_KEY")

    hits: list[dict] = []
    source = "serpapi.google_lens"
    error: str | None = None

    # 1. Cache first — it's authoritative for any hash we've curated, even
    # when the hit list is intentionally empty (i.e. "we checked, nothing").
    cache = _load_cache()
    cache_hit = img_hash in cache
    if cache_hit:
        hits = cache[img_hash]
        source = "serpapi.google_lens.cached"

    # 2. Live SerpAPI Google Lens — only viable when (a) the cache had no
    # entry for this hash, (b) the caller supplied a public URL (uploaded
    # bytes have nowhere to be reached from), and (c) we have a key.
    if not cache_hit and image_url and api_key:
        try:
            hits = _live_search(image_url, api_key)
        except requests.RequestException as exc:
            error = _redact(f"serpapi error: {exc}")
        else:
            source = "serpapi.google_lens"

    if not cache_hit and not hits:
        skipped_reason: str | None = None
        if error is None:
            if not api_key:
                skipped_reason = "reverse image provider is not configured"
            elif not image_url:
                skipped_reason = "local upload has no public URL for Google Lens"
            else:
                skipped_reason = "no visual matches found"
        return Finding(
            tier=1,
            check="reverse_image.lookup",
            result="indeterminate",
            confidence="medium",
            evidence={
                "input_sha256": img_hash,
                "status": "skipped" if skipped_reason else "provider_error",
                "reason": skipped_reason,
                **({"error": error} if error else {}),
                "interpretation": (
                    "Reverse-image context is unavailable for this submission. "
                    "Treat it as a missing external signal, not as evidence "
                    "for or against authenticity."
                ),
            },
            source=source,
            timestamp=Finding.now(),
        )

    earliest = _earliest_date(hits)
    interpretation = (
        "Image found on prior web pages — confirms the image is not novel. "
        "Compare `earliest_seen` against the claim's timeline: a 1972 origin "
        "for an image presented as 2026-fresh is evidence against the claim, "
        "not for it. Result `pass` here means 'matches found', not 'authentic'."
        if hits
        else "No matches in source. Treat as inconclusive — absence of matches "
             "is not proof of novelty (the cache and provider have finite coverage)."
    )
    return Finding(
        tier=1,
        check="reverse_image.lookup",
        result="pass" if hits else "indeterminate",
        confidence="high",
        evidence={
            "input_sha256": img_hash,
            "hit_count": len(hits),
            "earliest_seen": earliest,
            "hits": hits[:10],
            "interpretation": interpretation,
        },
        source=source,
        timestamp=Finding.now(),
    )
