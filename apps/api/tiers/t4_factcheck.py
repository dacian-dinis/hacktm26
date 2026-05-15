import os
import re
from datetime import datetime, timezone
from typing import Optional

import requests

from models import Finding

# Strip ?key=... / &key=... / token=... from any string before it lands in
# evidence — requests' HTTPError str() includes the full request URL, which
# previously leaked the Google API key into PDF reports.
_SECRET_QS = re.compile(r"([?&])(key|api[_-]?key|token|apikey)=[^&\s]+", re.IGNORECASE)


def _redact(s: str) -> str:
    return _SECRET_QS.sub(r"\1\2=<redacted>", s)


# Heuristic: treat the query as a bare filename when it ends in an image
# extension and contains no spaces. Filenames are not claims and just earn
# a 400 from Google. Skip the call instead.
_FILENAME_RE = re.compile(r"^[^\s/]+\.(jpe?g|png|webp|gif|tiff?|bmp|heic)$", re.IGNORECASE)


def search_claims(query: str, api_key: Optional[str] = None) -> Finding:
    """
    Searches Google Fact Check Tools API for claims matching the query.
    Returns a Finding object.
    """
    key = api_key or os.getenv("GOOGLE_FACTCHECK_API_KEY")

    if not key:
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result="indeterminate",
            confidence="low",
            evidence={"error": "Missing GOOGLE_FACTCHECK_API_KEY"},
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )

    if not query or _FILENAME_RE.match(query.strip()):
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result="indeterminate",
            confidence="low",
            evidence={
                "query": query,
                "note": (
                    "No claim text provided — fact-check search skipped. "
                    "Pass a sentence-level claim via the /verify `query` field "
                    "for Tier 4 corroboration."
                ),
            },
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )

    endpoint = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {
        "query": query,
        "key": key,
        "languageCode": "ro-RO",  # Prioritize Romanian context
        "pageSize": 5
    }

    try:
        response = requests.get(endpoint, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        claims = data.get("claims", [])
        if not claims:
            return Finding(
                tier=4,
                check="google.factcheck.search",
                result="indeterminate",
                confidence="medium",
                evidence={"query": query, "message": "No matching fact checks found."},
                source="google.factcheck",
                timestamp=datetime.now(timezone.utc)
            )

        # Get the first claim's first review for simplicity, or iterate
        # In a real tool, we might want to return multiple, but the contract is usually 1 finding per check
        claim = claims[0]
        review = claim.get("claimReview", [{}])[0]
        
        rating = review.get("textualRating", "").lower()
        
        # Map rating to result
        result = "indeterminate"
        if any(word in rating for word in ["false", "fake", "incorrect", "fals", "neadevărat"]):
            result = "fail"
        elif any(word in rating for word in ["true", "correct", "accurate", "adevărat", "corect"]):
            result = "pass"
            
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result=result,
            confidence="high",
            evidence={
                "claim": claim.get("text"),
                "claimant": claim.get("claimant"),
                "rating": review.get("textualRating"),
                "url": review.get("url"),
                "publisher": review.get("publisher", {}).get("name"),
                "review_date": review.get("reviewDate")
            },
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )

    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result="indeterminate",
            confidence="low",
            evidence={
                "error": f"HTTP {status}" if status else _redact(str(e)),
                "query": query,
            },
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )
    except Exception as e:
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result="indeterminate",
            confidence="low",
            evidence={"error": _redact(str(e)), "query": query},
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )
