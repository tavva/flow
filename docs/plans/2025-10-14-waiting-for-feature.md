# Waiting For Feature Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add GTD "Waiting For" support allowing tasks to be marked with `[w]` status, with a leaf view to aggregate and manage all waiting-for items across the vault.

**Architecture:** Plugin-independent implementation parsing `[w]` checkboxes in markdown. New leaf view aggregates items from all sources. Status cycling command enables keyboard-driven status changes. AI processor recognizes waiting-for scenarios during inbox processing.

**Tech Stack:** TypeScript, Obsidian API, Jest for testing

---

## Task 1: Waiting For Scanner

**Files:**

- Create: `src/waiting-for-scanner.ts`
- Create: `tests/waiting-for-scanner.test.ts`

**Step 1: Write the failing test**

Create `tests/waiting-for-scanner.test.ts`:

```typescript
import { WaitingForScanner } from "../src/waiting-for-scanner";
import { App, TFile, Vault } from "obsidian";

describe("WaitingForScanner", () => {
  let mockApp: jest.Mocked<App>;
  let mockVault: jest.Mocked<Vault>;
  let scanner: WaitingForScanner;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
    } as unknown as jest.Mocked<Vault>;

    mockApp = {
      vault: mockVault,
    } as unknown as jest.Mocked<App>;

    scanner = new WaitingForScanner(mockApp);
  });

  test("should scan vault and find waiting-for items", async () => {
    const mockFile = {
      path: "Projects/Project A.md",
      basename: "Project A",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`---
tags: project/work
---

# Project A

## Next actions

