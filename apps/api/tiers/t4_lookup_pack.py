from datetime import datetime, timezone
from urllib.parse import quote_plus, urlparse

from models import Finding


def build_lookup_pack(query: str | None = None, url: str | None = None) -> Finding:
    """Return deterministic OSINT pivots when external fact-check search is sparse."""
    clean_query = (query or "").strip()
    clean_url = (url or "").strip()
    domain = ""
    if clean_url:
        parsed = urlparse(clean_url if "://" in clean_url else f"https://{clean_url}")
        domain = parsed.netloc.lower().split(":")[0]

    search_text = clean_query or clean_url or domain
    encoded = quote_plus(search_text)
    links = {
        "web_search": f"https://www.google.com/search?q={encoded}" if search_text else None,
        "image_search": f"https://www.google.com/search?tbm=isch&q={encoded}" if search_text else None,
        "factcheck_search": f"https://toolbox.google.com/factcheck/explorer/search/{encoded}" if search_text else None,
    }
    if domain:
        links["site_search"] = f"https://www.google.com/search?q=site%3A{quote_plus(domain)}+{encoded}"

    return Finding(
        tier=4,
        check="osint.lookup_pack",
        result="indeterminate",
        confidence="medium",
        evidence={
            "query": clean_query or None,
            "source_url": clean_url or None,
            "domain": domain or None,
            "links": {k: v for k, v in links.items() if v},
            "note": "Manual OSINT pivots for cases where indexed fact-check coverage is sparse.",
        },
        source="self.osint_pivots",
        timestamp=datetime.now(timezone.utc),
    )
