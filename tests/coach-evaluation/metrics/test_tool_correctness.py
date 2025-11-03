"""Test tool correctness metric."""

import pytest
from deepeval.test_case import LLMTestCase
from .tool_correctness import ToolCorrectnessMetric


def test_no_tools_expected_or_called():
    """Test perfect score when no tools expected or called."""
    metric = ToolCorrectnessMetric(expected_tools=[], threshold=0.8)
    test_case = LLMTestCase(
        input="test",
        actual_output="response",
        additional_metadata={"tool_calls": []},
    )

    score = metric.measure(test_case)
    assert score == 1.0
    assert metric.is_successful()


def test_tools_called_when_not_expected():
    """Test failure when tools called but not expected."""
    metric = ToolCorrectnessMetric(expected_tools=[], threshold=0.8)
    test_case = LLMTestCase(
        input="test",
        actual_output="response",
        additional_metadata={"tool_calls": [{"name": "unexpected_tool"}]},
    )

    score = metric.measure(test_case)
    assert score == 0.0
    assert not metric.is_successful()


def test_correct_tools_and_params():
    """Test perfect score for correct tools and params."""
    expected = [
        {
            "name": "add_next_action_to_project",
            "requiredParams": ["project_path", "action_text"],
        }
    ]
    metric = ToolCorrectnessMetric(expected_tools=expected, threshold=0.8)

    actual_tools = [
        {
            "name": "add_next_action_to_project",
            "parameters": {
                "project_path": "Projects/Test.md",
                "action_text": "Do something",
            },
        }
    ]

    test_case = LLMTestCase(
        input="test", actual_output="response", additional_metadata={"tool_calls": actual_tools}
    )

    score = metric.measure(test_case)
    assert score == 1.0
    assert metric.is_successful()
