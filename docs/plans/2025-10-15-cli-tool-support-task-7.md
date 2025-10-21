# CLI Tool Support - Task 7: Update System Prompt for Tool Usage

**Goal:** Change system prompt from "read-only" to describing available tools

**Architecture:** Update buildSystemPrompt function in cli.ts to list tool capabilities

**Tech Stack:** String manipulation, TypeScript

---

### Step 1: Write failing test for updated system prompt

**File:** `tests/cli-system-prompt.test.ts`

```typescript
import { buildSystemPrompt } from "../src/cli";
import { GTDContext } from "../src/gtd-context-scanner";
import { FlowProject } from "../src/types";

describe("CLI System Prompt - Tool Support", () => {
  const mockContext: GTDContext = {
    nextActions: [],
    somedayItems: [],
    inboxItems: [],
  };

  const mockProjects: FlowProject[] = [
    {
      file: "Projects/Test.md",
      title: "Test Project",
      description: "Test",
      priority: 2,
      tags: ["project/work"],
      status: "live",
      nextActions: ["First action"],
      waitingFor: [],
    },
  ];

  it("should not mention read-only", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).not.toContain("read-only");
    expect(prompt).not.toContain("You are read-only");
    expect(prompt).not.toContain("cannot edit files");
  });

  it("should mention ability to suggest and apply changes", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("suggest and apply changes");
  });

  it("should list tool capabilities", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("hotlist");
    expect(prompt).toContain("next actions");
    expect(prompt).toContain("project status");
  });

  it("should mention user approval", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("approve");
    expect(prompt).toContain("applied");
  });

  it("should instruct to use available tools", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("use the available tools");
  });

  it("should still include GTD coaching instructions", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("GTD");
    expect(prompt).toContain("coach");
    expect(prompt).toContain("prioritise");
  });

  it("should still include communication style", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Communication Style");
    expect(prompt).toContain("Ask questions only when");
  });

  it("should still include quality standards", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Quality Standards");
    expect(prompt).toContain("start with a verb");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- cli-system-prompt.test.ts`

Expected: FAIL - prompt still says "read-only"

### Step 3: Update buildSystemPrompt function

**File:** `src/cli.ts`

Find the section that says:

```typescript
prompt += `Important: You are read-only. Provide advice and recommendations, but you cannot edit files.\n\n`;
```

Replace it with:

```typescript
prompt += `You can suggest and apply changes to help improve the GTD system:\n`;
prompt += `- Move important actions to the hotlist for today\n`;
prompt += `- Improve vague or unclear next actions to be more specific\n`;
prompt += `- Add missing next actions to projects\n`;
prompt += `- Update project status (archive completed projects, etc.)\n\n`;
prompt += `When you identify improvements, use the available tools to suggest changes. `;
prompt += `The user will review and approve each suggestion before it's applied.\n\n`;
```

### Step 4: Run test to verify it passes

Run: `npm test -- cli-system-prompt.test.ts`

Expected: PASS - all system prompt tests pass

### Step 5: Verify existing CLI tests still pass

Run: `npm test -- cli.test.ts`

Expected: PASS - existing CLI tests pass (or updated if they assert on prompt)

### Step 6: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 7: Commit

```bash
git add src/cli.ts tests/cli-system-prompt.test.ts
git commit -m "feat: update CLI system prompt to describe tool capabilities"
```

---

## Acceptance Criteria

- [x] System prompt no longer says "read-only"
- [x] System prompt lists 4 tool capabilities
- [x] System prompt mentions user approval required
- [x] System prompt instructs LLM to use tools
- [x] Existing GTD coaching guidance preserved
- [x] Communication style preserved
- [x] Quality standards preserved
- [x] Test coverage ≥80%
