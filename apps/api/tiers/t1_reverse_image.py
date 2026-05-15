"""Tier 1 — reverse-image search via Bing Visual Search.

Two execution paths, in priority order:

  1. Live Bing query — if `BING_SEARCH_API_KEY` is in the environment, POST
     the image bytes to the Visual Search endpoint and parse hits.
  2. Pre-cached results — if no key, look up `sha256(image_bytes)` in
     `data/reverse_cache.json`. This is the demo path: PLAN.md §9 explicitly
     calls out pre-caching demo-asset reverse hits so the live demo doesn't
     depend on API availability.

Either way the finding declares its source ("bing.reverse_image" or
"bing.reverse_image.cached") so the analyst sees how the hit was obtained.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from models import Finding


BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/images/visualsearch"
TIMEOUT = 20
_CACHE_PATH = Path(__file__).resolve().parents[3] / "data" / "reverse_cache.json"


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


def _parse_bing(payload: dict[str, Any]) -> list[dict]:
    """Extract human-readable hits from Bing's Visual Search response."""
    hits: list[dict] = []
    for tag in payload.get("tags", []) or []:
        for action in tag.get("actions", []) or []:
            if action.get("actionType") != "PagesIncluding":
                continue
            for page in (action.get("data") or {}).get("value", []) or []:
                hits.append({
                    "url": page.get("hostPageUrl"),
                    "thumbnail": page.get("thumbnailUrl"),
                    "name": page.get("name"),
                    "host": page.get("hostPageDomainFriendlyName") or page.get("hostPageDisplayUrl"),
                    "datePublished": page.get("datePublished"),
                })
    return hits


def _live_search(image_bytes: bytes, api_key: str) -> list[dict]:
    files = {"image": ("upload.jpg", image_bytes, "application/octet-stream")}
    resp = requests.post(
        BING_ENDPOINT,
        headers={"Ocp-Apim-Subscription-Key": api_key},
        files=files,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return _parse_bing(resp.json())


def reverse_image_search(
    image_path_or_bytes: str | Path | bytes,
) -> Finding:
    """Reverse-image search the input; prefer live Bing, fall back to cache."""
    if isinstance(image_path_or_bytes, (bytes, bytearray)):
        image_bytes = bytes(image_path_or_bytes)
    else:
        image_bytes = Path(image_path_or_bytes).read_bytes()

    img_hash = hashlib.sha256(image_bytes).hexdigest()
    api_key = os.environ.get("BING_SEARCH_API_KEY")

    hits: list[dict] = []
    source = "bing.reverse_image"
    error: str | None = None

    if api_key:
        try:
            hits = _live_search(image_bytes, api_key)
        except requests.RequestException as exc:
            error = f"bing API error: {exc}"
            # fall through to cache
    else:
        error = "BING_SEARCH_API_KEY not set"

    if not hits:
        cache = _load_cache()
        if img_hash in cache:
            # Authoritative: the cache has an entry for this hash, even if
            # the hit list is empty (i.e. "we checked, nothing surfaced").
            # Clear the live-search error so we don't leak it into evidence.
            hits = cache[img_hash]
            source = "bing.reverse_image.cached"
            error = None

    if error and not hits:
        return Finding(
            tier=1,
            check="reverse_image.lookup",
            result="fail" if api_key else "indeterminate",
            confidence="high",
            evidence={
                "input_sha256": img_hash,
                "error": error,
                "note": "Add demo-asset hits to data/reverse_cache.json keyed by sha256.",
            },
            source=source,
            timestamp=Finding.now(),
        )

    return Finding(
        tier=1,
        check="reverse_image.lookup",
        result="pass" if hits else "indeterminate",
        confidence="high",
        evidence={
            "input_sha256": img_hash,
            "hit_count": len(hits),
            "earliest_seen": _earliest_date(hits),
            "hits": hits[:10],
        },
        source=source,
        timestamp=Finding.now(),
    )