- [ ] Regular task
- [w] Call John after he returns from holiday
- [x] Completed task
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      file: "Projects/Project A.md",
      fileName: "Project A",
      lineNumber: 10,
      text: "Call John after he returns from holiday",
      isCompleted: false,
    });
  });

  test("should find multiple waiting-for items in same file", async () => {
    const mockFile = {
      path: "Next actions.md",
      basename: "Next actions",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`# Next actions

- [w] Wait for Sarah's report
- [ ] Regular task
- [w] Wait for server deployment
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe("Wait for Sarah's report");
    expect(items[1].text).toBe("Wait for server deployment");
  });

  test("should track completed waiting-for items", async () => {
    const mockFile = {
      path: "Projects/Project B.md",
      basename: "Project B",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`## Next actions

- [w] Ongoing wait
- [x] Completed wait (was [w])
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(2);
    expect(items[0].isCompleted).toBe(false);
    expect(items[1].isCompleted).toBe(false); // Only scan for [w], not [x]
  });

  test("should handle files with no waiting-for items", async () => {
    const mockFile = {
      path: "Reference.md",
      basename: "Reference",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`# Reference

Just regular content here.
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(0);
  });

  test("should clean up checkbox text", async () => {
    const mockFile = {
      path: "Test.md",
      basename: "Test",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`- [w]   Extra   spaces   everywhere  `);

    const items = await scanner.scanWaitingForItems();

    expect(items[0].text).toBe("Extra spaces everywhere");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/.config/superpowers/worktrees/flow-coach/waiting-for-feature
npm test -- waiting-for-scanner.test
```

Expected: FAIL with "Cannot find module '../src/waiting-for-scanner'"

**Step 3: Write minimal implementation**

Create `src/waiting-for-scanner.ts`:

```typescript
// ABOUTME: Scans vault for waiting-for items (tasks marked with [w] checkbox status).
// ABOUTME: Returns array of waiting-for items with file location and line numbers for editing.

import { App, TFile } from "obsidian";

export interface WaitingForItem {
  file: string;
  fileName: string;
  lineNumber: number;
  text: string;
  isCompleted: boolean;
}

export class WaitingForScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async scanWaitingForItems(): Promise<WaitingForItem[]> {
    const files = this.app.vault.getMarkdownFiles();
    const items: WaitingForItem[] = [];

    for (const file of files) {
      const fileItems = await this.scanFile(file);
      items.push(...fileItems);
    }

    return items;
  }

  private async scanFile(file: TFile): Promise<WaitingForItem[]> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const items: WaitingForItem[] = [];

    const waitingForPattern = /^[-*]\s*\[w\]\s*(.+)$/i;

    lines.forEach((line, index) => {
      const match = line.match(waitingForPattern);
      if (match) {
        const text = match[1].replace(/\s{2,}/g, " ").trim();
        items.push({
          file: file.path,
          fileName: file.basename,
          lineNumber: index + 1,
          text,
          isCompleted: false,
        });
      }
    });

    return items;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- waiting-for-scanner.test
```

Expected: PASS (all tests green)

**Step 5: Commit**

```bash
cd ~/.config/superpowers/worktrees/flow-coach/waiting-for-feature
git add src/waiting-for-scanner.ts tests/waiting-for-scanner.test.ts
git commit -m "feat: add waiting-for scanner to find [w] items in vault"
```

---

## Task 2: Task Status Cycler Command

**Files:**

- Create: `src/task-status-cycler.ts`
- Create: `tests/task-status-cycler.test.ts`

**Step 1: Write the failing test**

Create `tests/task-status-cycler.test.ts`:

```typescript
import { cycleTaskStatus, getTaskStatusAtLine } from "../src/task-status-cycler";

describe("Task Status Cycler", () => {
  describe("getTaskStatusAtLine", () => {
    test("should detect unchecked task", () => {
      const line = "- [ ] Do something";
      expect(getTaskStatusAtLine(line)).toBe("todo");
    });

    test("should detect waiting-for task", () => {
      const line = "- [w] Wait for John";
      expect(getTaskStatusAtLine(line)).toBe("waiting");
    });

    test("should detect completed task", () => {
      const line = "- [x] Done task";
      expect(getTaskStatusAtLine(line)).toBe("done");
    });

    test("should detect completed task with capital X", () => {
      const line = "- [X] Done task";
      expect(getTaskStatusAtLine(line)).toBe("done");
    });

    test("should return null for non-task line", () => {
      const line = "Just regular text";
      expect(getTaskStatusAtLine(line)).toBeNull();
    });

    test("should handle asterisk bullets", () => {
      const line = "* [w] Wait for response";
      expect(getTaskStatusAtLine(line)).toBe("waiting");
    });
  });

  describe("cycleTaskStatus", () => {
    test("should cycle todo -> waiting", () => {
      const line = "- [ ] Do something";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [w] Do something");
    });

    test("should cycle waiting -> done", () => {
      const line = "- [w] Wait for John";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [x] Wait for John");
    });

    test("should cycle done -> todo", () => {
      const line = "- [x] Done task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [ ] Done task");
    });

    test("should handle capital X in done tasks", () => {
      const line = "- [X] Done task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [ ] Done task");
    });

    test("should preserve indentation", () => {
      const line = "  - [ ] Indented task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("  - [w] Indented task");
    });

    test("should preserve asterisk bullets", () => {
      const line = "* [w] Wait for response";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("* [x] Wait for response");
    });

    test("should return null for non-task line", () => {
      const line = "Just regular text";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- task-status-cycler.test
```

Expected: FAIL with "Cannot find module '../src/task-status-cycler'"

**Step 3: Write minimal implementation**

Create `src/task-status-cycler.ts`:

```typescript
// ABOUTME: Cycles task checkbox status between [ ], [w], and [x] states.
// ABOUTME: Supports command to cycle task status on the current line in the editor.

export type TaskStatus = "todo" | "waiting" | "done";

const TASK_PATTERN = /^(\s*[-*]\s*)\[([ wWxX])\]\s*(.*)$/;

export function getTaskStatusAtLine(line: string): TaskStatus | null {
  const match = line.match(TASK_PATTERN);
  if (!match) {
    return null;
  }

  const status = match[2].toLowerCase();
  if (status === " ") return "todo";
  if (status === "w") return "waiting";
  if (status === "x") return "done";

  return null;
}

export function cycleTaskStatus(line: string): string | null {
  const match = line.match(TASK_PATTERN);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const currentStatus = match[2].toLowerCase();
  const text = match[3];

  let newStatus: string;
  if (currentStatus === " ") {
    newStatus = "w";
  } else if (currentStatus === "w") {
    newStatus = "x";
  } else if (currentStatus === "x") {
    newStatus = " ";
  } else {
    return null;
  }

  return `${prefix}[${newStatus}] ${text}`;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- task-status-cycler.test
```

Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/task-status-cycler.ts tests/task-status-cycler.test.ts
git commit -m "feat: add task status cycling logic for [ ], [w], [x]"
```

---

## Task 3: Register Cycle Task Status Command

**Files:**

- Modify: `main.ts`

**Step 1: Add command registration in main.ts**

In `main.ts`, import the cycler and add command in `onload()`:

```typescript
import { cycleTaskStatus } from "./task-status-cycler";

// In onload() method, add after other commands:
this.addCommand({
  id: "cycle-task-status",
  name: "Cycle task status",
  editorCallback: (editor) => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const cycled = cycleTaskStatus(line);

    if (cycled) {
      editor.setLine(cursor.line, cycled);
    }
  },
});
```

**Step 2: Test manually in Obsidian**

1. Build: `npm run build`
2. Reload plugin in Obsidian
3. Create a test note with `- [ ] Test task`
4. Place cursor on that line
5. Open command palette and run "Cycle task status"
6. Verify it changes to `- [w] Test task`
7. Run command again, verify it changes to `- [x] Test task`
8. Run command again, verify it cycles back to `- [ ] Test task`

Expected: Task status cycles correctly

**Step 3: Commit**

```bash
git add main.ts
git commit -m "feat: register cycle task status command in plugin"
```

---

## Task 4: Waiting For View Component

**Files:**

- Create: `src/waiting-for-view.ts`
- Create: `tests/waiting-for-view.test.ts`

**Step 1: Write the failing test**

Create `tests/waiting-for-view.test.ts`:

```typescript
import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { WorkspaceLeaf, TFile } from "obsidian";
import { WaitingForScanner, WaitingForItem } from "../src/waiting-for-scanner";

jest.mock("../src/waiting-for-scanner");

describe("WaitingForView", () => {
  let view: WaitingForView;
  let mockLeaf: jest.Mocked<WorkspaceLeaf>;
  let mockScanner: jest.Mocked<WaitingForScanner>;

  beforeEach(() => {
    mockLeaf = {
      view: null,
    } as unknown as jest.Mocked<WorkspaceLeaf>;

    const mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      workspace: {
        getLeaf: jest.fn(),
      },
    };

    view = new WaitingForView(mockLeaf as WorkspaceLeaf);
    (view as any).app = mockApp;

    mockScanner = new WaitingForScanner(mockApp as any) as jest.Mocked<WaitingForScanner>;
    (view as any).scanner = mockScanner;
  });

  test("should return correct view type", () => {
    expect(view.getViewType()).toBe(WAITING_FOR_VIEW_TYPE);
  });

  test("should return display text", () => {
    expect(view.getDisplayText()).toBe("Waiting For");
  });

  test("should return icon", () => {
    expect(view.getIcon()).toBe("clock");
  });

  test("should group items by file", () => {
    const items: WaitingForItem[] = [
      {
        file: "Projects/Project A.md",
        fileName: "Project A",
        lineNumber: 5,
        text: "Wait for John",
        isCompleted: false,
      },
      {
        file: "Projects/Project A.md",
        fileName: "Project A",
        lineNumber: 7,
        text: "Wait for Sarah",
        isCompleted: false,
      },
      {
        file: "Next actions.md",
        fileName: "Next actions",
        lineNumber: 3,
        text: "Wait for deployment",
        isCompleted: false,
      },
    ];

    const grouped = (view as any).groupItemsByFile(items);

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["Projects/Project A.md"]).toHaveLength(2);
    expect(grouped["Next actions.md"]).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- waiting-for-view.test
```

Expected: FAIL with "Cannot find module '../src/waiting-for-view'"

**Step 3: Write minimal implementation**

Create `src/waiting-for-view.ts`:

```typescript
// ABOUTME: Leaf view displaying all waiting-for items aggregated from across the vault.
// ABOUTME: Allows marking items complete or converting back to regular actions.

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { WaitingForScanner, WaitingForItem } from "./waiting-for-scanner";

export const WAITING_FOR_VIEW_TYPE = "flow-gtd-waiting-for-view";

interface GroupedItems {
  [filePath: string]: WaitingForItem[];
}

export class WaitingForView extends ItemView {
  private scanner: WaitingForScanner;
  private rightPaneLeaf: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.scanner = new WaitingForScanner(this.app);
  }

  getViewType(): string {
    return WAITING_FOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Waiting For";
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-waiting-for-view");

    const loadingEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
    loadingEl.setText("Loading waiting for items...");

    try {
      const items = await this.scanner.scanWaitingForItems();
      loadingEl.remove();
      this.renderContent(container as HTMLElement, items);
    } catch (error) {
      console.error("Failed to load waiting for view", error);
      loadingEl.setText(
        "Unable to load waiting for items. Check the console for more information."
      );
    }
  }

  async onClose() {
    // Cleanup if needed
  }

  private renderContent(container: HTMLElement, items: WaitingForItem[]) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-waiting-for-title" });
    titleEl.setText("Waiting For");

    if (items.length === 0) {
      this.renderEmptyMessage(container);
      return;
    }

    const grouped = this.groupItemsByFile(items);
    this.renderGroupedItems(container, grouped);
  }

  private groupItemsByFile(items: WaitingForItem[]): GroupedItems {
    const grouped: GroupedItems = {};

    items.forEach((item) => {
      if (!grouped[item.file]) {
        grouped[item.file] = [];
      }
      grouped[item.file].push(item);
    });

    return grouped;
  }

  private renderGroupedItems(container: HTMLElement, grouped: GroupedItems) {
    const sortedFiles = Object.keys(grouped).sort();

    sortedFiles.forEach((filePath) => {
      const items = grouped[filePath];
      const fileSection = container.createDiv({ cls: "flow-gtd-waiting-for-file-section" });

      const fileHeader = fileSection.createEl("h3", { cls: "flow-gtd-waiting-for-file-header" });
      const fileLink = fileHeader.createEl("a", {
        text: items[0].fileName,
        cls: "flow-gtd-waiting-for-file-link",
      });
      fileLink.style.cursor = "pointer";
      fileLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openFile(filePath);
      });

      const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-waiting-for-items" });

      items.forEach((item) => {
        this.renderItem(itemsList, item);
      });
    });
  }

  private renderItem(container: HTMLElement, item: WaitingForItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-waiting-for-item" });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-waiting-for-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-waiting-for-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-waiting-for-action-btn",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.toggleItemComplete(item);
      await this.onOpen();
    });

    const convertBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-waiting-for-action-btn",
      text: "←",
    });
    convertBtn.title = "Convert to action";
    convertBtn.addEventListener("click", async () => {
      await this.convertToAction(item);
      await this.onOpen();
    });
  }

  private renderEmptyMessage(container: HTMLElement) {
    container
      .createDiv({ cls: "flow-gtd-waiting-for-empty" })
      .setText("No waiting for items found.");
  }

  private async openFile(filePath: string, lineNumber?: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    try {
      if (!this.rightPaneLeaf) {
        this.rightPaneLeaf = this.app.workspace.getLeaf("split", "vertical");
      }
      await this.rightPaneLeaf.openFile(file);

      if (lineNumber !== undefined) {
        const view = this.rightPaneLeaf.view;
        if (view && "editor" in view) {
          const editor = (view as any).editor;
          if (editor) {
            editor.setCursor({ line: lineNumber - 1, ch: 0 });
            editor.scrollIntoView(
              { from: { line: lineNumber - 1, ch: 0 }, to: { line: lineNumber - 1, ch: 0 } },
              true
            );
          }
        }
      }
    } catch (error) {
      console.error(`Failed to open file: ${filePath}`, error);
    }
  }

  private async toggleItemComplete(item: WaitingForItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = item.lineNumber - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, "[x]");
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }

  private async convertToAction(item: WaitingForItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = item.lineNumber - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, "[ ]");
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- waiting-for-view.test
```

Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/waiting-for-view.ts tests/waiting-for-view.test.ts
git commit -m "feat: add waiting for view component"
```

