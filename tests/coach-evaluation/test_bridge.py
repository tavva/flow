"""Test Python-TypeScript bridge."""

import sys
import os

# Add parent directory to path to enable imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from bridge import CoachTestBridge


@pytest.mark.skipif(
    not os.environ.get("OPENROUTER_API_KEY"),
    reason="Requires OPENROUTER_API_KEY environment variable",
)
def test_bridge_runs_simple_test_case():
    """Test that bridge can execute a simple test case."""
    bridge = CoachTestBridge()

    test_case = {
        "id": "test-bridge",
        "description": "Test bridge",
        "type": "single-turn",
        "conversation": [{"role": "user", "content": "Hello"}],
        "vaultContext": {"projects": [], "nextActions": [], "somedayItems": []},
        "expectations": {
            "coachingQuality": {"criteria": ["Helpful"], "threshold": 0.7}
        },
    }

    result = bridge.run_test_case(test_case)

    assert "messages" in result
    assert "toolCalls" in result
    assert isinstance(result["messages"], list)
    assert isinstance(result["toolCalls"], list)
