from datetime import datetime, timezone
from urllib.parse import urlparse
from models import Finding

# Curated lists based on DFRLab, Veridica, and other OSINT sources.
# Updated with specific Romanian findings from 2024-2025 elections.
TRUSTED_DOMAINS = {
    # Global / EU
    "reuters.com": "Global news agency, high reliability.",
    "apnews.com": "Global news agency, high reliability.",
    "bbc.com": "Public broadcaster, high reliability.",
    "lemonde.fr": "French national newspaper, high reliability.",
    "dw.com": "German international broadcaster, high reliability.",
    "politico.eu": "EU political news, high reliability.",
    "euronews.com": "Pan-European news network, high reliability.",
    
    # Romanian Reputable
    "hotnews.ro": "Major Romanian news portal, reputable.",
    "g4media.ro": "Romanian investigative journalism, reputable.",
    "digi24.ro": "Romanian news television, reputable.",
    "veridica.ro": "Specialized in fact-checking and disinformation analysis.",
    "factual.ro": "First Romanian fact-checking platform.",
    "zf.ro": "Major Romanian financial news.",
    "adevarul.ro": "Established Romanian national newspaper.",
    "libertatea.ro": "Major national newspaper with strong investigative team.",
    "context.ro": "Investigative journalism and OSINT focused.",
    "stirileprotv.ro": "Major television news network.",
    "tvr.ro": "Romanian public broadcaster.",
}

DISINFO_DOMAINS = {
    # High-influence Romanian Disinfo / Conspiracy
    "activenews.ro": "Pro-Kremlin, anti-EU/NATO narratives, anti-vaccine.",
    "ortodoxinfo.ro": "Religious-nationalist disinformation, anti-EU, pro-Russian bias.",
    "flux24.ro": "Anti-Western, pro-Kremlin bias, sensationalist.",
    "national.ro": "Promotes 'Romania as colony' narratives, anti-Ukraine.",
    "solidnews.ro": "Promotes 'sovereigntist' and pro-Russian viewpoints (Gold FM link).",
    "r3media.ro": "Promotes suveranist agenda and disinformation-linked candidates.",
    "ziar.com": "Associated with coordinated disinformation networks (DFRLab).",
    "romaniapress.com": "Associated with election interference networks.",
    "sportul.com": "Used to amplify disinformation/election denialism.",
    "aznews.ro": "Recycles Kremlin talking points.",
    
    # Proxy / State-Linked
    "ro.sputniknews.com": "Russian state media (EU sanctioned).",
    "romania.news-pravda.com": "Part of the Russian 'Portal Kombat' network.",
    "ro.topwar.ru": "Russian military proxy site.",
    "southfront.org": "Sanctioned Russian disinformation site.",
    "rybar.ru": "Russian military-linked channel (amplified in RO).",
    
    # Sensationalist / Clickbait with Disinfo history
    "gandul.ro": "Hosts narratives amplifying 'Romania as colony' themes.",
    "cancan.ro": "Clickbait often used for sensationalist political manipulation.",
}

# Domains often used in "Doppelganger" clone attacks
CLONE_TARGETS = [
    "digi24.ro", "hotnews.ro", "adevarul.ro", "libertatea.ro", 
    "gov.ro", "ms.ro"
]

def _get_base_domain(url_or_domain: str) -> str:
    """Extracts the base domain (e.g., news.bbc.co.uk -> bbc.co.uk)."""
    if not url_or_domain:
        return ""
    if "://" in url_or_domain:
        domain = urlparse(url_or_domain).netloc
    else:
        domain = url_or_domain
    
    # Handle port if present
    domain = domain.split(":")[0]
    
    parts = domain.lower().split(".")
    if len(parts) > 2:
        # Simple heuristic: keep last two parts, or last three if it looks like co.uk
        if parts[-2] in ["com", "co", "org", "gov", "edu", "net"] and len(parts) >= 3:
             return ".".join(parts[-3:])
        return ".".join(parts[-2:])
    return domain.lower()

def check_source_reputation(url_or_domain: str) -> Finding:
    """
    Checks the reputation of a domain against curated trust and disinfo lists.
    Returns a Finding object.
    """
    domain = _get_base_domain(url_or_domain)
    
    if not domain:
        return Finding(
            tier=4,
            check="source.reputation.lookup",
            result="indeterminate",
            confidence="low",
            evidence={"error": "No domain provided"},
            source="self.curated_list",
            timestamp=datetime.now(timezone.utc)
        )

    if domain in TRUSTED_DOMAINS:
        return Finding(
            tier=4,
            check="source.reputation.lookup",
            result="pass",
            confidence="high",
            evidence={
                "domain": domain,
                "label": "trusted",
                "description": TRUSTED_DOMAINS[domain]
            },
            source="self.curated_list",
            timestamp=datetime.now(timezone.utc)
        )
    
    if domain in DISINFO_DOMAINS:
        return Finding(
            tier=4,
            check="source.reputation.lookup",
            result="fail",
            confidence="high",
            evidence={
                "domain": domain,
                "label": "disinformation",
                "description": DISINFO_DOMAINS[domain]
            },
            source="self.curated_list",
            timestamp=datetime.now(timezone.utc)
        )

    # Special check for potential clones (very simple heuristic)
    # If the domain is almost like a target but not quite, it could be a warning.
    # For now, just mark as unknown.
    
    return Finding(
        tier=4,
        check="source.reputation.lookup",
        result="indeterminate",
        confidence="medium",
        evidence={
            "domain": domain,
            "label": "unknown",
            "note": "Domain not in curated lists."
        },
        source="self.curated_list",
        timestamp=datetime.now(timezone.utc)
    )
