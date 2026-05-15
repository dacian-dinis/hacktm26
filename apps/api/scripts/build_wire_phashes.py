"""Build data/wire_phashes.json from data/wire_seeds.txt.

Run from the repo root:

    python -m apps.api.scripts.build_wire_phashes

Each non-comment line in `wire_seeds.txt` is a URL. We download once, compute
pHash + dHash, and write a JSON list keyed by URL. The Tier 1 pHash check
loads that JSON at request time — no live network calls on the demo path.
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import imagehash
import requests
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[3]
SEEDS = REPO_ROOT / "data" / "wire_seeds.txt"
OUTPUT = REPO_ROOT / "data" / "wire_phashes.json"

UA = "VeritasStack/0.1 (+https://github.com/hacktm26-veritas) hash-builder"
TIMEOUT = 30


def iter_urls(path: Path):
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        yield line


def hash_one(url: str) -> dict | None:
    try:
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  ! fetch failed: {exc}", file=sys.stderr)
        return None

    try:
        img = Image.open(io.BytesIO(resp.content))
        img.load()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! decode failed: {exc}", file=sys.stderr)
        return None

    return {
        "url": url,
        "final_url": resp.url,
        "phash": str(imagehash.phash(img)),
        "dhash": str(imagehash.dhash(img)),
        "width": img.width,
        "height": img.height,
        "bytes": len(resp.content),
    }


def main() -> int:
    if not SEEDS.exists():
        print(f"missing seed file: {SEEDS}", file=sys.stderr)
        return 1

    out: list[dict] = []
    for url in iter_urls(SEEDS):
        print(f"- {url}")
        entry = hash_one(url)
        if entry:
            out.append(entry)

    OUTPUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {len(out)} entries to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
