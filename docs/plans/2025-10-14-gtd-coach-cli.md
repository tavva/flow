# GTD Coach CLI Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Transform Priority Coach CLI into a comprehensive GTD Coach that provides advice on all GTD aspects (prioritisation, project quality, next actions, reviews, etc.) with proper markdown rendering.

**Architecture:** Add GTDContextScanner to load next actions, someday items, and inbox files alongside existing project scanning. Expand system prompt to position coach as general GTD expert with full context. Add markdown rendering for AI responses.

**Tech Stack:** TypeScript, Node.js, marked-terminal for markdown rendering, existing Obsidian mock infrastructure

---

## Task 1: Add marked-terminal dependency

**Files:**

- Modify: `package.json`

**Step 1: Install marked-terminal**

Run: `npm install marked-terminal @types/marked-terminal`
Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `npm list marked-terminal`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add marked-terminal for CLI markdown rendering"
```

---

## Task 2: Create GTDContextScanner class with tests (TDD)

**Files:**

- Create: `src/gtd-context-scanner.ts`
- Create: `tests/gtd-context-scanner.test.ts`

**Step 1: Write failing test for next actions scanning**

Create `tests/gtd-context-scanner.test.ts`:

```typescript
import { GTDContextScanner } from "../src/gtd-context-scanner";
import { App, TFile, Vault, MetadataCache } from "obsidian";
import { PluginSettings } from "../src/types";

