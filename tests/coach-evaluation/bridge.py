"""
Python-TypeScript bridge for running coach evaluation tests.
Executes TypeScript test runner and parses results.
"""

import json
import subprocess
from typing import Dict, Any


class CoachTestBridge:
    """Bridge to execute TypeScript coach tests from Python."""

    def __init__(self):
        self.script_path = "tests/coach-evaluation/run_test_case.ts"

    def run_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run a test case through TypeScript runner.

        Args:
            test_case: Test case dictionary

        Returns:
            Dict with 'messages' and 'toolCalls' keys
        """
        test_case_json = json.dumps(test_case)

        # Run TypeScript script
        result = subprocess.run(
            ["npx", "tsx", self.script_path, test_case_json],
            capture_output=True,
            text=True,
            check=True,
        )

        # Parse JSON output
        return json.loads(result.stdout)
