from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
import pytest

from tiers.t4_factcheck import search_claims
from tiers.t4_source_reputation import check_source_reputation
from tiers.t4_telegram import check_telegram_reputation
from tiers.t4_interface import get_tier4_findings
from models import Finding

def test_source_reputation_trusted():
    f = check_source_reputation("https://www.reuters.com/world/article")
    assert f.result == "pass"
    assert f.evidence["domain"] == "reuters.com"

def test_source_reputation_disinfo():
    f = check_source_reputation("activenews.ro")
    assert f.result == "fail"
    assert f.evidence["label"] == "disinformation"

def test_source_reputation_unknown():
    f = check_source_reputation("random-new-site.xyz")
    assert f.result == "indeterminate"

def test_telegram_reputation_disinfo():
    f = check_telegram_reputation("https://t.me/propagator")
    assert f.result == "fail"
    assert f.evidence["label"] == "disinformation_hub"

def test_telegram_reputation_unknown():
    f = check_telegram_reputation("t.me/someone_new")
    assert f.result == "indeterminate"
    assert f.evidence["handle"] == "someone_new"

def test_interface_calls_all():
    with patch('tiers.t4_interface.check_source_reputation') as mock_rep, \
         patch('tiers.t4_interface.check_telegram_reputation') as mock_tele, \
         patch('tiers.t4_interface.search_claims') as mock_fact:
        
        mock_rep.return_value = Finding(tier=4, check="rep", result="pass", confidence="high", source="s", timestamp=datetime.now(timezone.utc))
        mock_tele.return_value = Finding(tier=4, check="tele", result="pass", confidence="high", source="s", timestamp=datetime.now(timezone.utc))
        mock_fact.return_value = Finding(tier=4, check="fact", result="pass", confidence="high", source="s", timestamp=datetime.now(timezone.utc))
        
        findings = get_tier4_findings(query="test", url="https://t.me/propagator")
        
        assert len(findings) == 3
        mock_rep.assert_called_once()
        mock_tele.assert_called_once_with("https://t.me/propagator")
        mock_fact.assert_called_once_with("test", api_key=None)

@patch('requests.get')
def test_fact_check_fail(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "claims": [
            {
                "text": "Fake claim",
                "claimant": "Someone",
                "claimReview": [
                    {
                        "publisher": {"name": "Facts"},
                        "url": "http://facts.com",
                        "textualRating": "False",
                        "reviewDate": "2024-01-01"
                    }
                ]
            }
        ]
    }
    mock_get.return_value = mock_response
    
    f = search_claims("test", api_key="fake")
    assert f.result == "fail"
    assert f.evidence["rating"] == "False"

@patch('requests.get')
def test_fact_check_no_results(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {}
    
    f = search_claims("test", api_key="fake")
    assert f.result == "indeterminate"
