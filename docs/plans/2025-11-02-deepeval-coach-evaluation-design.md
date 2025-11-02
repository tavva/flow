# Flow Coach Evaluation with deepeval

**Date:** 2025-11-02
**Status:** Approved

## Overview

We will replace the obsolete inbox processing evaluation framework with a comprehensive evaluation system for the Flow Coach conversational AI using deepeval. The new system evaluates tool usage accuracy, GTD coaching quality, and conversation coherence across both single-turn and multi-turn coaching scenarios.

## Motivation

The current evaluation framework (`evaluation/`) tests the inbox processing workflow, which we have removed from the codebase. The Flow Coach chat interface now serves as the primary AI-powered feature and demands robust evaluation.

Flow Coach operates conversationally and across multiple turns, unlike the old single-turn inbox processor. It needs evaluation that:
- Validates correct tool usage (creating actions, modifying projects, displaying cards)
- Measures GTD coaching quality and advice soundness
- Ensures conversation coherence across multiple turns

deepeval provides standardized metrics, LLM-as-judge capabilities, and reporting infrastructure that our custom framework lacks.

## Evaluation Dimensions

### 1. Tool Usage Accuracy
Coach must call the right tools with correct parameters based on conversation context.

**Approach:** DAG (Directed Acyclic Graph) metric with deterministic decision tree scoring.

### 2. GTD Coaching Quality
Coach must provide sound GTD advice following established principles (clear next actions, defined project outcomes, etc.).

**Approach:** G-Eval (LLM-as-judge) with GTD-specific criteria.

### 3. Conversation Coherence
Coach must maintain context and provide relevant responses throughout multi-turn conversations.

**Approach:** deepeval's built-in Answer Relevancy metric.

## Test Case Structure

### TypeScript Interface

```typescript
interface CoachTestCase {
  id: string;
  description: string;
  type: 'single-turn' | 'multi-turn';

  conversation: ConversationTurn[];

  vaultContext: {
    projects: FlowProject[];
    nextActions: string[];
    somedayItems: string[];
    protocolActive?: string;
  };

  expectations: {
    toolUsage?: ToolUsageExpectation[];
    coachingQuality: GEvalCriteria;
    conversationCoherence?: CoherenceExpectation;
  };
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  expectedTools?: ExpectedToolCall[];
  actualTools?: ToolCall[];
}
```

### Example: Single-Turn Test

```json
{
  "id": "stalled-project-advice",
  "description": "Coach identifies stalled project and suggests next action",
  "type": "single-turn",
  "conversation": [
    {
      "role": "user",
      "content": "I have a project 'Website Redesign' with no next actions. What should I do?"
    },
    {
      "role": "assistant",
      "content": "(Coach response here)",
      "expectedTools": [
        {
          "name": "create_next_action",
          "parameters": {
            "project": "Website Redesign",
            "sphere": "work"
          }
        }
      ]
    }
  ],
  "vaultContext": {
    "projects": [
      {
        "title": "Website Redesign",
        "status": "live",
        "sphere": "work",
        "nextActions": []
      }
    ],
    "nextActions": [],
    "somedayItems": []
  },
  "expectations": {
    "toolUsage": [
      {
        "shouldCallTool": true,
        "toolName": "create_next_action",
        "requiredParams": ["project", "text"]
      }
    ],
    "coachingQuality": {
      "criteria": [
        "Identifies the project as stalled",
        "Suggests specific, actionable next step",
        "Follows GTD principles for next actions"
      ],
      "threshold": 0.8
    }
  }
}
```

### Example: Multi-Turn Test

```json
{
  "id": "weekly-review-guidance",
  "description": "Coach guides user through weekly review process",
  "type": "multi-turn",
  "conversation": [
    {
      "role": "user",
      "content": "Help me do my weekly review"
    },
    {
      "role": "assistant",
      "content": "(Coach suggests starting with inbox)",
      "expectedTools": []
    },
    {
      "role": "user",
      "content": "My inbox is empty. What's next?"
    },
    {
      "role": "assistant",
      "content": "(Coach suggests reviewing projects)",
      "expectedTools": [
        {
          "name": "display_projects_card",
          "parameters": { "sphere": "work" }
        }
      ]
    }
  ],
  "vaultContext": {
    "projects": [
      { "title": "Project A", "sphere": "work", "nextActions": [] },
      { "title": "Project B", "sphere": "work", "nextActions": [] }
    ],
    "nextActions": [],
    "somedayItems": []
  },
  "expectations": {
    "toolUsage": [
      { "turn": 2, "shouldCallTool": true, "toolName": "display_projects_card" }
    ],
    "coachingQuality": {
      "criteria": [
        "Follows standard weekly review workflow",
        "Maintains context across conversation turns",
        "Provides actionable guidance at each step"
      ],
      "threshold": 0.75
    }
  }
}
```

## Metrics Implementation

### 1. DAG Tool Correctness Metric

We evaluate tool usage through a decision tree:

1. **Node 1:** Does the agent call tools when expected? (Yes/No decision)
2. **Node 2:** Does the agent use correct tool types? (Validate tool names)
3. **Node 3:** Does the agent provide correct parameters? (Validate required params present)

Each path through the tree maps to a hard-coded score (0.0 to 1.0).

