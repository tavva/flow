# Deepeval Coach Evaluation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace obsolete inbox evaluation with deepeval-based evaluation system for Flow Coach conversational AI

**Architecture:** Python deepeval framework evaluating TypeScript Flow Coach through test runner bridge. DAG metrics for tool correctness, G-Eval for coaching quality, built-in Answer Relevancy for conversation coherence.

**Tech Stack:** deepeval (Python), pytest, TypeScript test runner, Jest (existing tests remain separate)

---

## Task 1: Remove Obsolete Evaluation Framework

**Files:**

- Delete: `evaluation/` directory (entire)
- Modify: `package.json` (remove evaluate script)
- Modify: `CLAUDE.md` (update evaluation references)

**Step 1: Remove evaluation directory**

```bash
git rm -r evaluation/
```

**Step 2: Update package.json**

Remove this line from scripts section:

```json
"evaluate": "ts-node -P evaluation/tsconfig.json evaluation/run-evaluation.ts",
```

**Step 3: Update CLAUDE.md references**

Find and remove/update references to the old evaluation framework:

```bash
grep -n "evaluation" CLAUDE.md
```

Update the "Common Commands" section to remove the evaluate command.
Update the "Evaluation Framework" section to note it's being replaced.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete inbox processing evaluation framework"
```

---

## Task 2: Set Up Python Environment and deepeval

**Files:**

- Create: `requirements.txt`
- Create: `.python-version`
- Create: `pyproject.toml`
- Create: `.gitignore` additions

**Step 1: Create Python version file**

Create `.python-version`:

```
3.11
```

**Step 2: Create requirements.txt**

Create `requirements.txt`:

```
deepeval==1.0.0
pytest==7.4.3
pytest-asyncio==0.21.1
```

**Step 3: Create pyproject.toml**

Create `pyproject.toml`:

```toml
[build-system]
requires = ["setuptools>=42", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "flow-coach-eval"
version = "0.1.0"
description = "Flow Coach evaluation using deepeval"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["tests/coach-evaluation"]
python_files = "test_*.py"
python_classes = "Test*"
python_functions = "test_*"
```

**Step 4: Update .gitignore**

Add to `.gitignore`:

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv
.pytest_cache/

# deepeval
.deepeval/
tests/coach-evaluation/results/
```

**Step 5: Install Python dependencies**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Expected output: Successfully installed deepeval, pytest, pytest-asyncio

**Step 6: Verify deepeval installation**

```bash
deepeval --version
```

Expected output: deepeval, version 1.0.0

**Step 7: Commit**

```bash
git add requirements.txt .python-version pyproject.toml .gitignore
git commit -m "feat: add Python environment and deepeval dependencies"
```

---

## Task 3: Create deepeval Configuration

**Files:**

- Create: `deepeval.config.ts`
- Create: `.env.example`

**Step 1: Create deepeval config**

Create `deepeval.config.ts`:

```typescript
export default {
  testPath: "tests/coach-evaluation",
  metrics: {
    threshold: 0.7,
    providers: {
      evaluator: "openai",
      apiBase: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-sonnet-4.5",
      apiKey: process.env.OPENROUTER_API_KEY,
    },
  },
};
```

**Step 2: Create .env.example**

Create `.env.example`:

```
# OpenRouter API key for deepeval G-Eval metrics
OPENROUTER_API_KEY=your-key-here
```

**Step 3: Update .gitignore for .env**

Verify `.gitignore` contains:

```
.env
```

(Should already exist, but verify)

**Step 4: Commit**

```bash
git add deepeval.config.ts .env.example
git commit -m "feat: add deepeval configuration"
```

---

## Task 4: Create Test Infrastructure - Type Definitions

**Files:**

- Create: `tests/coach-evaluation/types.ts`

**Step 1: Create types file**

Create `tests/coach-evaluation/types.ts`:

```typescript
// ABOUTME: Type definitions for deepeval coach evaluation test cases
// ABOUTME: Defines test case structure, expectations, and vault context mocking

import { FlowProject } from "../../src/types";
import { ToolCall } from "../../src/language-model";

export interface CoachTestCase {
  id: string;
  description: string;
  type: "single-turn" | "multi-turn";
  conversation: ConversationTurn[];
  vaultContext: VaultContext;
  expectations: TestExpectations;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  expectedTools?: ExpectedToolCall[];
  actualTools?: ToolCall[];
}

export interface VaultContext {
  projects: FlowProject[];
  nextActions: string[];
  somedayItems: string[];
  protocolActive?: string;
}

export interface ExpectedToolCall {
  name: string;
  parameters?: Record<string, any>;
}

export interface TestExpectations {
  toolUsage?: ToolUsageExpectation[];
  coachingQuality: GEvalCriteria;
  conversationCoherence?: CoherenceExpectation;
}

export interface ToolUsageExpectation {
  turn?: number;
  shouldCallTool: boolean;
  toolName?: string;
  requiredParams?: string[];
}

export interface GEvalCriteria {
  criteria: string[];
  threshold: number;
}

export interface CoherenceExpectation {
  maintainsContext: boolean;
  respondsToUserFeedback: boolean;
}

export interface CoachResponse {
  messages: string[];
  toolCalls: ToolCall[];
}
```

**Step 2: Commit**

```bash
git add tests/coach-evaluation/types.ts
git commit -m "feat: add coach evaluation type definitions"
```

---

## Task 5: Create Mock Vault Infrastructure

**Files:**

- Create: `tests/coach-evaluation/mock-vault.ts`
- Test: Create simple test to verify mock works

**Step 1: Create mock vault**

Create `tests/coach-evaluation/mock-vault.ts`:

```typescript
// ABOUTME: Creates mock Obsidian vault for coach evaluation tests
// ABOUTME: Provides mocked app, file system, and vault data for isolated testing

import { App, TFile, Vault, TFolder, MetadataCache } from "obsidian";
import { VaultContext } from "./types";
import { FlowProject } from "../../src/types";

export class MockVault {
  public app: Partial<App>;
  public vault: Partial<Vault>;
  public metadataCache: Partial<MetadataCache>;
  private files: Map<string, TFile>;
  private fileContents: Map<string, string>;

  constructor(context: VaultContext) {
    this.files = new Map();
    this.fileContents = new Map();

    // Create mock vault
    this.vault = {
      getAbstractFileByPath: (path: string) => {
        return this.files.get(path) || null;
      },
      read: async (file: TFile) => {
        return this.fileContents.get(file.path) || "";
      },
      modify: async (file: TFile, data: string) => {
        this.fileContents.set(file.path, data);
      },
      create: async (path: string, data: string) => {
        const file = this.createMockFile(path);
        this.files.set(path, file);
        this.fileContents.set(path, data);
        return file;
      },
    };

    // Create mock metadata cache
    this.metadataCache = {
      getFileCache: (file: TFile) => {
        return {
          frontmatter: this.parseFrontmatter(file),
        };
      },
    };

    // Create mock app
    this.app = {
      vault: this.vault as Vault,
      metadataCache: this.metadataCache as MetadataCache,
    };

    // Initialize vault with context
    this.initializeVault(context);
  }

  private createMockFile(path: string): TFile {
    return {
      path,
      name: path.split("/").pop() || "",
      basename: path.split("/").pop()?.replace(/\.md$/, "") || "",
      extension: "md",
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
      parent: null as any,
      vault: this.vault as Vault,
    } as TFile;
  }

  private parseFrontmatter(file: TFile): any {
    const content = this.fileContents.get(file.path) || "";
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontmatter: any = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        frontmatter[key.trim()] = value.replace(/^"(.*)"$/, "$1");
      }
    }
    return frontmatter;
  }

  private initializeVault(context: VaultContext): void {
    // Create project files
    context.projects.forEach((project) => {
      const path = `Projects/${project.title}.md`;
      const content = this.projectToMarkdown(project);
      const file = this.createMockFile(path);
      this.files.set(path, file);
      this.fileContents.set(path, content);
    });

    // Create Next Actions file
    const nextActionsPath = "Next actions.md";
    const nextActionsContent = this.createNextActionsFile(context.nextActions);
    const nextActionsFile = this.createMockFile(nextActionsPath);
    this.files.set(nextActionsPath, nextActionsFile);
    this.fileContents.set(nextActionsPath, nextActionsContent);

    // Create Someday file
    const somedayPath = "Someday.md";
    const somedayContent = this.createSomedayFile(context.somedayItems);
    const somedayFile = this.createMockFile(somedayPath);
    this.files.set(somedayPath, somedayFile);
    this.fileContents.set(somedayPath, somedayContent);
  }

  private projectToMarkdown(project: FlowProject): string {
    let content = "---\n";
    content += `creation-date: ${project.creationDate || "2025-01-01"}\n`;
    content += `priority: ${project.priority || 2}\n`;
    content += `tags: project/${project.sphere}\n`;
    content += `status: ${project.status}\n`;
    content += "---\n\n";
    content += `# ${project.title}\n\n`;
    content += `${project.description || "Project description"}\n\n`;
    content += "## Next actions\n\n";
    project.nextActions.forEach((action) => {
      content += `- [ ] ${action}\n`;
    });
    return content;
  }

  private createNextActionsFile(actions: string[]): string {
    let content = "# Next Actions\n\n";
    actions.forEach((action) => {
      content += `- [ ] ${action}\n`;
    });
    return content;
  }

  private createSomedayFile(items: string[]): string {
    let content = "# Someday/Maybe\n\n";
    items.forEach((item) => {
      content += `- [ ] ${item}\n`;
    });
    return content;
  }

  public getApp(): App {
    return this.app as App;
  }

  public getFileContent(path: string): string {
    return this.fileContents.get(path) || "";
  }

  public getAllFiles(): TFile[] {
    return Array.from(this.files.values());
  }
}
```

**Step 2: Create simple test for mock vault**

Create `tests/coach-evaluation/mock-vault.test.ts`:

```typescript
import { MockVault } from "./mock-vault";
import { VaultContext } from "./types";

