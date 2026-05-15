import requests
import os
from datetime import datetime, timezone
from typing import Optional
from models import Finding

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

    except Exception as e:
        return Finding(
            tier=4,
            check="google.factcheck.search",
            result="indeterminate",
            confidence="low",
            evidence={"error": str(e), "query": query},
            source="google.factcheck",
            timestamp=datetime.now(timezone.utc)
        )