---

## Task 5: Register Waiting For View in Plugin

**Files:**

- Modify: `main.ts`

**Step 1: Register view and add command**

In `main.ts`:

```typescript
import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "./waiting-for-view";

// In onload() method:

// Register view
this.registerView(
  WAITING_FOR_VIEW_TYPE,
  (leaf) => new WaitingForView(leaf)
);

// Add command to open view
this.addCommand({
  id: "open-waiting-for-view",
  name: "Open Waiting For view",
  callback: () => {
    this.activateWaitingForView();
  },
});

// Add ribbon icon
this.addRibbonIcon("clock", "Open Waiting For view", () => {
  this.activateWaitingForView();
});

// Add helper method at end of class:
async activateWaitingForView() {
  const { workspace } = this.app;

  let leaf = workspace.getLeavesOfType(WAITING_FOR_VIEW_TYPE)[0];

  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: WAITING_FOR_VIEW_TYPE,
        active: true,
      });
      leaf = rightLeaf;
    }
  }

  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}
```

**Step 2: Test manually in Obsidian**

1. Build: `npm run build`
2. Reload plugin in Obsidian
3. Add some `[w]` items to test files
4. Click clock ribbon icon OR use command palette "Open Waiting For view"
5. Verify view opens in right pane
6. Verify all `[w]` items are listed grouped by file
7. Click item text to open file
8. Click ✓ to mark complete
9. Click ← to convert to action