```typescript
class ToolCorrectnessMetric extends BaseMetric {
  async evaluate(testCase: CoachTestCase, actualOutput: CoachResponse) {
    const decisions = [];

    for (const turn of testCase.conversation) {
      if (turn.role === 'assistant' && turn.expectedTools) {
        const toolsCalled = actualOutput.toolCalls.length > 0;
        const shouldCallTools = turn.expectedTools.length > 0;

        if (toolsCalled !== shouldCallTools) {
          decisions.push({ node: 'tool_decision', passed: false });
          continue;
        }

        const correctTools = this.validateToolTypes(
          turn.expectedTools,
          actualOutput.toolCalls
        );
        decisions.push({ node: 'tool_types', passed: correctTools });

        if (correctTools) {
          const correctParams = this.validateToolParams(
            turn.expectedTools,
            actualOutput.toolCalls
          );
          decisions.push({ node: 'tool_params', passed: correctParams });
        }
      }
    }

    return this.calculateScore(decisions);
  }
}
```

### 2. G-Eval Coaching Quality Metric

We use Claude as LLM judge with GTD-specific criteria:

```typescript
const coachingQualityCriteria = {
  name: "GTD Coaching Quality",
  criteria: [
    "Does the advice follow GTD principles (clear next actions, project outcomes)?",
    "Does the coaching provide specific, actionable guidance rather than vague suggestions?",
    "Does the advice help the user maintain their GTD system effectively?",
    "Does the coach use a supportive, encouraging tone?"
  ],
  evaluationSteps: [
    "Assess whether advice aligns with GTD methodology",
    "Check for specific, actionable guidance",
    "Evaluate helpfulness for system maintenance",
    "Consider tone and communication style"
  ]
};

const metric = new GEval({
  criteria: coachingQualityCriteria,
  threshold: 0.7
});
```

### 3. Answer Relevancy (Built-in)

deepeval's built-in metric validates response relevance using conversation history.

## Test Execution Flow

```typescript
// tests/coach-evaluation/coach-evaluator.test.ts

import { assert_test } from "deepeval";
import { CoachTestRunner } from "./coach-test-runner";

describe("Flow Coach Evaluation", () => {
  const testRunner = new CoachTestRunner();
  const testCases = require("./test-cases.json");

  testCases.forEach((testCase: CoachTestCase) => {
    test(`[${testCase.type}] ${testCase.description}`, async () => {
      // 1. Set up mocked vault context
      const mockVault = testRunner.createMockVault(testCase.vaultContext);

      // 2. Run conversation with auto-approved tools
      const actualOutput = await testRunner.runConversation(
        testCase.conversation,
        mockVault
      );

      // 3. Create deepeval test case
      const deepevalCase = {
        input: testCase.conversation,
        actual_output: actualOutput.messages.join('\n'),
        context: testCase.vaultContext
      };

      // 4. Evaluate with multiple metrics
      const metrics = [
        new ToolCorrectnessMetric(testCase.expectations.toolUsage),
        new GEval(testCase.expectations.coachingQuality),
        new AnswerRelevancy(threshold: 0.7)
      ];

      // 5. Assert using deepeval
      await assert_test(deepevalCase, metrics);
    });
  });
});
```

### Tool Mocking Strategy

Tests automatically approve all tool calls and use mocked vault state. This keeps tests fast and focused on Coach's decision-making rather than vault mechanics.

## Project Structure

```
tests/
├── coach-evaluation/
│   ├── test-cases.json           # Test scenarios
│   ├── coach-evaluator.test.ts   # Main test file
│   ├── coach-test-runner.ts      # Conversation execution
│   ├── mock-vault.ts              # Vault context mocking
│   ├── metrics/
│   │   ├── tool-correctness.ts   # DAG-based tool metric
│   │   └── gtd-quality.ts        # G-Eval criteria definitions
│   └── results/                   # Test results (timestamped)
└── (existing tests remain)
```

## Configuration

### deepeval Configuration

```typescript
// deepeval.config.ts
export default {
  testPath: "tests/coach-evaluation",
  metrics: {
    threshold: 0.7,
    providers: {
      evaluator: "openai",
      apiBase: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-sonnet-4.5",
      apiKey: process.env.OPENROUTER_API_KEY
    }
  }
};
```

### NPM Scripts

```json
{
  "scripts": {
    "evaluate:coach": "deepeval test run tests/coach-evaluation/",
    "evaluate:coach:watch": "deepeval test run tests/coach-evaluation/ --watch",
    "evaluate:coach:report": "deepeval test run tests/coach-evaluation/ --create-report"
  }
}
```

### Dependencies

```json
{
  "devDependencies": {
    "deepeval": "^1.0.0",
    "pytest": "^7.0.0"
  }
}
```

## Integration with Existing Tests

- Keep existing Jest tests for unit/integration testing
- Run Coach evaluation separately (different framework)
- Run both in CI: `npm test && npm run evaluate:coach`
- Set `OPENROUTER_API_KEY` as CI secret

## Migration Plan

1. Remove obsolete `evaluation/` directory
2. Set up deepeval infrastructure and configuration
3. Implement custom metrics (DAG tool correctness)
4. Create initial test cases (5-10 scenarios covering common coaching flows)
5. Integrate into CI/CD pipeline
6. Expand test coverage over time

## Success Criteria

- Coach evaluation runs successfully with deepeval
- We implement tool correctness, coaching quality, and relevancy metrics
- We create minimum 5 test cases covering key coaching scenarios
- CI fails if metrics drop below thresholds
- We track results over time for regression detection

## Future Enhancements

- Add Faithfulness metric to validate against GTD reference materials
- Expand test case coverage (target: 20+ scenarios)
- Optional: Push results to Confident AI platform for dashboard visualization
- Track performance metrics (latency, token usage)
- A/B test different coaching prompt strategies
