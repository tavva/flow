# CLI Tool Support - Task 2: Create CLI Approval Handler

**Goal:** Build approval UI that presents tool calls to user for selection

**Architecture:** Readline-based approval with inline (single) and batch (multiple) modes. Parse user input like "1,3,5" or "all".

**Tech Stack:** Node.js readline, TypeScript

---

### Step 1: Write failing test for approval handler

**File:** `tests/cli-approval.test.ts`

```typescript
import { presentToolCallsForApproval, ApprovalResult } from "../src/cli-approval";
import { ToolCall } from "../src/language-model";
import * as readline from "readline";

// Mock readline
jest.mock("readline");

describe("CLI Approval Handler", () => {
  let mockQuestion: jest.Mock;
  let mockClose: jest.Mock;

  beforeEach(() => {
    mockQuestion = jest.fn();
    mockClose = jest.fn();

    (readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array for no tool calls", async () => {
    const result = await presentToolCallsForApproval([]);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle single tool approval with 'y'", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: { action_text: "Test action" } },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("y");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
    expect(mockClose).toHaveBeenCalled();
  });

  it("should handle single tool approval with 'yes'", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "update_next_action", input: { new_action: "Better text" } },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("yes");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
  });

  it("should handle single tool rejection with 'n'", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: { action_text: "Test" } },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("n");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with 'all'", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
      { id: "call_3", name: "add_next_action_to_project", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("all");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1", "call_2", "call_3"]);
  });

  it("should handle batch approval with 'none'", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("none");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with empty string (none)", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with comma-separated numbers", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
      { id: "call_3", name: "add_next_action_to_project", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("1,3");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1", "call_3"]);
  });

  it("should handle batch approval with spaces in numbers", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
      { id: "call_3", name: "add_next_action_to_project", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback(" 2 , 3 ");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_2", "call_3"]);
  });

  it("should ignore invalid numbers in batch selection", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: {} },
      { id: "call_2", name: "update_next_action", input: {} },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("1,5,99");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
  });

  it("should include context text when provided", async () => {
    const toolCalls: ToolCall[] = [
      { id: "call_1", name: "move_to_hotlist", input: { action_text: "Test" } },
    ];

    let capturedOutput = "";
    const originalLog = console.log;
    console.log = jest.fn((...args) => {
      capturedOutput += args.join(" ") + "\n";
    });

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("y");
    });

    await presentToolCallsForApproval(toolCalls, "Here is my reasoning...");

    console.log = originalLog;

    expect(capturedOutput).toContain("Here is my reasoning...");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- cli-approval.test.ts`

Expected: FAIL with "Cannot find module '../src/cli-approval'"

### Step 3: Implement CLI approval handler

**File:** `src/cli-approval.ts`

```typescript
import * as readline from "readline";
import { ToolCall } from "./language-model";

export interface ApprovalResult {
  approvedToolIds: string[];
}

export async function presentToolCallsForApproval(
  toolCalls: ToolCall[],
  contextText?: string
): Promise<ApprovalResult> {
  if (toolCalls.length === 0) {
    return { approvedToolIds: [] };
  }

  // Show context from LLM if provided
  if (contextText) {
    console.log(`\n${contextText}\n`);
  }

  if (toolCalls.length === 1) {
    return await inlineApproval(toolCalls[0]);
  } else {
    return await batchApproval(toolCalls);
  }
}

async function inlineApproval(toolCall: ToolCall): Promise<ApprovalResult> {
  console.log(`Coach suggests: ${formatToolCallDescription(toolCall)}\n`);

  const answer = await promptUser("Apply this change? (y/n/skip): ");

  if (answer === "y" || answer === "yes") {
    return { approvedToolIds: [toolCall.id] };
  }

  return { approvedToolIds: [] };
}

async function batchApproval(toolCalls: ToolCall[]): Promise<ApprovalResult> {
  console.log(`\nCoach suggests ${toolCalls.length} improvements:\n`);

  toolCalls.forEach((toolCall, index) => {
    console.log(`${index + 1}. ${formatToolCallDescription(toolCall)}\n`);
  });

  const answer = await promptUser(
    "Enter numbers to apply (e.g., '1,3' or 'all' or 'none'): "
  );

  if (answer === "all") {
    return { approvedToolIds: toolCalls.map((tc) => tc.id) };
  }

  if (answer === "none" || answer === "") {
    return { approvedToolIds: [] };
  }

  // Parse comma-separated numbers
  const selectedIndices = answer
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < toolCalls.length);

  return {
    approvedToolIds: selectedIndices.map((i) => toolCalls[i].id),
  };
}

function formatToolCallDescription(toolCall: ToolCall): string {
  switch (toolCall.name) {
    case "move_to_hotlist":
      return `Move to hotlist: "${toolCall.input.action_text}"\n  (from ${toolCall.input.project_path})`;
    case "update_next_action":
      return `Rename action in ${toolCall.input.project_path}\n  Current: "${toolCall.input.old_action}"\n  Suggested: "${toolCall.input.new_action}"`;
    case "add_next_action_to_project":
      return `Add action to ${toolCall.input.project_path}\n  Action: "${toolCall.input.action_text}"`;
    case "update_project_status":
      return `Update project status: ${toolCall.input.project_path}\n  New status: ${toolCall.input.new_status}`;
    default:
      return `${toolCall.name}(${JSON.stringify(toolCall.input)})`;
  }
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- cli-approval.test.ts`

Expected: PASS - all approval handler tests pass

### Step 5: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 6: Commit

```bash
git add src/cli-approval.ts tests/cli-approval.test.ts
git commit -m "feat: add CLI approval handler for tool calls"
```

---

## Acceptance Criteria

- [x] Handles empty tool call array gracefully
- [x] Inline mode for single tool (y/n/skip)
- [x] Batch mode for multiple tools (numbered list)
- [x] Parse "all", "none", empty, and comma-separated numbers
- [x] Displays context text from LLM when provided
- [x] Formats each tool type appropriately
- [x] Returns array of approved tool IDs
- [x] Test coverage ≥80%
