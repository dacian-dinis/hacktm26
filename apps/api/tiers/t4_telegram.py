from datetime import datetime, timezone
from urllib.parse import urlparse
from models import Finding

# Curated list of Telegram channels/networks identified as disinformation hubs.
# Based on DFRLab, Veridica, and 2024-2025 Romanian election monitoring.
TELEGRAM_DISINFO_HANDLES = {
    "CalinGeorgescuOfficial": "Official channel of Călin Georgescu, central node for 2024 campaign.",
    "propagator": "Central coordination channel for coordinated TikTok amplification (Renașterea României).",
    "NewsTimeRomania": "Launders sanctioned Russian content (SouthFront, Rybar, Dugin) for RO audience.",
    "sptnk_necenzurat": "Successor to Sputnik Romania after EU sanctions.",
    "DanDiaconu": "Promotes economic disinformation and suveranist narratives.",
    "IosefinaPascal": "Amplifier of conspiracy theories and anti-Western narratives.",
    "GoldFMRomania": "Linked to Cozmin Gușă, promotes pro-Russian/suveranist views.",
    "starea_de_libertate": "Promotes anti-EU and religious-nationalist disinformation.",
}

def check_telegram_reputation(url_or_handle: str) -> Finding:
    """
    Checks if a Telegram handle or URL is in the curated disinfo list.
    """
    handle = url_or_handle.strip()
    
    # Extract handle from URL
    if "t.me/" in handle:
        handle = handle.split("t.me/")[1].split("/")[0].replace("+", "")
    elif "telegram.me/" in handle:
        handle = handle.split("telegram.me/")[1].split("/")[0].replace("+", "")

    # Check for exact handle match (case-insensitive)
    match = None
    for h, desc in TELEGRAM_DISINFO_HANDLES.items():
        if h.lower() == handle.lower():
            match = (h, desc)
            break
            
    if match:
        return Finding(
            tier=4,
            check="osint.telegram.reputation",
            result="fail",
            confidence="high",
            evidence={
                "handle": match[0],
                "label": "disinformation_hub",
                "description": match[1],
                "note": "This channel is identified as a key node in disinformation networks."
            },
            source="self.curated_telegram_list",
            timestamp=datetime.now(timezone.utc)
        )

    # If it's a telegram link but not in our list
    if "t.me/" in url_or_handle or "telegram.me/" in url_or_handle:
        return Finding(
            tier=4,
            check="osint.telegram.reputation",
            result="indeterminate",
            confidence="medium",
            evidence={
                "handle": handle,
                "note": "Telegram link detected, but not in our curated disinfo list."
            },
            source="self.curated_telegram_list",
            timestamp=datetime.now(timezone.utc)
        )

    return Finding(
        tier=4,
        check="osint.telegram.reputation",
        result="indeterminate",
        confidence="low",
        evidence={"note": "No Telegram handle identified in input."},
        source="self.curated_telegram_list",
        timestamp=datetime.now(timezone.utc)
    )
