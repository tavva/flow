"""
deepeval-based tests for Flow Coach evaluation.
Runs test cases through TypeScript bridge and evaluates with deepeval metrics.
"""

import sys
import os

# Add parent directory to path to enable imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric

from bridge import CoachTestBridge
from metrics.tool_correctness import ToolCorrectnessMetric
from metrics.gtd_quality import create_coaching_quality_metric


# Load test cases
with open("tests/coach-evaluation/test-cases.json", "r") as f:
    TEST_CASES = json.load(f)


@pytest.mark.parametrize("test_case", TEST_CASES, ids=[tc["id"] for tc in TEST_CASES])
def test_coach_evaluation(test_case):
    """Run deepeval evaluation on coach test case."""
    bridge = CoachTestBridge()

    # Execute test case through TypeScript
    result = bridge.run_test_case(test_case)

    # Build conversation input
    conversation_input = "\n".join(
        [f"{turn['role']}: {turn['content']}" for turn in test_case["conversation"]]
    )

    # Get actual output (last message)
    actual_output = result["messages"][-1] if result["messages"] else ""

    # Create deepeval test case with additional_metadata
    deepeval_case = LLMTestCase(
        input=conversation_input,
        actual_output=actual_output,
        additional_metadata={
            "vault_context": test_case["vaultContext"],
            "tool_calls": result["toolCalls"],
        },
    )

    # Build metrics list
    metrics = []

    # Add tool correctness metric if expected
    if "toolUsage" in test_case.get("expectations", {}):
        tool_expectations = test_case["expectations"]["toolUsage"]
        metrics.append(
            ToolCorrectnessMetric(
                expected_tools=tool_expectations,
                threshold=0.8,
            )
        )

    # Add coaching quality metric
    if "coachingQuality" in test_case.get("expectations", {}):
        quality_criteria = test_case["expectations"]["coachingQuality"]
        metrics.append(
            create_coaching_quality_metric(threshold=quality_criteria["threshold"])
        )

    # Add answer relevancy
    metrics.append(AnswerRelevancyMetric(threshold=0.7))

    # Run deepeval assertion
    assert_test(deepeval_case, metrics)