describe("GTDContextScanner", () => {
  let mockApp: App;
  let mockVault: Vault;
  let scanner: GTDContextScanner;
  let settings: PluginSettings;

  beforeEach(() => {
    mockVault = {
      read: jest.fn(),
    } as unknown as Vault;

    mockApp = {
      vault: mockVault,
    } as App;

    settings = {
      nextActionsFile: "Next actions.md",
      somedayFile: "Someday.md",
      inboxFolder: "Flow Inbox Folder",
      inboxFilesFolder: "Flow Inbox Files",
    } as PluginSettings;

    scanner = new GTDContextScanner(mockApp, settings);
  });

  describe("scanNextActions", () => {
    it("should extract checkbox items from next actions file", async () => {
      const content = `# Next Actions

- [ ] Call dentist to schedule appointment
- [ ] Review Q4 budget
- [x] Complete project proposal
- Regular text line
- [ ] Send email to team`;

      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanNextActions();

      expect(result).toEqual([
        "Call dentist to schedule appointment",
        "Review Q4 budget",
        "Send email to team",
      ]);
    });

    it("should return empty array if file does not exist", async () => {
      (mockVault.read as jest.Mock).mockRejectedValue(new Error("File not found"));

      const result = await scanner.scanNextActions();

      expect(result).toEqual([]);
    });

    it("should return empty array if no checkboxes found", async () => {
      const content = `# Next Actions

Just some regular text
No checkboxes here`;

      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanNextActions();

      expect(result).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- gtd-context-scanner.test`
Expected: FAIL - "Cannot find module '../src/gtd-context-scanner'"

**Step 3: Create GTDContextScanner class with scanNextActions**

Create `src/gtd-context-scanner.ts`:

```typescript
// ABOUTME: Scans vault for GTD context files (next actions, someday, inbox).
// ABOUTME: Provides comprehensive GTD system state to the CLI coach.

import { App, TFile } from "obsidian";
import { PluginSettings } from "./types";

export interface GTDContext {
  nextActions: string[];
  somedayItems: string[];
  inboxItems: string[];
}

export class GTDContextScanner {
  constructor(
    private app: App,
    private settings: PluginSettings
  ) {}

  async scanNextActions(): Promise<string[]> {
    try {
      const content = await this.readFile(this.settings.nextActionsFile);
      return this.extractCheckboxItems(content);
    } catch (error) {
      return [];
    }
  }

  private async readFile(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${path}`);
    }
    return await this.app.vault.read(file as TFile);
  }

  private extractCheckboxItems(content: string): string[] {
    const lines = content.split("\n");
    const items: string[] = [];

    for (const line of lines) {
      const match = line.match(/^- \[ \] (.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }

    return items;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- gtd-context-scanner.test`
Expected: PASS - "scanNextActions" tests pass

**Step 5: Commit**

```bash
git add src/gtd-context-scanner.ts tests/gtd-context-scanner.test.ts
git commit -m "feat: add GTDContextScanner with next actions scanning"
```

---

## Task 3: Add someday items scanning (TDD)

**Files:**

- Modify: `tests/gtd-context-scanner.test.ts`
- Modify: `src/gtd-context-scanner.ts`

**Step 1: Write failing test for someday scanning**

Add to `tests/gtd-context-scanner.test.ts`:

```typescript
describe("scanSomedayItems", () => {
  it("should extract list items from someday file", async () => {
    const content = `# Someday/Maybe

- Learn Italian
- Write a book
- Visit Japan
- Remodel kitchen

Some paragraph text.

- Start a podcast`;

    (mockVault.read as jest.Mock).mockResolvedValue(content);

    const result = await scanner.scanSomedayItems();

    expect(result).toEqual([
      "Learn Italian",
      "Write a book",
      "Visit Japan",
      "Remodel kitchen",
      "Start a podcast",
    ]);
  });

  it("should return empty array if file does not exist", async () => {
    (mockVault.read as jest.Mock).mockRejectedValue(new Error("File not found"));

    const result = await scanner.scanSomedayItems();

    expect(result).toEqual([]);
  });

  it("should handle both checkbox and regular list items", async () => {
    const content = `# Someday/Maybe

- Regular item
- [ ] Checkbox item
- [x] Completed item`;

    (mockVault.read as jest.Mock).mockResolvedValue(content);

    const result = await scanner.scanSomedayItems();

    expect(result).toEqual(["Regular item", "Checkbox item"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- gtd-context-scanner.test -t "scanSomedayItems"`
Expected: FAIL - "scanner.scanSomedayItems is not a function"

**Step 3: Implement scanSomedayItems**

Add to `src/gtd-context-scanner.ts`:

```typescript
  async scanSomedayItems(): Promise<string[]> {
    try {
      const content = await this.readFile(this.settings.somedayFile);
      return this.extractListItems(content);
    } catch (error) {
      return [];
    }
  }

  private extractListItems(content: string): string[] {
    const lines = content.split("\n");
    const items: string[] = [];

    for (const line of lines) {
      // Match regular list items: "- item"
      const regularMatch = line.match(/^- ([^\[].+)$/);
      if (regularMatch) {
        items.push(regularMatch[1].trim());
        continue;
      }

      // Match unchecked checkbox items: "- [ ] item"
      const checkboxMatch = line.match(/^- \[ \] (.+)$/);
      if (checkboxMatch) {
        items.push(checkboxMatch[1].trim());
      }
    }

    return items;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- gtd-context-scanner.test -t "scanSomedayItems"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/gtd-context-scanner.ts tests/gtd-context-scanner.test.ts
git commit -m "feat: add someday items scanning to GTDContextScanner"
```

---

## Task 4: Add inbox scanning (TDD)

**Files:**

- Modify: `tests/gtd-context-scanner.test.ts`
- Modify: `src/gtd-context-scanner.ts`

**Step 1: Write failing test for inbox scanning**

Add to `tests/gtd-context-scanner.test.ts`:

```typescript
describe("scanInboxItems", () => {
  let mockGetMarkdownFiles: jest.Mock;

  beforeEach(() => {
    mockGetMarkdownFiles = jest.fn();
    mockVault.getMarkdownFiles = mockGetMarkdownFiles;
  });

  it("should list files from both inbox folders", async () => {
    const mockFiles = [
      { path: "Flow Inbox Folder/Meeting notes.md", basename: "Meeting notes" } as TFile,
      { path: "Flow Inbox Files/Project idea.md", basename: "Project idea" } as TFile,
      { path: "Other Folder/Not inbox.md", basename: "Not inbox" } as TFile,
      { path: "Flow Inbox Folder/Quick thought.md", basename: "Quick thought" } as TFile,
    ];

    mockGetMarkdownFiles.mockReturnValue(mockFiles);

    const result = await scanner.scanInboxItems();

    expect(result).toEqual([
      "Meeting notes (Flow Inbox Folder)",
      "Project idea (Flow Inbox Files)",
      "Quick thought (Flow Inbox Folder)",
    ]);
  });

  it("should return empty array if no inbox files found", async () => {
    const mockFiles = [{ path: "Other Folder/Not inbox.md", basename: "Not inbox" } as TFile];

    mockGetMarkdownFiles.mockReturnValue(mockFiles);

    const result = await scanner.scanInboxItems();

    expect(result).toEqual([]);
  });

  it("should handle empty vault", async () => {
    mockGetMarkdownFiles.mockReturnValue([]);

    const result = await scanner.scanInboxItems();

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- gtd-context-scanner.test -t "scanInboxItems"`
Expected: FAIL - "scanner.scanInboxItems is not a function"

**Step 3: Implement scanInboxItems**

Add to `src/gtd-context-scanner.ts`:

```typescript
  async scanInboxItems(): Promise<string[]> {
    try {
      const files = this.app.vault.getMarkdownFiles();
      const inboxFiles: string[] = [];

      for (const file of files) {
        if (this.isInInboxFolder(file.path)) {
          const folderName = this.getInboxFolderName(file.path);
          inboxFiles.push(`${file.basename} (${folderName})`);
        }
      }

      return inboxFiles;
    } catch (error) {
      return [];
    }
  }

  private isInInboxFolder(path: string): boolean {
    return (
      path.startsWith(this.settings.inboxFolder + "/") ||
      path.startsWith(this.settings.inboxFilesFolder + "/")
    );
  }

  private getInboxFolderName(path: string): string {
    if (path.startsWith(this.settings.inboxFolder + "/")) {
      return this.settings.inboxFolder;
    }
    return this.settings.inboxFilesFolder;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- gtd-context-scanner.test -t "scanInboxItems"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/gtd-context-scanner.ts tests/gtd-context-scanner.test.ts
git commit -m "feat: add inbox items scanning to GTDContextScanner"
```

---

## Task 5: Add scanContext method (TDD)

**Files:**

- Modify: `tests/gtd-context-scanner.test.ts`
- Modify: `src/gtd-context-scanner.ts`

**Step 1: Write failing test for scanContext**

Add to `tests/gtd-context-scanner.test.ts`:

```typescript
describe("scanContext", () => {
  it("should scan all GTD context at once", async () => {
    const nextActionsContent = `- [ ] Action 1\n- [ ] Action 2`;
    const somedayContent = `- Someday 1\n- Someday 2`;

    (mockVault.read as jest.Mock).mockImplementation((file: TFile) => {
      if (file.path === "Next actions.md") {
        return Promise.resolve(nextActionsContent);
      }
      if (file.path === "Someday.md") {
        return Promise.resolve(somedayContent);
      }
      return Promise.reject(new Error("File not found"));
    });

    mockVault.getMarkdownFiles = jest
      .fn()
      .mockReturnValue([
        { path: "Flow Inbox Folder/Item 1.md", basename: "Item 1" } as TFile,
        { path: "Flow Inbox Files/Item 2.md", basename: "Item 2" } as TFile,
      ]);

    // Need to fix the readFile mock
    const mockGetAbstractFileByPath = jest.fn((path: string) => {
      return { path } as TFile;
    });
    mockVault.getAbstractFileByPath = mockGetAbstractFileByPath;

    const result = await scanner.scanContext();

    expect(result).toEqual({
      nextActions: ["Action 1", "Action 2"],
      somedayItems: ["Someday 1", "Someday 2"],
      inboxItems: ["Item 1 (Flow Inbox Folder)", "Item 2 (Flow Inbox Files)"],
    });
  });

  it("should handle partial failures gracefully", async () => {
    (mockVault.read as jest.Mock).mockRejectedValue(new Error("File not found"));
    mockVault.getMarkdownFiles = jest.fn().mockReturnValue([]);

    const result = await scanner.scanContext();

    expect(result).toEqual({
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- gtd-context-scanner.test -t "scanContext"`
Expected: FAIL - "scanner.scanContext is not a function"

**Step 3: Implement scanContext**

Add to `src/gtd-context-scanner.ts`:

```typescript
  async scanContext(): Promise<GTDContext> {
    const [nextActions, somedayItems, inboxItems] = await Promise.all([
      this.scanNextActions(),
      this.scanSomedayItems(),
      this.scanInboxItems(),
    ]);

    return {
      nextActions,
      somedayItems,
      inboxItems,
    };
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- gtd-context-scanner.test -t "scanContext"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/gtd-context-scanner.ts tests/gtd-context-scanner.test.ts
git commit -m "feat: add scanContext method to load all GTD context at once"
```

---

## Task 6: Update system prompt builder for GTD Coach

**Files:**

- Modify: `src/cli.ts`

**Step 1: Write test for new system prompt format**

Note: Since cli.ts exports buildSystemPrompt, we can test it directly. Create or update tests if they exist. For now, we'll verify manually after implementation.

**Step 2: Update buildSystemPrompt function**

In `src/cli.ts`, replace the `buildSystemPrompt` function:

```typescript
export function buildSystemPrompt(
  projects: FlowProject[],
  sphere: string,
  gtdContext: GTDContext
): string {
  const projectCount = projects.length;
  const nextActionsCount = gtdContext.nextActions.length;
  const somedayCount = gtdContext.somedayItems.length;
  const inboxCount = gtdContext.inboxItems.length;

  let prompt = `You are a GTD (Getting Things Done) coach for the ${sphere} sphere.\n\n`;
  prompt += `You have context on the user's complete GTD system:\n`;
  prompt += `- ${projectCount} active projects with their next actions and priorities\n`;
  prompt += `- ${nextActionsCount} next actions from the central next actions file\n`;
  prompt += `- ${somedayCount} items in someday/maybe\n`;
  prompt += `- ${inboxCount} unprocessed inbox items\n\n`;

  prompt += `Your role is to provide expert GTD advice:\n`;
  prompt += `- Help prioritise projects and actions based on goals, context, energy, and time\n`;
  prompt += `- Review project quality: Are outcomes clear? Are next actions specific and actionable?\n`;
  prompt += `- Coach on GTD processes: weekly reviews, inbox processing, project planning\n`;
  prompt += `- Answer methodology questions about GTD principles and best practices\n`;
  prompt += `- Identify issues: projects with no next actions, vague actions, unclear outcomes\n\n`;

  prompt += `Important: You are read-only. Provide advice and recommendations, but you cannot edit files.\n\n`;

  prompt += `GTD Quality Standards:\n`;
  prompt += `- Next actions must start with a verb, be specific, and completable in one sitting\n`;
  prompt += `- Project outcomes should be clear and measurable (what does "done" look like?)\n`;
  prompt += `- Projects need at least one next action to maintain momentum\n\n`;

  if (projectCount === 0 && nextActionsCount === 0 && somedayCount === 0 && inboxCount === 0) {
    prompt += `No GTD data found. You can still answer general GTD methodology questions.\n`;
    return prompt;
  }

  prompt += `---\n\n`;

  if (projectCount > 0) {
    prompt += `## Projects (${projectCount})\n\n`;
    for (const project of projects) {
      prompt += `### ${project.title}\n`;
      prompt += `Description: ${project.description || "No description"}\n`;
      prompt += `Priority: ${project.priority} (1=highest, 3=lowest)\n`;
      prompt += `Status: ${project.status}\n`;

      if (project.nextActions && project.nextActions.length > 0) {
        prompt += `Next Actions (${project.nextActions.length}):\n`;
        for (const action of project.nextActions) {
          prompt += `- ${action}\n`;
        }
      } else {
        prompt += `⚠️ Next Actions: None defined (project may be stalled)\n`;
      }

      prompt += `\n`;
    }
  }

  if (nextActionsCount > 0) {
    prompt += `## Central Next Actions (${nextActionsCount})\n\n`;
    for (const action of gtdContext.nextActions) {
      prompt += `- ${action}\n`;
    }
    prompt += `\n`;
  }

  if (somedayCount > 0) {
    prompt += `## Someday/Maybe (${somedayCount})\n\n`;
    for (const item of gtdContext.somedayItems) {
      prompt += `- ${item}\n`;
    }
    prompt += `\n`;
  }

  if (inboxCount > 0) {
    prompt += `## Inbox Items (${inboxCount} unprocessed)\n\n`;
    for (const item of gtdContext.inboxItems) {
      prompt += `- ${item}\n`;
    }
    prompt += `\n`;
  }

  return prompt;
}
```

**Step 3: Update buildSystemPrompt signature**

Also update the function signature where it's declared (around line 55):

```typescript
export function buildSystemPrompt(
  projects: FlowProject[],
  sphere: string,
  gtdContext: GTDContext
): string {
```

**Step 4: Add GTDContext import**

At the top of `src/cli.ts`, add import:

```typescript
import { GTDContext } from "./gtd-context-scanner";
```

**Step 5: Test manually**

Run: `npm run build`
Expected: Compiles successfully

**Step 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: expand system prompt to GTD coach with full context"
```

---

## Task 7: Add markdown rendering to REPL

**Files:**

- Modify: `src/cli.ts`

**Step 1: Import marked-terminal**

Add at top of `src/cli.ts`:

```typescript
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
```

**Step 2: Configure marked renderer in runREPL**

In the `runREPL` function, before the REPL loop starts (around line 115), add:

```typescript
export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  projectCount: number,
  sphere: string
): Promise<void> {
  const messages: ChatMessage[] = [];

  // Configure markdown renderer
  const marked = new Marked(
    markedTerminal({
      // Use existing color scheme
      heading: colors.assistant,
      code: colors.dim,
      blockquote: colors.dim,
      strong: "\x1b[1m", // Bold
      em: "\x1b[3m", // Italic
    })
  );

  const rl = readline.createInterface({
```

**Step 3: Use markdown renderer for assistant responses**

Replace the console.log for assistant responses (around line 198) with:

```typescript
// Add assistant message
messages.push({
  role: "assistant",
  content: response,
});

// Render markdown response
const rendered = marked.parse(response) as string;
console.log(`${colors.assistant}Coach:${colors.reset}\n${rendered}`);
```

**Step 4: Test build**

Run: `npm run build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add markdown rendering for AI responses in REPL"
```

---

## Task 8: Integrate GTDContextScanner into CLI main function

**Files:**

- Modify: `src/cli.ts`

**Step 1: Import GTDContextScanner**

Already added in Task 6, verify it's present:

```typescript
import { GTDContextScanner, GTDContext } from "./gtd-context-scanner";
```

**Step 2: Add context scanning to main function**

In the `main()` function (around line 343), after project scanning and before building the system prompt:

```typescript
// Filter by sphere
const projects = allProjects.filter((project) =>
  project.tags.some((tag) => tag === `project/${args.sphere}`)
);

if (projects.length === 0) {
  console.warn(`Warning: No projects found for sphere "${args.sphere}"`);
  console.warn("Continuing anyway - you can discuss why projects might be missing.\n");
}

// Scan GTD context
const gtdScanner = new GTDContextScanner(mockApp as any, settings);
const gtdContext = await gtdScanner.scanContext();

// Build system prompt
const systemPrompt = buildSystemPrompt(projects, args.sphere, gtdContext);
```

**Step 3: Test build**

Run: `npm run build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: integrate GTDContextScanner into CLI main function"
```

---

## Task 9: Update REPL welcome message

**Files:**

- Modify: `src/cli.ts`

**Step 1: Update runREPL signature to include context counts**

Change function signature (around line 109):

```typescript
export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  gtdContext: GTDContext,
  projectCount: number,
  sphere: string
): Promise<void> {
```

**Step 2: Update welcome message**

Replace the welcome console.log (around line 124):

```typescript
console.log(`\nFlow GTD Coach - ${sphere} sphere`);
console.log(`  ${projectCount} projects`);
console.log(`  ${gtdContext.nextActions.length} next actions`);
console.log(`  ${gtdContext.somedayItems.length} someday items`);
console.log(`  ${gtdContext.inboxItems.length} inbox items\n`);
console.log(`Type 'exit' to quit, 'reset' to start fresh conversation\n`);
```

**Step 3: Update main() to pass gtdContext**

In `main()` function, update the runREPL call:

```typescript
// Run REPL
await runREPL(languageModelClient, model, systemPrompt, gtdContext, projects.length, args.sphere);
```

**Step 4: Test build**

Run: `npm run build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: update REPL welcome message with GTD context counts"
```

---

## Task 10: Update documentation

**Files:**

- Modify: `docs/priority-coach-cli.md`
- Modify: `CLAUDE.md`

**Step 1: Rename and update CLI documentation**

Rename file:

```bash
git mv docs/priority-coach-cli.md docs/gtd-coach-cli.md
```

Update `docs/gtd-coach-cli.md`:

````markdown
# GTD Coach CLI

A conversational CLI tool for AI-powered GTD coaching using your Flow vault data.

## Overview

The GTD Coach CLI loads your complete GTD system from a specified sphere and provides an interactive REPL where you can have conversations with an AI GTD expert about all aspects of your GTD practice.

The coach has access to:

- Your Flow projects with priorities, statuses, and next actions
- Central next actions file
- Someday/maybe items
- Unprocessed inbox items

## Installation

No separate installation needed - the CLI is part of the Flow GTD Coach plugin repository.

## Usage

```bash
npx tsx src/cli.ts --vault /path/to/vault --sphere work
```
````

**Required arguments:**

- `--vault` - Path to your Obsidian vault
- `--sphere` - Sphere to filter projects (e.g., 'work', 'personal')

## Configuration

The CLI uses the same API key and model configuration as the Obsidian plugin. Configure these in Obsidian via Settings → Flow GTD Coach before using the CLI.

## REPL Commands

- `exit` or `quit` - Exit the CLI
- `reset` - Start a fresh conversation (clears history)

## What the Coach Can Help With

The GTD Coach can provide advice on:

- **Prioritisation** - Which projects or actions to focus on given your goals, time, and energy
- **Project Quality** - Are your project outcomes clear? Are next actions well-defined?
- **Next Action Quality** - Are actions specific enough? Do they start with verbs?
- **GTD Processes** - Weekly reviews, inbox processing, project planning workflows
- **System Health** - Projects without next actions, growing inboxes, unclear outcomes
- **Methodology Questions** - General GTD principles and best practices

**Important:** The coach is read-only and provides advice only - it cannot edit your files.

## Example Sessions

### Prioritisation

```
$ npx tsx src/cli.ts --vault ~/my-vault --sphere work

Flow GTD Coach - work sphere
  15 projects
  23 next actions
  8 someday items
  3 inbox items

> I have 2 hours this afternoon. What should I focus on?

[AI analyzes your projects and suggests specific actions based on priorities]
```

### Project Review

```
> Can you review my "Website Redesign" project and tell me if it's well-formed?

[AI checks if outcome is clear, next actions are specific, etc.]
```

### Weekly Review

```
> Help me do a weekly review. What should I look at first?

[AI guides you through reviewing projects, clearing inbox, etc.]
```

### Next Action Quality

```
> Are these good next actions? "fix the bug", "update docs", "call client"

[AI evaluates action quality and suggests improvements]
```

## Conversation Context

The CLI maintains conversation history across turns, so you can have natural back-and-forth discussions. The AI remembers your stated priorities and previous questions within the session.

Use `reset` if you want to start a fresh conversation without previous context.

## Tips

- Be specific about your constraints (time, energy, deadlines)
- Ask the coach to review specific projects or actions
- Use the coach for weekly review guidance
- Ask for help improving vague next actions
- Discuss GTD methodology when you're unsure about best practices

````

**Step 2: Update main CLAUDE.md references**

Update `CLAUDE.md` sections that reference the CLI:

Find the "Priority Coach CLI" section and update:

```markdown
### GTD Coach CLI

```bash
# Interactive GTD coaching for a specific sphere
npx tsx src/cli.ts --vault /path/to/vault --sphere work
````

See `docs/gtd-coach-cli.md` for full CLI documentation.

````

Also update any other references to "Priority Coach" → "GTD Coach" in CLAUDE.md.

**Step 3: Commit**

```bash
git add docs/gtd-coach-cli.md CLAUDE.md
git commit -m "docs: rename Priority Coach to GTD Coach and update documentation"
````

---

## Task 11: Update comments and labels in cli.ts

**Files:**

- Modify: `src/cli.ts`

**Step 1: Update file header comment**

Change lines 1-2:

```typescript
// ABOUTME: CLI entry point for conversational GTD coaching across all GTD aspects.
// ABOUTME: Loads Flow projects and GTD context from vault and provides AI-powered advice via REPL.
```

**Step 2: Update welcome message comment**

Find "Flow Priority Coach" text and update to "Flow GTD Coach"

**Step 3: Run format check**

Run: `npm run format:check`
Expected: No formatting issues

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "refactor: update comments and labels to reflect GTD Coach naming"
```

---

## Task 12: Verify all tests pass

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass including new gtd-context-scanner tests

**Step 2: Run test coverage**

Run: `npm run test:coverage`
Expected: Coverage meets 80% threshold (new file may need additional tests if coverage is low)

**Step 3: If coverage is below threshold, add tests**

Check coverage report for gtd-context-scanner.ts. If below 80%, add additional edge case tests.

**Step 4: Build the project**

Run: `npm run build`
Expected: Clean build with no errors

**Step 5: Commit any test additions**

```bash
git add tests/
git commit -m "test: ensure GTDContextScanner has adequate test coverage"
```

---

## Task 13: Manual integration testing

**Step 1: Test with a real vault**

Run: `npx tsx src/cli.ts --vault /path/to/test/vault --sphere work`
Expected:

- Loads successfully
- Shows project/action/someday/inbox counts
- Handles missing files gracefully

**Step 2: Test markdown rendering**

In REPL, ask: "Can you give me a prioritised list with explanations?"
Expected:

- Markdown lists render properly
- Bold/italic text displays correctly
- Code blocks (if any) are readable

**Step 3: Test GTD coaching capabilities**

Try various prompts:

- "Help me prioritise my projects"
- "Review the quality of my next actions"
- "Which projects have no next actions?"
- "How should I approach my weekly review?"

Expected: Coach provides relevant, context-aware advice

**Step 4: Test error handling**

Try with vault that has missing GTD files
Expected: Graceful degradation, shows 0 counts, still functional

**Step 5: Document any issues**

Create follow-up tasks if bugs found

---

## Verification Checklist

Before considering complete:

- [ ] All unit tests pass
- [ ] Test coverage meets 80% threshold
- [ ] Build completes without errors
- [ ] Manual CLI test with real vault works
- [ ] Markdown rendering displays correctly
- [ ] GTD coaching responds appropriately to various prompts
- [ ] Missing files handled gracefully
- [ ] Documentation updated and accurate
- [ ] All commits follow conventional commit format
- [ ] No temporary/debug code left in

---

## Notes

**Key Architecture Decisions:**

- GTDContextScanner follows same pattern as FlowProjectScanner for consistency
- All context loading failures return empty arrays (graceful degradation)
- System prompt expansion keeps projects as primary focus, adds supplementary context
- Markdown rendering only applied to AI responses, not user input
- Preserved existing ANSI color scheme while adding markdown support

**Testing Strategy:**

- TDD for GTDContextScanner ensures robust parsing
- Manual testing required for markdown rendering (visual check)
- Integration testing verifies full pipeline with real vault data

**Follow-up Considerations:**

- Could add structured workflows (e.g., `review` command) in future
- Could make coach more proactive (scan for issues, prompt user)
- Could add ability to reload context without restarting REPL
- Could add export/save of coaching session notes
