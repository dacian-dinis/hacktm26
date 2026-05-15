"""Veritas Stack — FastAPI verification skeleton.

Phase 0: `/verify` accepts an image upload and returns a hardcoded sample
`Report` with dummy `Finding`s spanning tiers 1, 2, and 4. Real tier logic
lands in `apps/api/tiers/t{1,2,3,4}_*` and is wired in per-tier branches.

Phase 7 adds `/demo` and `/demo/{slug}` so the frontend can offer
one-click curated demo assets (see `data/demo/`).
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from models import Finding, Report
from tiers import analyze_tier2, get_tier4_findings, run_tier1
from tiers.t3_ai import analyze_t3_ai

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_DIR = REPO_ROOT / "data" / "demo"

DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def _allowed_origins() -> list[str]:
    """Combine the localhost dev origins with anything in CORS_ORIGINS env.

    CORS_ORIGINS is a comma-separated list (deployed Vercel domain + preview
    pattern). Empty entries are dropped.
    """
    extra = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "").split(",")
        if o.strip()
    ]
    return [*DEFAULT_ORIGINS, *extra]


app = FastAPI(title="Veritas Stack API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/verify", response_model=Report)
async def verify(
    file: UploadFile = File(...),
    url: str | None = Form(None),
    query: str | None = Form(None),
) -> Report:
    raw = await file.read()
    input_hash = hashlib.sha256(raw).hexdigest()

    # If no explicit claim query, fall back to the filename so the
    # fact-check tier still has something to search against.
    t4_query = query or file.filename

    findings: list[Finding] = [
        *run_tier1(raw, file.filename),
        *[Finding.model_validate(finding) for finding in analyze_tier2(raw)],
        *get_tier4_findings(query=t4_query, url=url),
    ]

    # Tier 3: AI Signal
    t3_finding = await analyze_t3_ai(raw)
    findings.append(t3_finding)

    return Report(input_hash=input_hash, findings=findings)


def _load_demo_index() -> list[dict]:
    if not DEMO_DIR.exists():
        return []
    entries: list[dict] = []
    for sub in sorted(DEMO_DIR.iterdir()):
        meta_path = sub / "metadata.json"
        if not (sub.is_dir() and meta_path.exists()):
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        entries.append(
            {
                "slug": meta.get("slug", sub.name),
                "title": meta.get("title", sub.name),
                "filename": meta.get("filename", "asset.jpg"),
                "demo_narration": meta.get("demo_narration", ""),
                "expected_findings": meta.get("expected_findings", []),
            }
        )
    return entries


@app.get("/demo")
def list_demo() -> dict:
    """Index of curated demo assets — used by the upload page's quick-load row."""
    return {"items": _load_demo_index()}


@app.get("/demo/{slug}")
def get_demo_asset(slug: str) -> FileResponse:
    """Return the raw bytes of a curated demo asset."""
    target = DEMO_DIR / slug
    meta_path = target / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"Unknown demo slug: {slug}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    filename = meta.get("filename", "asset.jpg")
    asset_path = target / filename
    if not asset_path.exists():
        raise HTTPException(status_code=500, detail=f"Asset bytes missing: {slug}/{filename}")
    return FileResponse(
        asset_path,
        media_type="image/jpeg",
        filename=f"{slug}.jpg",
    )
