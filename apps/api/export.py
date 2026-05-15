"""PDF + JSON report export with analyst signature.

`POST /export` (wired in main.py) accepts a Report + optional analyst name
and returns a PDF. The PDF embeds:
  - the input SHA-256 (already inside the Report)
  - per-tier findings, with the model name surfaced for T3 and image
    evidence (ELA / noise residual) embedded inline
  - an analyst signature block (name + signed_at)
  - a `report_sha256` covering (input_hash + report content) — so the PDF
    is itself hash-verifiable against the served JSON.

Pure-Python: fpdf2 only. No GTK/Cairo system deps.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fpdf import FPDF
from pydantic import BaseModel

from models import Finding, Report


class ExportRequest(BaseModel):
    report: Report
    analyst_name: Optional[str] = None


_IMAGE_EVIDENCE_KEYS = ("overlay_png_base64", "residual_png_base64")
_TIER_LABELS = {
    1: "Tier 1 — Provenance (deterministic)",
    2: "Tier 2 — Forensic (inspectable)",
    3: "Tier 3 — AI signal (probabilistic, one input among many)",
    4: "Tier 4 — OSINT corroboration",
}
_RESULT_GLYPHS = {"pass": "PASS", "fail": "FAIL", "indeterminate": "INDET"}


def sign_report(report: Report, analyst_name: Optional[str]) -> Report:
    """Stamp the report with analyst name + signed_at (UTC). No name = unsigned."""
    if not analyst_name or not analyst_name.strip():
        return report
    return report.model_copy(
        update={
            "analyst_signature": analyst_name.strip(),
            "signed_at": datetime.now(timezone.utc),
        }
    )


def report_sha256(report: Report) -> str:
    """Hash (input_hash || canonical report JSON without signature) so the
    PDF can be verified against the served JSON byte-for-byte."""
    payload = report.model_dump(exclude={"analyst_signature", "signed_at"})
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256((report.input_hash + canonical).encode("utf-8")).hexdigest()


def _safe(s: object, maxlen: int = 400) -> str:
    """fpdf2 with built-in fonts only accepts Latin-1. Coerce best-effort."""
    text = str(s) if s is not None else ""
    text = text.replace("—", "-").replace("–", "-")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("‘", "'").replace("’", "'")
    text = text.encode("latin-1", errors="replace").decode("latin-1")
    if len(text) > maxlen:
        text = text[: maxlen - 1] + "…".encode("latin-1", errors="replace").decode("latin-1")
    return text


def _evidence_lines(evidence: dict) -> list[str]:
    """Flatten the evidence dict to a few readable lines, skipping the big base64 blobs."""
    lines: list[str] = []
    for key, value in evidence.items():
        if key in _IMAGE_EVIDENCE_KEYS:
            continue
        if isinstance(value, (dict, list)):
            try:
                value_str = json.dumps(value, default=str)
            except TypeError:
                value_str = str(value)
        else:
            value_str = str(value)
        lines.append(f"{key}: {value_str}")
    return lines


def _draw_finding(pdf: FPDF, finding: Finding) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, _safe(finding.check), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    meta = f"{_RESULT_GLYPHS.get(finding.result, finding.result)}  |  {finding.confidence}  |  via {finding.source}  |  {finding.timestamp.isoformat()}"
    pdf.cell(0, 4, _safe(meta), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    pdf.set_font("Courier", "", 8)
    for line in _evidence_lines(finding.evidence):
        pdf.multi_cell(0, 3.5, _safe(line, maxlen=240), new_x="LMARGIN", new_y="NEXT")

    # Embed image evidence (ELA / noise residual) at a readable size.
    for key in _IMAGE_EVIDENCE_KEYS:
        b64 = finding.evidence.get(key)
        if not isinstance(b64, str):
            continue
        try:
            img_bytes = base64.b64decode(b64)
        except (ValueError, TypeError):
            continue
        try:
            pdf.image(io.BytesIO(img_bytes), w=140)
        except Exception:  # noqa: BLE001
            pdf.set_font("Helvetica", "I", 8)
            pdf.cell(0, 4, _safe(f"[{key}: could not embed]"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def render_pdf(report: Report, report_hash: str) -> bytes:
    pdf = FPDF(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Veritas Stack - Verification Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 4, "Provenance over prediction. Evidence, not verdicts.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # Input + signature block
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, "Input", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Courier", "", 8)
    pdf.cell(0, 4, f"sha256 = {report.input_hash}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, "Signature", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    if report.analyst_signature:
        pdf.cell(0, 4, _safe(f"Signed by {report.analyst_signature}"), new_x="LMARGIN", new_y="NEXT")
        signed_at = report.signed_at.isoformat() if report.signed_at else ""
        pdf.cell(0, 4, _safe(f"Signed at {signed_at}"), new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_text_color(140, 140, 140)
        pdf.cell(0, 4, "Unsigned export.", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
    pdf.set_font("Courier", "", 8)
    pdf.cell(0, 4, f"report_sha256 = {report_hash}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Group findings by tier
    grouped: dict[int, list[Finding]] = {1: [], 2: [], 3: [], 4: []}
    for f in report.findings:
        grouped.setdefault(f.tier, []).append(f)

    for tier in (1, 2, 3, 4):
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 6, _safe(_TIER_LABELS[tier]), new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(180, 180, 180)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(2)

        if not grouped[tier]:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(140, 140, 140)
            pdf.cell(0, 5, "No findings.", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
            pdf.ln(2)
            continue

        for finding in grouped[tier]:
            _draw_finding(pdf, finding)

    # Footer disclaimer
    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(110, 110, 110)
    pdf.multi_cell(
        0,
        3.5,
        _safe(
            "This report is an evidence chain produced by automated checks. "
            "The Tier 3 AI signal is one input among many and is never authoritative. "
            "The analyst's signature attests to the report content as of signed_at."
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )

    out = pdf.output(dest="S")
    return bytes(out)