Expected: View works as designed

**Step 3: Commit**

```bash
git add main.ts
git commit -m "feat: register waiting for view in plugin"
```

---

## Task 6: Update GTD Processor for Waiting For Recognition

**Files:**

- Modify: `src/gtd-processor.ts`
- Modify: `tests/gtd-processor.test.ts`

**Step 1: Write the failing test**

Add to `tests/gtd-processor.test.ts`:

```typescript
test("should recognize waiting-for scenarios and create [w] items", async () => {
  const inboxText = "Need to follow up with John about the proposal after he reviews it";

  mockLanguageModel.createMessage.mockResolvedValue({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          isActionable: true,
          category: "next-action",
          nextAction: "Follow up with John about the proposal",
          reasoning: "This is waiting for John to complete his review",
          recommendedAction: "next-actions-file",
          recommendedActionReasoning: "Standalone waiting-for item",
          isWaitingFor: true,
          waitingForReason: "Waiting for John to review the proposal",
        }),
      },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  const result = await processor.processInboxItem(inboxText, [], []);

  expect(result.isWaitingFor).toBe(true);
  expect(result.nextAction).toBe("Follow up with John about the proposal");
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- gtd-processor.test
```

Expected: FAIL - `isWaitingFor` property doesn't exist

**Step 3: Update types and processor**

