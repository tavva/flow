"""
DAG-based tool correctness metric for coach evaluation.
Evaluates whether coach calls correct tools with correct parameters.
"""

from typing import List, Dict, Any
from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class ToolCorrectnessMetric(BaseMetric):
    """
    DAG metric that evaluates tool usage through decision tree:
    1. Were tools called when expected?
    2. Correct tool types?
    3. Correct parameters?
    """

    def __init__(self, expected_tools: List[Dict[str, Any]], threshold: float = 0.8):
        self.threshold = threshold
        self.expected_tools = expected_tools
        self.decisions = []

    def measure(self, test_case: LLMTestCase) -> float:
        """
        Evaluate tool correctness for a test case.
        Returns score between 0.0 and 1.0.
        """
        # Extract actual tool calls from test case additional_metadata
        actual_tools = (test_case.additional_metadata or {}).get("tool_calls", [])

        # Decision Node 1: Were tools called when expected?
        tools_called = len(actual_tools) > 0
        should_call_tools = len(self.expected_tools) > 0

        if tools_called != should_call_tools:
            self.decisions.append({"node": "tool_decision", "passed": False})
            self.score = 0.0
            return self.score

        if not should_call_tools:
            # No tools expected or called - perfect score
            self.score = 1.0
            return self.score

        # Decision Node 2: Correct tool types?
        correct_tools = self._validate_tool_types(actual_tools)
        self.decisions.append({"node": "tool_types", "passed": correct_tools})

        if not correct_tools:
            self.score = 0.4  # Called tools, but wrong types
            return self.score

        # Decision Node 3: Correct parameters?
        correct_params = self._validate_tool_params(actual_tools)
        self.decisions.append({"node": "tool_params", "passed": correct_params})

        if correct_params:
            self.score = 1.0  # Perfect score
        else:
            self.score = 0.7  # Right tools, wrong params

        return self.score

    def _validate_tool_types(self, actual_tools: List[Dict]) -> bool:
        """Check if tool names match expected."""
        expected_names = {tool.get("name") for tool in self.expected_tools}
        actual_names = {tool.get("name") for tool in actual_tools}
        return expected_names == actual_names

    def _validate_tool_params(self, actual_tools: List[Dict]) -> bool:
        """Check if required parameters are present."""
        for expected_tool in self.expected_tools:
            tool_name = expected_tool.get("name")
            required_params = expected_tool.get("requiredParams", [])

            # Find matching actual tool call
            actual_tool = next(
                (t for t in actual_tools if t.get("name") == tool_name), None
            )

            if not actual_tool:
                return False

            # Check required params
            actual_params = actual_tool.get("parameters", {})
            for param in required_params:
                if param not in actual_params:
                    return False

        return True

    def is_successful(self) -> bool:
        """Return whether metric passed threshold."""
        return self.score >= self.threshold

    @property
    def __name__(self):
        return "Tool Correctness"
