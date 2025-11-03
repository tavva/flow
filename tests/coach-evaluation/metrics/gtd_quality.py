# ABOUTME: G-Eval criteria definitions for GTD coaching quality evaluation
# ABOUTME: Uses LLM-as-judge to measure coaching advice quality via deepeval

"""
G-Eval criteria definitions for GTD coaching quality.
Uses LLM-as-judge to evaluate coaching advice quality.
"""

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams


def create_coaching_quality_metric(threshold: float = 0.7) -> GEval:
    """
    Create G-Eval metric for GTD coaching quality evaluation.

    Args:
        threshold: Minimum score to pass (0.0-1.0)

    Returns:
        GEval metric configured for coaching quality
    """
    return GEval(
        name="GTD Coaching Quality",
        criteria="Evaluate GTD coaching quality based on: (1) adherence to GTD principles like clear next actions and defined project outcomes, (2) specific, actionable guidance rather than vague suggestions, (3) helpfulness for maintaining the user's GTD system, (4) supportive and encouraging tone",
        evaluation_params=[
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
        ],
        threshold=threshold,
        model="gpt-4",  # Will be overridden by deepeval config
    )


# Pre-defined criteria for common coaching scenarios

STALLED_PROJECT_CRITERIA = GEval(
    name="Stalled Project Guidance",
    criteria="Evaluate whether the coach: (1) correctly identifies the project as stalled, (2) suggests specific, actionable next steps, (3) follows GTD principles for next actions (action verb, clear context, completable)",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    threshold=0.8,
)

WEEKLY_REVIEW_CRITERIA = GEval(
    name="Weekly Review Guidance",
    criteria="Evaluate whether the coach: (1) follows standard weekly review workflow (inbox, projects, next actions, someday), (2) maintains context across conversation turns, (3) provides actionable guidance at each step",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    threshold=0.75,
)

NEXT_ACTION_QUALITY_CRITERIA = GEval(
    name="Next Action Quality",
    criteria="Evaluate suggested next action quality: (1) starts with action verb, (2) is specific and concrete, (3) includes relevant context (who/where/what), (4) is completable in one session, (5) avoids vague language",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    threshold=0.8,
)
