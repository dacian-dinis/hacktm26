from typing import List, Optional
from models import Finding
from .t4_factcheck import search_claims
from .t4_lookup_pack import build_lookup_pack
from .t4_source_reputation import check_source_reputation
from .t4_telegram import check_telegram_reputation

def get_tier4_findings(
    query: Optional[str] = None, 
    url: Optional[str] = None, 
    api_key: Optional[str] = None
) -> List[Finding]:
    """
    Orchestrates Tier 4 OSINT checks.
    Returns a list of Findings.
    """
    findings = []
    
    # 1. Source Reputation (Domain)
    if url:
        findings.append(check_source_reputation(url))
        
    # 2. Telegram Reputation
    if url and ("t.me/" in url or "telegram.me/" in url):
        findings.append(check_telegram_reputation(url))
    
    # 3. Fact Check
    # If a query is provided, search for it.
    # If no query but a URL is provided, we could eventually extract text from the URL,
    # but for now we just check the URL if it's the only thing provided.
    if query:
        findings.append(search_claims(query, api_key=api_key))
    elif url and not query:
        # Placeholder: search for the URL itself in fact check tools
        # Fact check tools often index by claim, so searching for a URL might find reviews of that article.
        findings.append(search_claims(url, api_key=api_key))

    if query or url:
        findings.append(build_lookup_pack(query=query, url=url))
        
    return findings