In `src/types.ts`, update `GTDProcessingResult`:

```typescript
export interface GTDProcessingResult {
  isActionable: boolean;
  category: "next-action" | "project" | "reference" | "someday" | "person";
  projectOutcome?: string;
  projectPriority?: number;
  nextAction?: string;
  nextActions?: string[];
  reasoning: string;
  suggestedProjects?: ProjectSuggestion[];
  suggestedPersons?: PersonSuggestion[];
  recommendedAction: ProcessingAction;
  recommendedActionReasoning: string;
  recommendedSpheres?: string[];
  recommendedSpheresReasoning?: string;
  referenceContent?: string;
  isWaitingFor?: boolean; // NEW
  waitingForReason?: string; // NEW
}
```

In `src/gtd-processor.ts`, update the prompt in `buildProcessingPrompt()` to include:

```typescript
// Add after the category examples:
**Special case - Waiting For:**
If the item involves waiting for someone else to do something, set "isWaitingFor": true and provide "waitingForReason". This signals that next actions should use [w] checkbox status instead of [ ].

Examples:
- "Follow up with Sarah after she sends the report" → isWaitingFor: true
- "Check if deployment is complete" → isWaitingFor: true
- "Call dentist to schedule appointment" → isWaitingFor: false (you're taking action)
```

**Step 4: Run test to verify it passes**

```bash
npm test -- gtd-processor.test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts src/gtd-processor.ts tests/gtd-processor.test.ts
git commit -m "feat: add waiting-for recognition to GTD processor"
```