describe("MockVault", () => {
  it("creates vault with project files", () => {
    const context: VaultContext = {
      projects: [
        {
          title: "Test Project",
          status: "live",
          sphere: "work",
          nextActions: ["Action 1", "Action 2"],
          priority: 2,
          creationDate: "2025-01-01",
        },
      ],
      nextActions: [],
      somedayItems: [],
    };

    const mockVault = new MockVault(context);
    const files = mockVault.getAllFiles();

    expect(files.length).toBeGreaterThan(0);
    const projectFile = files.find((f) => f.path.includes("Test Project"));
    expect(projectFile).toBeDefined();

    if (projectFile) {
      const content = mockVault.getFileContent(projectFile.path);
      expect(content).toContain("Test Project");
      expect(content).toContain("Action 1");
    }
  });
});
```

**Step 3: Run test**

```bash
npm test -- mock-vault.test.ts
```

Expected: PASS (1 test)

**Step 4: Commit**

```bash
git add tests/coach-evaluation/mock-vault.ts tests/coach-evaluation/mock-vault.test.ts
git commit -m "feat: add mock vault infrastructure for coach evaluation"
```

---

## Task 6: Create Coach Test Runner

**Files:**

- Create: `tests/coach-evaluation/coach-test-runner.ts`

**Step 1: Write failing test**

Create `tests/coach-evaluation/coach-test-runner.test.ts`:

```typescript
import { CoachTestRunner } from "./coach-test-runner";
import { CoachTestCase, VaultContext } from "./types";

