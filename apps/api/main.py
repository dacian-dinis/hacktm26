"""Veritas Stack — FastAPI verification skeleton.

Phase 0: `/verify` accepts an image upload and returns a hardcoded sample
`Report` with dummy `Finding`s spanning tiers 1, 2, and 4. Real tier logic
lands in `apps/api/tiers/t{1,2,3,4}_*` and is wired in per-tier branches.

Phase 7 adds `/demo` and `/demo/{slug}` so the frontend can offer
one-click curated demo assets (see `data/demo/`).
"""

from __future__ import annotations

import hashlib
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from export import ExportRequest, render_pdf, report_sha256, sign_report
from models import Finding, Report
from tiers import analyze_tier2, get_tier4_findings, run_tier1
from tiers.t3_ai import analyze_t3_ai

# URL-only input cap: refuse anything over 25MB to avoid being weaponized
# as a download proxy. Demo images are << 5MB.
_URL_FETCH_MAX_BYTES = 25 * 1024 * 1024
_URL_FETCH_TIMEOUT = 15

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


def _fetch_url_bytes(url: str) -> tuple[bytes, str]:
    """Download an image from a URL with size + content-type guards.

    Returns (raw_bytes, filename). Raises HTTPException on failure so the
    caller can surface it as a clean 4xx rather than a 5xx.
    """
    try:
        resp = requests.get(
            url,
            stream=True,
            timeout=_URL_FETCH_TIMEOUT,
            headers={"User-Agent": "VeritasStack/0.1 (+https://github.com/dacian-dinis/hacktm26)"},
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"URL fetch failed: {exc}")

    content_type = (resp.headers.get("Content-Type") or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"URL did not return an image (Content-Type: {content_type or 'unknown'})",
        )

    buf = bytearray()
    for chunk in resp.iter_content(chunk_size=64 * 1024):
        buf.extend(chunk)
        if len(buf) > _URL_FETCH_MAX_BYTES:
            raise HTTPException(status_code=413, detail="URL fetch exceeds 25MB cap")

    # Derive a filename so the tier1 EXIF / C2PA path-based readers get a hint.
    last = url.rsplit("/", 1)[-1].split("?", 1)[0] or "image"
    if "." not in last:
        ext = content_type.split("/", 1)[1].split(";", 1)[0] or "jpg"
        last = f"{last}.{ext}"
    return bytes(buf), last


@app.post("/verify", response_model=Report)
async def verify(
    file: UploadFile | None = File(None),
    url: str | None = Form(None),
    query: str | None = Form(None),
) -> Report:
    """Run the verification pipeline on either an uploaded image or a URL.

    At least one of `file` or `url` is required. When both are present,
    the uploaded bytes win and `url` is still passed to Tier 4 for source
    reputation / telegram checks.
    """
    if file is not None and file.filename:
        raw = await file.read()
        filename = file.filename
    elif url:
        raw, filename = _fetch_url_bytes(url)
    else:
        raise HTTPException(
            status_code=400, detail="Provide either an uploaded file or a url."
        )

    input_hash = hashlib.sha256(raw).hexdigest()

    # If no explicit claim query, fall back to the filename so the
    # fact-check tier still has something to search against.
    t4_query = query or filename

    findings: list[Finding] = [
        *run_tier1(raw, filename),
        *[Finding.model_validate(finding) for finding in analyze_tier2(raw)],
        *get_tier4_findings(query=t4_query, url=url),
    ]

    # Tier 3: AI Signal
    t3_finding = await analyze_t3_ai(raw)
    findings.append(t3_finding)

    return Report(input_hash=input_hash, findings=findings)


@app.post("/export")
def export(req: ExportRequest) -> StreamingResponse:
    """Sign + render the report as PDF.

    Body: {"report": <Report>, "analyst_name": "..." (optional)}.
    If `analyst_name` is omitted/blank, the PDF is exported unsigned.
    The PDF embeds a `report_sha256` so the served JSON and the printed
    PDF are byte-verifiable against each other.
    """
    signed = sign_report(req.report, req.analyst_name)
    pdf_bytes = render_pdf(signed, report_sha256(signed))
    short = signed.input_hash[:8] or "report"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="veritas_{short}.pdf"'
        },
    )


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