---

## Task 7: Update Inbox Modal for Waiting For Toggle

**Files:**

- Modify: `src/inbox-modal-views.ts` (or whichever file handles next actions list rendering)
- Test manually (complex UI, unit tests may not be practical)

**Step 1: Add waiting-for toggle to next actions rendering**

Locate the function that renders next action items in the inbox modal. Add a toggle button for each action:

```typescript
// Find the section that creates next action list items
// Add after the delete button:

const waitingToggle = actionItem.createEl("button", {
  cls: "flow-gtd-next-action-waiting-toggle",
  text: "⏰",
});
waitingToggle.title = "Toggle waiting for";
waitingToggle.style.marginLeft = "8px";

// Track waiting state
let isWaiting = false;

waitingToggle.addEventListener("click", () => {
  isWaiting = !isWaiting;
  waitingToggle.classList.toggle("active", isWaiting);

  // Update the checkbox visualization if needed
  // This depends on how the UI stores the action text
});

// When creating the final action text for processing, check isWaiting:
// If isWaiting is true, prepend [w] instead of [ ] to the checkbox
```

**Step 2: Update action creation logic**

Find where next actions are formatted before being written to files. Modify to use `[w]` when waiting-for is enabled:

```typescript
// Existing code likely has something like:
const checkbox = "- [ ] ";

// Update to:
const checkbox = isWaitingFor ? "- [w] " : "- [ ] ";
```

**Step 3: Consider AI-generated waiting-for items**

When the AI returns `isWaitingFor: true` in the processing result, automatically create `[w]` checkboxes:

```typescript
if (result.isWaitingFor && result.nextAction) {
  const action = `- [w] ${result.nextAction}`;
  // Add to next actions list
}
```

**Step 4: Test manually in Obsidian**

1. Build: `npm run build`
2. Reload plugin
3. Open inbox processing modal
4. Enter an item that creates next actions
5. Verify waiting-for toggle button appears
6. Click toggle, verify visual feedback
7. Process the item
8. Verify action is created with `[w]` checkbox

Expected: Waiting-for toggle works correctly

**Step 5: Commit**

```bash
git add src/inbox-modal-views.ts  # or relevant file
git commit -m "feat: add waiting-for toggle to inbox modal next actions"
```

---

## Task 8: Add Styling for Waiting For View

**Files:**

- Create: `styles.css` (or add to existing styles file)

**Step 1: Add CSS for waiting for view**

```css
/* Waiting For View */
.flow-gtd-waiting-for-view {
  padding: 20px;
}

.flow-gtd-waiting-for-title {
  margin-bottom: 20px;
  color: var(--text-normal);
}

.flow-gtd-waiting-for-loading {
  color: var(--text-muted);
  font-style: italic;
}

.flow-gtd-waiting-for-empty {
  color: var(--text-muted);
  font-style: italic;
  padding: 20px 0;
}

.flow-gtd-waiting-for-file-section {
  margin-bottom: 30px;
}

.flow-gtd-waiting-for-file-header {
  margin-bottom: 10px;
  font-size: 1.1em;
}

.flow-gtd-waiting-for-file-link {
  color: var(--text-accent);
  text-decoration: none;
}

.flow-gtd-waiting-for-file-link:hover {
  text-decoration: underline;
}

.flow-gtd-waiting-for-items {
  list-style: none;
  padding-left: 0;
  margin-left: 20px;
}

.flow-gtd-waiting-for-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.flow-gtd-waiting-for-item-text {
  flex: 1;
  color: var(--text-normal);
}

.flow-gtd-waiting-for-item-text:hover {
  color: var(--text-accent);
}

.flow-gtd-waiting-for-item-actions {
  display: flex;
  gap: 8px;
}

.flow-gtd-waiting-for-action-btn {
  padding: 4px 8px;
  background: var(--interactive-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.flow-gtd-waiting-for-action-btn:hover {
  background: var(--interactive-hover);
}

/* Waiting For Toggle in Inbox Modal */
.flow-gtd-next-action-waiting-toggle {
  padding: 4px 8px;
  background: var(--interactive-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;
}

.flow-gtd-next-action-waiting-toggle:hover {
  opacity: 1;
  background: var(--interactive-hover);
}

.flow-gtd-next-action-waiting-toggle.active {
  opacity: 1;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}
```