describe("CoachTestRunner", () => {
  it("runs single-turn conversation and captures tool calls", async () => {
    const testCase: CoachTestCase = {
      id: "test-1",
      description: "Test conversation",
      type: "single-turn",
      conversation: [
        {
          role: "user",
          content: "Test message",
        },
      ],
      vaultContext: {
        projects: [],
        nextActions: [],
        somedayItems: [],
      },
      expectations: {
        coachingQuality: {
          criteria: ["Helpful"],
          threshold: 0.7,
        },
      },
    };

    const runner = new CoachTestRunner();
    const result = await runner.runConversation(testCase);

    expect(result).toBeDefined();
    expect(result.messages).toBeInstanceOf(Array);
    expect(result.toolCalls).toBeInstanceOf(Array);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- coach-test-runner.test.ts
```

Expected: FAIL with "Cannot find module './coach-test-runner'"

**Step 3: Implement CoachTestRunner**

Create `tests/coach-evaluation/coach-test-runner.ts`:

```typescript
// ABOUTME: Runs coach conversations for evaluation tests with auto-approved tools
// ABOUTME: Executes test cases, captures messages and tool calls, mocks vault operations

import { MockVault } from "./mock-vault";
import { CoachTestCase, CoachResponse } from "./types";
import { LanguageModelClient, ToolCall } from "../../src/language-model";
import { COACH_TOOLS, createToolExecutor } from "../../src/coach-tools";
import { getLanguageModelClient } from "../../src/llm-factory";
import { DEFAULT_SETTINGS } from "../../src/types";

export class CoachTestRunner {
  private modelClient: LanguageModelClient;

  constructor() {
    // Use environment variable for test API key
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    const settings = {
      ...DEFAULT_SETTINGS,
      llmProvider: "openai-compatible" as const,
      openaiApiKey: apiKey,
      openaiBaseUrl: "https://openrouter.ai/api/v1",
      openaiModel: "anthropic/claude-sonnet-4.5",
    };

    this.modelClient = getLanguageModelClient(settings);
  }

  async runConversation(testCase: CoachTestCase): Promise<CoachResponse> {
    const mockVault = new MockVault(testCase.vaultContext);
    const messages: string[] = [];
    const toolCalls: ToolCall[] = [];

    // Create auto-approving tool executor
    const toolExecutor = createToolExecutor(
      mockVault.getApp(),
      DEFAULT_SETTINGS,
      async () => {}, // No UI updates needed
      () => true // Auto-approve all tools
    );

    // Build conversation history
    const conversationHistory: Array<{ role: string; content: string }> = [];

    for (const turn of testCase.conversation) {
      if (turn.role === "user") {
        conversationHistory.push({
          role: "user",
          content: turn.content,
        });

        // Get coach response
        const response = await this.modelClient.sendMessage(conversationHistory, COACH_TOOLS);

        messages.push(response.content);
        conversationHistory.push({
          role: "assistant",
          content: response.content,
        });

        // Execute any tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            toolCalls.push(toolCall);
            await toolExecutor.executeTool(toolCall);
          }
        }
      }
    }

    return {
      messages,
      toolCalls,
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- coach-test-runner.test.ts
```

Expected: PASS (1 test) - Note: Requires OPENROUTER_API_KEY env var

**Step 5: Commit**

```bash
git add tests/coach-evaluation/coach-test-runner.ts tests/coach-evaluation/coach-test-runner.test.ts
git commit -m "feat: add coach test runner for evaluation"
```

---

## Task 7: Create DAG Tool Correctness Metric (Python)

**Files:**

- Create: `tests/coach-evaluation/metrics/tool_correctness.py`

**Step 1: Create metric file**

Create `tests/coach-evaluation/metrics/tool_correctness.py`:

```python
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
        # Extract actual tool calls from test case context
        actual_tools = test_case.context.get("tool_calls", [])

        # Decision Node 1: Were tools called when expected?
        tools_called = len(actual_tools) > 0
        should_call_tools = len(self.expected_tools) > 0

        if tools_called != should_call_tools:
            self.decisions.append({"node": "tool_decision", "passed": False})
            return 0.0

        if not should_call_tools:
            # No tools expected or called - perfect score
            return 1.0

        # Decision Node 2: Correct tool types?
        correct_tools = self._validate_tool_types(actual_tools)
        self.decisions.append({"node": "tool_types", "passed": correct_tools})

        if not correct_tools:
            return 0.4  # Called tools, but wrong types

        # Decision Node 3: Correct parameters?
        correct_params = self._validate_tool_params(actual_tools)
        self.decisions.append({"node": "tool_params", "passed": correct_params})

        if correct_params:
            return 1.0  # Perfect score
        else:
            return 0.7  # Right tools, wrong params

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
```

**Step 2: Create simple Python test**

Create `tests/coach-evaluation/metrics/test_tool_correctness.py`:

```python
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
        context={"tool_calls": []},
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
        context={"tool_calls": [{"name": "unexpected_tool"}]},
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
        input="test", actual_output="response", context={"tool_calls": actual_tools}
    )

    score = metric.measure(test_case)
    assert score == 1.0
    assert metric.is_successful()
```

**Step 3: Run Python tests**

```bash
source venv/bin/activate
pytest tests/coach-evaluation/metrics/test_tool_correctness.py -v
```

Expected: 3 passed

**Step 4: Commit**

```bash
git add tests/coach-evaluation/metrics/tool_correctness.py tests/coach-evaluation/metrics/test_tool_correctness.py
git commit -m "feat: add DAG tool correctness metric"
```

---

## Task 8: Create G-Eval Criteria Definitions (Python)

**Files:**

- Create: `tests/coach-evaluation/metrics/gtd_quality.py`

**Step 1: Create GTD quality criteria**

Create `tests/coach-evaluation/metrics/gtd_quality.py`:

```python
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
```

**Step 2: Commit**

```bash
git add tests/coach-evaluation/metrics/gtd_quality.py
git commit -m "feat: add G-Eval GTD quality criteria definitions"
```

---

## Task 9: Create Initial Test Cases

**Files:**

- Create: `tests/coach-evaluation/test-cases.json`

**Step 1: Create test cases file**

Create `tests/coach-evaluation/test-cases.json`:

```json
[
  {
    "id": "stalled-project-advice",
    "description": "Coach identifies stalled project and suggests next action",
    "type": "single-turn",
    "conversation": [
      {
        "role": "user",
        "content": "I have a project 'Website Redesign' with no next actions. What should I do?"
      }
    ],
    "vaultContext": {
      "projects": [
        {
          "title": "Website Redesign",
          "status": "live",
          "sphere": "work",
          "nextActions": [],
          "priority": 2,
          "creationDate": "2025-01-01"
        }
      ],
      "nextActions": [],
      "somedayItems": []
    },
    "expectations": {
      "toolUsage": [
        {
          "shouldCallTool": false,
          "toolName": "add_next_action_to_project",
          "requiredParams": ["project_path", "action_text"]
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
  },
  {
    "id": "general-coaching-question",
    "description": "Coach provides GTD advice for general question",
    "type": "single-turn",
    "conversation": [
      {
        "role": "user",
        "content": "How should I organize my projects?"
      }
    ],
    "vaultContext": {
      "projects": [],
      "nextActions": [],
      "somedayItems": []
    },
    "expectations": {
      "toolUsage": [
        {
          "shouldCallTool": false
        }
      ],
      "coachingQuality": {
        "criteria": [
          "Provides GTD-aligned advice",
          "Gives specific, actionable recommendations",
          "Maintains supportive tone"
        ],
        "threshold": 0.7
      }
    }
  },
  {
    "id": "weekly-review-start",
    "description": "Coach helps user start weekly review",
    "type": "single-turn",
    "conversation": [
      {
        "role": "user",
        "content": "Help me do my weekly review"
      }
    ],
    "vaultContext": {
      "projects": [
        {
          "title": "Project A",
          "status": "live",
          "sphere": "work",
          "nextActions": ["Call vendor"],
          "priority": 2,
          "creationDate": "2025-01-01"
        }
      ],
      "nextActions": ["Buy groceries"],
      "somedayItems": ["Learn Spanish"]
    },
    "expectations": {
      "toolUsage": [
        {
          "shouldCallTool": false
        }
      ],
      "coachingQuality": {
        "criteria": [
          "Suggests starting with inbox review",
          "Provides clear next steps",
          "Follows GTD weekly review workflow"
        ],
        "threshold": 0.75
      }
    }
  },
  {
    "id": "project-status-question",
    "description": "Coach advises on project with no clear outcome",
    "type": "single-turn",
    "conversation": [
      {
        "role": "user",
        "content": "I have a project called 'stuff' and I don't know what it's for"
      }
    ],
    "vaultContext": {
      "projects": [
        {
          "title": "stuff",
          "status": "live",
          "sphere": "personal",
          "nextActions": [],
          "priority": 2,
          "creationDate": "2025-01-01"
        }
      ],
      "nextActions": [],
      "somedayItems": []
    },
    "expectations": {
      "toolUsage": [
        {
          "shouldCallTool": false
        }
      ],
      "coachingQuality": {
        "criteria": [
          "Suggests clarifying project outcome",
          "Recommends either defining it or moving to someday/deleting",
          "Follows GTD project definition principles"
        ],
        "threshold": 0.75
      }
    }
  },
  {
    "id": "too-many-projects",
    "description": "Coach helps user with project overload",
    "type": "single-turn",
    "conversation": [
      {
        "role": "user",
        "content": "I have 50 active projects and feel overwhelmed"
      }
    ],
    "vaultContext": {
      "projects": [],
      "nextActions": [],
      "somedayItems": []
    },
    "expectations": {
      "toolUsage": [
        {
          "shouldCallTool": false
        }
      ],
      "coachingQuality": {
        "criteria": [
          "Acknowledges the overwhelm",
          "Suggests reviewing and moving some to someday/maybe",
          "Recommends focusing on fewer active projects",
          "Maintains supportive, non-judgmental tone"
        ],
        "threshold": 0.75
      }
    }
  }
]
```

**Step 2: Commit**

```bash
git add tests/coach-evaluation/test-cases.json
git commit -m "feat: add initial coach evaluation test cases"
```

---

## Task 10: Create Python-TypeScript Bridge

**Files:**

- Create: `tests/coach-evaluation/bridge.py`
- Create: `tests/coach-evaluation/run_test_case.ts`

**Step 1: Create TypeScript test runner script**

Create `tests/coach-evaluation/run_test_case.ts`:

```typescript
#!/usr/bin/env ts-node
// ABOUTME: CLI script to run single test case from Python bridge
// ABOUTME: Loads test case JSON, executes conversation, outputs results as JSON

import { CoachTestRunner } from "./coach-test-runner";
import { CoachTestCase } from "./types";
import * as fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: ts-node run_test_case.ts <test-case-json>");
    process.exit(1);
  }

  const testCaseJson = args[0];
  const testCase: CoachTestCase = JSON.parse(testCaseJson);

  const runner = new CoachTestRunner();
  const result = await runner.runConversation(testCase);

  // Output result as JSON
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error("Error running test case:", error);
  process.exit(1);
});
```

**Step 2: Make script executable**

```bash
chmod +x tests/coach-evaluation/run_test_case.ts
```

**Step 3: Create Python bridge**

Create `tests/coach-evaluation/bridge.py`:

```python
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
            ["ts-node", self.script_path, test_case_json],
            capture_output=True,
            text=True,
            check=True,
        )

        # Parse JSON output
        return json.loads(result.stdout)
```

**Step 4: Create Python test for bridge**

Create `tests/coach-evaluation/test_bridge.py`:

```python
"""Test Python-TypeScript bridge."""

import pytest
from .bridge import CoachTestBridge


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
```

**Step 5: Test the bridge**

```bash
source venv/bin/activate
pytest tests/coach-evaluation/test_bridge.py -v
```

Expected: 1 passed (requires OPENROUTER_API_KEY)

**Step 6: Commit**

```bash
git add tests/coach-evaluation/run_test_case.ts tests/coach-evaluation/bridge.py tests/coach-evaluation/test_bridge.py
git commit -m "feat: add Python-TypeScript bridge for coach evaluation"
```

---

## Task 11: Create deepeval Test File

**Files:**

- Create: `tests/coach-evaluation/test_coach_evaluation.py`

**Step 1: Create deepeval test file**

Create `tests/coach-evaluation/test_coach_evaluation.py`:

```python
"""
deepeval-based tests for Flow Coach evaluation.
Runs test cases through TypeScript bridge and evaluates with deepeval metrics.
"""

import json
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancy

from .bridge import CoachTestBridge
from .metrics.tool_correctness import ToolCorrectnessMetric
from .metrics.gtd_quality import create_coaching_quality_metric


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

    # Create deepeval test case
    deepeval_case = LLMTestCase(
        input=conversation_input,
        actual_output=actual_output,
        context={
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
    metrics.append(AnswerRelevancy(threshold=0.7))

    # Run deepeval assertion
    assert_test(deepeval_case, metrics)
```

**Step 2: Commit**

```bash
git add tests/coach-evaluation/test_coach_evaluation.py
git commit -m "feat: add deepeval test file for coach evaluation"
```

---

## Task 12: Update NPM Scripts

**Files:**

- Modify: `package.json`

**Step 1: Add coach evaluation scripts**

Add to `package.json` scripts section:

```json
"evaluate:coach": "source venv/bin/activate && deepeval test run tests/coach-evaluation/test_coach_evaluation.py",
"evaluate:coach:watch": "source venv/bin/activate && deepeval test run tests/coach-evaluation/test_coach_evaluation.py --watch",
"evaluate:coach:report": "source venv/bin/activate && deepeval test run tests/coach-evaluation/test_coach_evaluation.py --create-report"
```

**Step 2: Verify scripts work**

```bash
npm run evaluate:coach
```

Expected: Runs deepeval tests (requires OPENROUTER_API_KEY)

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add NPM scripts for coach evaluation"
```

---

## Task 13: Update Documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `README.md` (if exists)

**Step 1: Update CLAUDE.md**

Update the "Evaluation Framework" section in `CLAUDE.md`:

````markdown
### Coach Evaluation with deepeval

The plugin includes comprehensive evaluation for the Flow Coach conversational AI using deepeval.

```bash
# Run coach evaluation (requires OPENROUTER_API_KEY)
npm run evaluate:coach

# Run with watch mode
npm run evaluate:coach:watch

# Generate detailed report
npm run evaluate:coach:report
```
````

The evaluation framework tests:

- **Tool usage accuracy** - DAG metric validates correct tool calls
- **GTD coaching quality** - G-Eval measures advice quality against GTD principles
- **Conversation coherence** - Answer Relevancy ensures contextual responses

**Test cases** are in `tests/coach-evaluation/test-cases.json`.
**Metrics** are in `tests/coach-evaluation/metrics/`.
**Results** are saved to `tests/coach-evaluation/results/`.

See `docs/plans/2025-11-02-deepeval-coach-evaluation-design.md` for architecture details.

````

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with coach evaluation info"
````

---

## Task 14: Create CI Integration (Optional)

**Files:**

- Modify: `.github/workflows/test.yml` (if exists)

**Step 1: Check if CI exists**

```bash
ls .github/workflows/
```

If test workflow exists, proceed. Otherwise skip this task.

**Step 2: Add coach evaluation to CI**

Add to workflow (after existing tests):

```yaml
- name: Set up Python
  uses: actions/setup-python@v4
  with:
    python-version: "3.11"

- name: Install Python dependencies
  run: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt

- name: Run coach evaluation
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: npm run evaluate:coach
```

**Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add coach evaluation to CI pipeline"
```

---

## Verification Steps

After completing all tasks:

1. **Verify Python environment:**

   ```bash
   source venv/bin/activate
   deepeval --version
   ```

2. **Verify TypeScript tests:**

   ```bash
   npm test
   ```

   Expected: All existing tests pass

3. **Verify mock vault:**

   ```bash
   npm test -- mock-vault.test.ts
   ```

   Expected: PASS

4. **Verify Python metrics:**

   ```bash
   pytest tests/coach-evaluation/metrics/ -v
   ```

   Expected: All metric tests pass

5. **Verify bridge:**

   ```bash
   pytest tests/coach-evaluation/test_bridge.py -v
   ```

   Expected: PASS (requires OPENROUTER_API_KEY)

6. **Run full coach evaluation:**

   ```bash
   export OPENROUTER_API_KEY=<your-key>
   npm run evaluate:coach
   ```

   Expected: deepeval runs all test cases

7. **Check git status:**
   ```bash
   git status
   ```
   Expected: Clean working directory

---

## Success Criteria

- ✅ Old `evaluation/` directory removed
- ✅ Python environment set up with deepeval
- ✅ Mock vault infrastructure works
- ✅ Coach test runner executes conversations
- ✅ DAG tool correctness metric implemented
- ✅ G-Eval criteria defined
- ✅ 5 initial test cases created
- ✅ Python-TypeScript bridge working
- ✅ deepeval tests run successfully
- ✅ NPM scripts configured
- ✅ Documentation updated
- ✅ All tests passing

---

## Notes for Implementation

**Environment Variables:**

- `OPENROUTER_API_KEY` required for test execution
- Set in `.env` file locally
- Set as GitHub secret for CI

**Test Execution Order:**

1. TypeScript unit tests (fast, no API calls)
2. Python metric tests (fast, no API calls)
3. Bridge test (requires API key, 1 call)
4. Full evaluation (requires API key, N calls where N = test cases)

**Cost Considerations:**

- Full evaluation makes API calls for each test case
- 5 test cases = ~10 API calls (depends on conversation length)
- Estimate ~$0.01-0.05 per full evaluation run
- Use evaluation sparingly; reserve for significant changes

**Future Enhancements:**

- Add more test cases (target: 20+ covering all coach capabilities)
- Implement Faithfulness metric with GTD reference docs
- Set up Confident AI dashboard for result visualization
- Track regression metrics over time
- Add performance/latency metrics
