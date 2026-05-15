"""Tier 3: AI Signal (Probabilistic) — served by HuggingFace Inference API.

We do NOT load transformers/torch locally. That would pull ~700MB of resident
memory at import time, blowing past Render's 512MB free-tier limit. Instead
this module POSTs the image bytes to api-inference.huggingface.co and parses
the same response shape the local pipeline used to return.

Trade-offs vs. local inference:
  - First request after the model is idle on HF's side: ~30s cold start
    (HF returns 503 with `{"error": "Model X is currently loading"}`).
    Surface as `indeterminate` + caveat. Warm with one request before the demo.
  - Free tier has request quotas (low-thousands/day). Hackathon demo scale is fine.
  - Requires HF_TOKEN in env. Without it the finding still emits, but as
    `indeterminate` with an explanatory note rather than crashing the pipeline.

Hard rule from AGENTS.md: T3 ALWAYS emits `result="indeterminate"`. The
model's label + score live in evidence — interpretation is the analyst's job.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import requests

from models import Finding


HF_MODEL = "Wvolf/ViT_Deepfake_Detection"
HF_ENDPOINT = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"
HF_TIMEOUT = 60


def _confidence_for(score: float) -> str:
    if score > 0.9:
        return "high"
    if score > 0.7:
        return "medium"
    return "low"


def _call_hf(image_bytes: bytes, token: str) -> tuple[int, Any]:
    """Blocking POST to HF Inference API; runs in a worker thread."""
    resp = requests.post(
        HF_ENDPOINT,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
        },
        data=image_bytes,
        timeout=HF_TIMEOUT,
    )
    try:
        payload = resp.json()
    except ValueError:
        payload = {"raw_text": resp.text[:500]}
    return resp.status_code, payload


def _err_finding(message: str, source: str = "self", confidence: str = "low") -> Finding:
    return Finding(
        tier=3,
        check="ai.deepfake.vit",
        result="indeterminate",
        confidence=confidence,
        evidence={
            "model": HF_MODEL,
            "error": message,
            "note": "AI signal not available — analyst proceeds on T1/T2/T4 alone.",
        },
        source=source,
        timestamp=Finding.now(),
    )


async def analyze_t3_ai(image_bytes: bytes) -> Finding:
    """Run the HF deepfake classifier and emit a Tier-3 Finding."""
    token = os.getenv("HF_TOKEN")
    if not token:
        return _err_finding("HF_TOKEN not set in environment")

    try:
        status, payload = await asyncio.to_thread(_call_hf, image_bytes, token)
    except requests.RequestException as exc:
        return _err_finding(f"HF request failed: {exc}", source="huggingface.inference")

    # 503 = model is warming up on HF's side. Common on first call after idle.
    if status == 503:
        msg = payload.get("error") if isinstance(payload, dict) else None
        wait = payload.get("estimated_time") if isinstance(payload, dict) else None
        note = "HF model is cold-starting. Retry in ~30s."
        if wait:
            note = f"HF model warming up (est. {wait:.0f}s). Retry shortly."
        return Finding(
            tier=3,
            check="ai.deepfake.vit",
            result="indeterminate",
            confidence="low",
            evidence={
                "model": HF_MODEL,
                "hf_status": 503,
                "hf_error": msg,
                "note": note,
            },
            source="huggingface.inference",
            timestamp=Finding.now(),
        )

    if status >= 400 or not isinstance(payload, list) or not payload:
        return _err_finding(
            f"HF returned status={status} payload={payload!r}"[:300],
            source="huggingface.inference",
        )

    # payload is a list of {"label": str, "score": float}
    results = sorted(
        [r for r in payload if isinstance(r, dict) and "label" in r and "score" in r],
        key=lambda x: float(x["score"]),
        reverse=True,
    )
    if not results:
        return _err_finding(
            f"HF payload missing label/score: {payload!r}"[:300],
            source="huggingface.inference",
        )

    top = results[0]
    score = float(top["score"])

    return Finding(
        tier=3,
        check="ai.deepfake.vit",
        result="indeterminate",
        confidence=_confidence_for(score),
        evidence={
            "model": HF_MODEL,
            "training_data": "FaceForensics++",
            "model_label": top["label"],
            "model_score": round(score, 4),
            "scores": {r["label"]: round(float(r["score"]), 4) for r in results},
            "note": (
                "AI signal — one input among many. Not authoritative. "
                "Trained on FaceForensics++, which covers face deepfakes but not "
                "scene-level compositing. Analyst integrates with T1/T2/T4 to verdict."
            ),
        },
        source="huggingface.inference",
        timestamp=Finding.now(),
    )