**Step 2: Test styling in Obsidian**

1. Build and reload
2. Open waiting for view
3. Verify styling looks good in both light and dark themes
4. Test hover states
5. Test button interactions

Expected: Clean, readable styling that fits Obsidian's design language

**Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add CSS for waiting for view and inbox toggle"
```

---

## Task 9: Update Documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `README.md` (if exists)

**Step 1: Update CLAUDE.md**

Add to the "Key Capabilities" section:

```markdown
- Waiting For list management with `[w]` checkbox status
- Global view aggregating waiting-for items across all projects
- Keyboard-driven task status cycling ([ ] → [w] → [x])
```

Add new section under "Architecture":

```markdown
### Waiting For Support

The plugin supports GTD "Waiting For" items using `[w]` checkbox status:

- **Scanner** (`src/waiting-for-scanner.ts`) - Finds all `[w]` items across vault
- **View** (`src/waiting-for-view.ts`) - Aggregates waiting-for items in dedicated pane
- **Status Cycler** (`src/task-status-cycler.ts`) - Cycles checkbox status: [ ] → [w] → [x]
- **AI Integration** - Processor recognizes waiting-for scenarios during inbox processing
```

Update "Commands" section:

```markdown
### Commands

- `process-inbox`: Opens the inbox processing modal
- `quick-capture`: Same as process-inbox (alias for discoverability)
- `process-inbox-folders`: Opens the modal with inbox folder scanning enabled
- `cycle-task-status`: Cycles checkbox status on current line
- `open-waiting-for-view`: Opens the Waiting For view
```

**Step 2: Update README if it exists**

Add waiting-for feature to feature list and usage instructions.

**Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document waiting for feature"
```

---

## Task 10: Run Full Test Suite and Format

**Files:**

- All files

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass with 80%+ coverage

**Step 2: Run formatter**

```bash
npm run format
```

Expected: All files formatted according to project standards

**Step 3: Build production bundle**

```bash
npm run build
```

Expected: Clean build with no errors

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: format code and verify tests"
```

---

## Task 11: Manual Testing Checklist

**No files modified - manual verification only**

Test the complete feature end-to-end:

1. **Scanner functionality:**
   - Create project files with `[w]` items
   - Create `[w]` items in "Next actions.md"
   - Open waiting for view
   - Verify all items appear grouped by file

2. **Status cycling:**
   - Place cursor on `- [ ]` checkbox line
   - Run "Cycle task status" command
   - Verify cycles: [ ] → [w] → [x] → [ ]
   - Test with asterisk bullets: `* [ ]`
   - Test with indentation

3. **Waiting for view interactions:**
   - Click item text → verify file opens in right pane
   - Click item text again for different file → verify replaces existing pane
   - Click ✓ button → verify item changes to `[x]` in source file
   - Click ← button → verify item changes to `[ ]` in source file
   - Verify view refreshes after actions

4. **Inbox processing:**
   - Process inbox item: "Follow up with John after he reviews proposal"
   - Verify AI recognizes as waiting-for
   - Verify creates `[w]` checkbox
   - Test manual waiting-for toggle in next actions list
   - Verify toggled items create `[w]` checkboxes

5. **Edge cases:**
   - Empty vault (no `[w]` items) → verify empty message
   - File with only completed items `[x]` → verify doesn't appear
   - Mixed `[w]` and `[ ]` and `[x]` in same file → verify only `[w]` shown
   - Delete source file with `[w]` item → verify view handles gracefully

Expected: All manual tests pass

---

## Completion Checklist

- [ ] All 11 tasks completed
- [ ] All tests passing (193+ tests)
- [ ] Test coverage ≥ 80%
- [ ] Code formatted with Prettier
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Ready for code review

## Notes

- Followed TDD throughout (@skills/testing/test-driven-development)
- Maintained DRY principles by reusing patterns from sphere-view.ts
- Applied YAGNI - no over-engineering, minimal viable implementation
- Frequent commits after each logical unit of work
- Plugin remains independent of Tasks plugin
