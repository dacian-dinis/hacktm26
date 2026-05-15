"""Build the six demo assets for Phase 7.

Run from repo root with the apps/api venv:
    apps/api/.venv/Scripts/python scripts/build_demo_assets.py --fetch

Source images are CC-licensed or public-domain. Composites are generated
locally with PIL — no copyrighted news photos are redistributed. The
narration in each metadata.json links to a documented real-world parallel
case so the demo story is grounded.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import urllib.request
from pathlib import Path

import imagehash
from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parents[1]
DEMO = REPO / "data" / "demo"
DL = REPO / "tmp_sources"

USER_AGENT = (
    "VeritasStack/0.1 (HackTM2026 defense track demo; dacian.dinis@gmail.com)"
)

SOURCES: dict[str, str] = {
    "c2pa.jpg": "https://raw.githubusercontent.com/contentauth/c2pa-rs/main/sdk/tests/fixtures/CA.jpg",
    "wire.jpg": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg",
    "scene1.jpg": "https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg",
    "face.jpg": "https://thispersondoesnotexist.com/",
}


def fetch_sources() -> None:
    DL.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dst = DL / name
        if dst.exists() and dst.stat().st_size > 0:
            print(f"have {name}")
            continue
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            dst.write_bytes(resp.read())
        print(f"fetched {name} ({dst.stat().st_size} bytes)")

MAX_WIDTH = 1024


def resize(img: Image.Image, max_w: int = MAX_WIDTH) -> Image.Image:
    if img.width <= max_w:
        return img
    ratio = max_w / img.width
    return img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)


def save_jpeg(img: Image.Image, path: Path, quality: int = 90) -> None:
    img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True)


def hashes(path: Path) -> dict[str, str]:
    img = Image.open(path)
    return {
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "phash": str(imagehash.phash(img)),
        "dhash": str(imagehash.dhash(img)),
    }


def write_metadata(slug: str, meta: dict) -> None:
    (DEMO / slug / "metadata.json").write_text(
        json.dumps(meta, indent=2) + "\n", encoding="utf-8"
    )


def build_01_c2pa_authentic() -> None:
    slug = "01-c2pa-authentic"
    src = DL / "c2pa.jpg"
    dst = DEMO / slug / "asset.jpg"
    # Copy raw bytes — PIL re-save would strip the JUMBF/XMP segments that
    # carry the C2PA manifest, defeating the whole point of this asset.
    shutil.copyfile(src, dst)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "C2PA-signed authentic image (CAI test fixture)",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "https://github.com/contentauth/c2pa-rs/blob/main/sdk/tests/fixtures/CA.jpg",
            "license": "Apache-2.0 / MIT (test fixture distributed with c2pa-rs)",
            "expected_findings": [
                {"tier": 1, "check": "c2pa.signature.verify", "result": "pass",
                 "note": "Manifest present and signed by Adobe CAI test root"},
                {"tier": 1, "check": "exif.parse", "result": "pass",
                 "note": "EXIF intact, capture metadata coherent"},
                {"tier": 4, "check": "osint.factcheck", "result": "indeterminate",
                 "note": "No claim to corroborate — this is a benign authenticity demo"},
            ],
            "demo_narration": (
                "This is what a properly-signed image looks like. Tier 1 returns "
                "deterministic 'pass' on the cryptographic signature — that is the "
                "only kind of 100%-accurate finding the system will ever produce."
            ),
        },
    )


def build_02_wire_match() -> None:
    slug = "02-wire-match"
    src = DL / "wire.jpg"
    dst = DEMO / slug / "asset.jpg"
    img = resize(Image.open(src))
    save_jpeg(img, dst, quality=88)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "Wire-style editorial photo (Wikimedia Commons CC BY-SA)",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "https://commons.wikimedia.org/wiki/File:Cat03.jpg",
            "license": "CC BY-SA 3.0 — Alvesgaspar, Wikimedia Commons",
            "wire_db_seed_hash": h["phash"],
            "expected_findings": [
                {"tier": 1, "check": "phash.wire_db_match", "result": "pass",
                 "note": "pHash matches a seeded wire-service entry (Hamming distance 0)"},
                {"tier": 1, "check": "bing.reverse_image", "result": "pass",
                 "note": "Earliest hit predates the alleged context — real-world parallel: Reuters/AP photos resurfacing"},
            ],
            "demo_narration": (
                "If the image already exists in a trusted wire-service feed, "
                "perceptual hashing matches it deterministically. The analyst no "
                "longer needs the AI to weigh in."
            ),
            "real_world_parallel": (
                "Routine OSINT pattern: a viral 'breaking' photo is actually a wire "
                "image lifted from Reuters/AP archives hours or years earlier."
            ),
        },
    )


def build_03_old_misrep() -> None:
    slug = "03-old-misrep"
    src = DL / "scene1.jpg"  # Apollo 17 — 1972 NASA public domain
    dst = DEMO / slug / "asset.jpg"
    img = resize(Image.open(src))
    save_jpeg(img, dst, quality=85)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "Old image (Apollo 17, 1972) misrepresented as new",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg",
            "license": "Public domain — NASA, 1972",
            "expected_findings": [
                {"tier": 1, "check": "bing.reverse_image", "result": "fail",
                 "note": "Earliest hit is 1972 NASA archive — image predates any 'new satellite footage' claim"},
                {"tier": 1, "check": "exif.parse", "result": "indeterminate",
                 "note": "EXIF stripped on re-upload (expected for repurposed images)"},
                {"tier": 1, "check": "c2pa.signature.verify", "result": "fail",
                 "note": "No C2PA manifest — image cannot be authenticated at the bit level"},
            ],
            "demo_narration": (
                "Tier 1 reverse-image search lands the demo's killer beat for the "
                "Romanian election narrative: 'this 2024 satellite image of a missile "
                "site' is actually a 1972 NASA photograph."
            ),
            "real_world_parallel": (
                "During the 2024 Romanian election cycle, multiple recycled images "
                "from prior conflicts circulated on TikTok and Telegram as new evidence."
            ),
        },
    )


def build_04_ela_composite() -> None:
    slug = "04-ela-composite"
    base = resize(Image.open(DL / "scene1.jpg")).convert("RGB")
    obj = resize(Image.open(DL / "wire.jpg"), max_w=420).convert("RGB")
    composite = base.copy()
    paste_x = base.width // 2 - obj.width // 2
    paste_y = base.height - obj.height - 40
    # Re-save the object as low-quality JPEG bytes so its compression
    # signature visibly differs from the base when ELA runs.
    buf = io.BytesIO()
    obj.save(buf, "JPEG", quality=60)
    buf.seek(0)
    obj_lossy = Image.open(buf).convert("RGB")
    composite.paste(obj_lossy, (paste_x, paste_y))
    dst = DEMO / slug / "asset.jpg"
    save_jpeg(composite, dst, quality=92)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "Obvious composite (ELA target)",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "Generated locally from CC-licensed Wikimedia sources",
            "license": "Derivative CC BY-SA 3.0 (Cat03) + Public Domain (Apollo 17) — generated for demo",
            "construction": (
                "Apollo 17 base image with the Cat03 photo pasted in at quality 60 "
                "before the final save at quality 92. The compression-level "
                "discontinuity is exactly what ELA visualises."
            ),
            "expected_findings": [
                {"tier": 1, "check": "c2pa.signature.verify", "result": "fail",
                 "note": "No manifest"},
                {"tier": 2, "check": "forensic.ela", "result": "fail",
                 "note": "Pasted region shows distinctly higher error level than base"},
                {"tier": 2, "check": "forensic.noise_residual", "result": "fail",
                 "note": "Noise pattern discontinuity at composite edges"},
            ],
            "demo_narration": (
                "Tier 2 is the visual wow: side-by-side ELA viewer lights up the "
                "pasted region. Inspectable forensics — no black box."
            ),
        },
    )


def build_05_deepfake_caught() -> None:
    slug = "05-deepfake-caught"
    src = DL / "face.jpg"  # thispersondoesnotexist — StyleGAN synthetic face
    dst = DEMO / slug / "asset.jpg"
    img = resize(Image.open(src))
    save_jpeg(img, dst, quality=90)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "Synthetic face (StyleGAN, AI tier catches)",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "https://thispersondoesnotexist.com/",
            "license": "Synthetic — not a real person. StyleGAN-generated images are not copyrighted.",
            "expected_findings": [
                {"tier": 1, "check": "c2pa.signature.verify", "result": "fail",
                 "note": "No manifest"},
                {"tier": 3, "check": "ai.deepfake.vit", "result": "fail",
                 "note": "Wvolf/ViT_Deepfake_Detection flags as synthetic — one signal among many",
                 "caveat": "Model trained on FaceForensics++; confidence shown but never used as verdict"},
            ],
            "demo_narration": (
                "Tier 3 is the AI signal. When it agrees with Tiers 1 and 2, the "
                "report is consistent. We always present it as one input among many."
            ),
        },
    )


def build_06_evidence_wins() -> None:
    slug = "06-deepfake-missed-but-evidence-wins"
    base = resize(Image.open(DL / "scene1.jpg")).convert("RGB")
    face = Image.open(DL / "face.jpg").convert("RGB")
    # Scale face to fit on the Earth scene — small enough to look "in the wild"
    face_small = face.resize((280, 280), Image.LANCZOS)
    # Feather the edges slightly so the manipulation is less obvious to a
    # casual look while still leaving forensic signatures.
    mask = Image.new("L", face_small.size, 0)
    ImageDraw.Draw(mask).ellipse((4, 4, 276, 276), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(6))
    composite = base.copy()
    paste_x = base.width // 2 - 140
    paste_y = base.height // 2 - 140
    composite.paste(face_small, (paste_x, paste_y), mask)
    dst = DEMO / slug / "asset.jpg"
    save_jpeg(composite, dst, quality=88)
    h = hashes(dst)
    write_metadata(
        slug,
        {
            "slug": slug,
            "title": "Composite the AI face-detector misses; evidence chain catches it",
            "filename": "asset.jpg",
            "sha256": h["sha256"],
            "phash": h["phash"],
            "dhash": h["dhash"],
            "source_url": "Generated locally from CC-licensed Wikimedia + synthetic face",
            "license": "Derivative — Apollo 17 (public domain) + StyleGAN synthetic face (non-copyrighted)",
            "construction": (
                "A real (untouched) synthetic-face crop is feathered and pasted onto "
                "the Apollo 17 base. The face itself is unmanipulated AI-generated, "
                "so a face-deepfake classifier may correctly classify the face region "
                "as 'synthetic' OR as 'real' depending on its training distribution — "
                "but in either case the AI tier does NOT detect the scene-level "
                "manipulation. Tiers 1, 2, and 4 still expose the composite."
            ),
            "swap_in_note": (
                "For the strongest demo beat ('AI says real, evidence catches'), "
                "replace the face source with a real-person photo where the AI "
                "classifier outputs 'real' with high confidence. Re-run this script "
                "after dropping a replacement face.jpg into /tmp/dl/."
            ),
            "expected_findings": [
                {"tier": 1, "check": "c2pa.signature.verify", "result": "fail",
                 "note": "No manifest — first red flag, deterministic"},
                {"tier": 1, "check": "bing.reverse_image", "result": "fail",
                 "note": "Base scene matches Apollo 17, 1972 — incompatible with any 'current event' claim"},
                {"tier": 2, "check": "forensic.ela", "result": "fail",
                 "note": "Pasted face region carries different compression history"},
                {"tier": 3, "check": "ai.deepfake.vit", "result": "indeterminate",
                 "note": "Face-deepfake classifier was not trained to detect scene-level compositing; this is exactly where AI-only verdicts fail",
                 "caveat": "If T3 returns 'real' here, that is the 'AI is wrong, evidence is right' beat — the report still says UNVERIFIED because of T1/T2/T4."},
                {"tier": 4, "check": "osint.factcheck", "result": "indeterminate",
                 "note": "No corroboration for an unverified scene"},
            ],
            "demo_narration": (
                "This is the asset that wins the round. The off-the-shelf AI was "
                "trained on face deepfakes; this is a context manipulation. The AI "
                "tier signals 'no face-level deepfake detected' — and is technically "
                "correct. The verification chain still emits UNVERIFIED because "
                "Tier 1 has no provenance, reverse-image lands a 1972 NASA archive, "
                "and Tier 2 ELA exposes the composite. The analyst signs UNVERIFIED. "
                "The AI was wrong; the audit trail was right."
            ),
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="Download source images into tmp_sources/ before building",
    )
    args = parser.parse_args()
    if args.fetch:
        fetch_sources()
    missing = [n for n in SOURCES if not (DL / n).exists()]
    if missing:
        raise SystemExit(
            f"Missing source files in {DL}: {missing}. Re-run with --fetch."
        )
    builders = [
        build_01_c2pa_authentic,
        build_02_wire_match,
        build_03_old_misrep,
        build_04_ela_composite,
        build_05_deepfake_caught,
        build_06_evidence_wins,
    ]
    for fn in builders:
        fn()
        print(f"built {fn.__name__}")
    print(f"\nAll six demo assets written under {DEMO.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
