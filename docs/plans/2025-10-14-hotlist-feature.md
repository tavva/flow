# Focus Feature Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add a focus feature that allows users to curate a focused list of next actions from across their vault, with planning mode in sphere view for selection and a dedicated sidebar view for working through the list.

**Architecture:** Extend sphere view with planning mode toggle, create new focus view component similar to waiting-for view, implement validation service to handle file/line changes, store focus in plugin settings as array of file/line references with cached text.

**Tech Stack:** TypeScript, Obsidian API, Jest for testing

---

## Task 1: Add FocusItem type and settings storage

**Files:**

- Modify: `src/types.ts` (add FocusItem interface)
- Modify: `src/types.ts` (extend PluginSettings interface)

**Step 1: Write the failing test**

```typescript
// tests/types.test.ts (new file)
import { FocusItem } from "../src/types";

describe("FocusItem type", () => {
  it("should have all required properties", () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    expect(item.file).toBe("Projects/Test.md");
    expect(item.lineNumber).toBe(5);
    expect(item.lineContent).toBe("- [ ] Test action");
    expect(item.text).toBe("Test action");
    expect(item.sphere).toBe("work");
    expect(item.isGeneral).toBe(false);
    expect(typeof item.addedAt).toBe("number");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- types.test`
Expected: FAIL with "Cannot find module '../src/types'"

**Step 3: Add FocusItem interface to types.ts**

In `src/types.ts`, add after the FlowProject interface:

```typescript
export interface FocusItem {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  isGeneral: boolean; // true if from Next Actions file
  addedAt: number; // Timestamp
}
```

**Step 4: Extend PluginSettings interface**

In `src/types.ts`, add to PluginSettings interface:

```typescript
export interface PluginSettings {
  // ... existing fields
  focus: FocusItem[];
}
```

**Step 5: Update DEFAULT_SETTINGS in main.ts**

In `main.ts`, add to DEFAULT_SETTINGS:

```typescript
const DEFAULT_SETTINGS: PluginSettings = {
  // ... existing fields
  focus: [],
};
```

**Step 6: Run test to verify it passes**

Run: `npm test -- types.test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/types.ts main.ts tests/types.test.ts
git commit -m "feat: add FocusItem type and settings storage"
```

---

## Task 2: Create focus validator service

**Files:**

- Create: `src/focus-validator.ts`
- Create: `tests/focus-validator.test.ts`

**Step 1: Write the failing test for basic validation**

```typescript
// tests/focus-validator.test.ts
import { FocusValidator, ValidationResult } from "../src/focus-validator";
import { FocusItem } from "../src/types";
import { TFile } from "obsidian";

// Mock Obsidian
jest.mock("obsidian");

describe("FocusValidator", () => {
  let validator: FocusValidator;
  let mockApp: any;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
    };
    validator = new FocusValidator(mockApp);
  });

  describe("validateItem", () => {
    it("should validate when line number and content match", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue("# Heading\n- [ ] Test action\n- [ ] Another");

      const result = await validator.validateItem(item);

      expect(result.found).toBe(true);
      expect(result.updatedLineNumber).toBeUndefined();
    });

    it("should return error when file does not exist", async () => {
      const item: FocusItem = {
        file: "nonexistent.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const result = await validator.validateItem(item);

      expect(result.found).toBe(false);
      expect(result.error).toBe("File not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-validator.test`
Expected: FAIL with "Cannot find module '../src/focus-validator'"

**Step 3: Create focus-validator.ts with basic structure**

```typescript
// src/focus-validator.ts
// ABOUTME: Validates and resolves focus items when files or line numbers change.
// ABOUTME: Uses exact match first, then searches file for matching content.

import { App, TFile } from "obsidian";
import { FocusItem } from "./types";

export interface ValidationResult {
  found: boolean;
  updatedLineNumber?: number;
  currentContent?: string;
  error?: string;
}

export class FocusValidator {
  constructor(private app: App) {}

  async validateItem(item: FocusItem): Promise<ValidationResult> {
    // Check if file exists
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return { found: false, error: "File not found" };
    }

    // Read file content
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Check if line number matches
    const lineIndex = item.lineNumber - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      if (lines[lineIndex] === item.lineContent) {
        return { found: true };
      }
    }

    // Search for matching line
    const foundIndex = lines.findIndex((line) => line === item.lineContent);
    if (foundIndex !== -1) {
      return {
        found: true,
        updatedLineNumber: foundIndex + 1,
        currentContent: lines[foundIndex],
      };
    }

    return { found: false, error: "Line not found" };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-validator.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-validator.ts tests/focus-validator.test.ts
git commit -m "feat: add focus validator with basic validation"
```

---

## Task 3: Add comprehensive validator tests for edge cases

**Files:**

- Modify: `tests/focus-validator.test.ts`

**Step 1: Write tests for line movement scenarios**

Add to `tests/focus-validator.test.ts`:

```typescript
it("should find item when lines inserted above", async () => {
  const item: FocusItem = {
    file: "test.md",
    lineNumber: 2,
    lineContent: "- [ ] Test action",
    text: "Test action",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  // Line now at position 4 instead of 2
  mockVault.read.mockResolvedValue(
    "# Heading\n# New Section\n# Another Section\n- [ ] Test action\n- [ ] Another"
  );

  const result = await validator.validateItem(item);

  expect(result.found).toBe(true);
  expect(result.updatedLineNumber).toBe(4);
});

it("should find item when lines deleted above", async () => {
  const item: FocusItem = {
    file: "test.md",
    lineNumber: 5,
    lineContent: "- [ ] Test action",
    text: "Test action",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  // Line now at position 2 instead of 5
  mockVault.read.mockResolvedValue("# Heading\n- [ ] Test action\n- [ ] Another");

  const result = await validator.validateItem(item);

  expect(result.found).toBe(true);
  expect(result.updatedLineNumber).toBe(2);
});

it("should handle checkbox status changes", async () => {
  const item: FocusItem = {
    file: "test.md",
    lineNumber: 2,
    lineContent: "- [ ] Test action",
    text: "Test action",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  // Checkbox changed to [x] but we stored [ ]
  mockVault.read.mockResolvedValue("# Heading\n- [x] Test action\n- [ ] Another");

  const result = await validator.validateItem(item);

  // Should NOT find it because content changed
  expect(result.found).toBe(false);
  expect(result.error).toBe("Line not found");
});

it("should return error when content completely changed", async () => {
  const item: FocusItem = {
    file: "test.md",
    lineNumber: 2,
    lineContent: "- [ ] Test action",
    text: "Test action",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  mockVault.read.mockResolvedValue("# Heading\n- [ ] Different action\n- [ ] Another");

  const result = await validator.validateItem(item);

  expect(result.found).toBe(false);
  expect(result.error).toBe("Line not found");
});

it("should handle multiple identical actions by using first match", async () => {
  const item: FocusItem = {
    file: "test.md",
    lineNumber: 2,
    lineContent: "- [ ] Test action",
    text: "Test action",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  mockVault.read.mockResolvedValue(
    "# Heading\n- [ ] Test action\n- [ ] Test action\n- [ ] Another"
  );

  const result = await validator.validateItem(item);

  expect(result.found).toBe(true);
  expect(result.updatedLineNumber).toBe(2);
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- focus-validator.test`
Expected: PASS (all tests)

**Step 3: Commit**

```bash
git add tests/focus-validator.test.ts
git commit -m "test: add comprehensive focus validator edge case tests"
```

---

## Task 4: Create focus view component

**Files:**

- Create: `src/focus-view.ts`
- Create: `tests/focus-view.test.ts`

**Step 1: Write the failing test for basic rendering**

```typescript
// tests/focus-view.test.ts
import { FocusView, FOCUS_VIEW_TYPE } from "../src/focus-view";
import { FocusItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

describe("FocusView", () => {
  let view: FocusView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(() => {
    mockSettings = {
      focus: [],
    };
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      workspace: {
        getLeaf: jest.fn(),
      },
    };
    mockLeaf = {
      view: null,
    } as any;

    view = new FocusView(mockLeaf, mockSettings);
    (view as any).app = mockApp;
  });

  it("should have correct view type", () => {
    expect(view.getViewType()).toBe(FOCUS_VIEW_TYPE);
  });

  it("should have correct display text", () => {
    expect(view.getDisplayText()).toBe("Focus");
  });

  it("should render empty state when no items", async () => {
    const mockContainer = {
      children: [null, document.createElement("div")],
    };
    (view as any).containerEl = mockContainer;

    await view.onOpen();

    const container = mockContainer.children[1] as HTMLElement;
    expect(container.querySelector(".flow-gtd-focus-empty")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL with "Cannot find module '../src/focus-view'"

**Step 3: Create focus-view.ts with basic structure**

```typescript
// src/focus-view.ts
// ABOUTME: Leaf view displaying curated focus of next actions from across the vault.
// ABOUTME: Allows marking items complete, converting to waiting-for, or removing from list.

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { FocusItem, PluginSettings } from "./types";
import { FocusValidator, ValidationResult } from "./focus-validator";

export const FOCUS_VIEW_TYPE = "flow-gtd-focus-view";

interface GroupedHotlistItems {
  projectActions: { [filePath: string]: FocusItem[] };
  generalActions: { [sphere: string]: FocusItem[] };
}

export class FocusView extends ItemView {
  private settings: PluginSettings;
  private validator: FocusValidator;
  private rightPaneLeaf: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
    super(leaf);
    this.settings = settings;
    this.validator = new FocusValidator(this.app);
  }

  getViewType(): string {
    return FOCUS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Focus";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-focus-view");

    const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
    titleEl.setText("Focus");

    if (this.settings.focus.length === 0) {
      this.renderEmptyMessage(container as HTMLElement);
      return;
    }

    const grouped = this.groupItems(this.settings.focus);
    this.renderGroupedItems(container as HTMLElement, grouped);
  }

  async onClose() {
    // Cleanup if needed
  }

  private groupItems(items: FocusItem[]): GroupedHotlistItems {
    const projectActions: { [filePath: string]: FocusItem[] } = {};
    const generalActions: { [sphere: string]: FocusItem[] } = {};

    items.forEach((item) => {
      if (item.isGeneral) {
        if (!generalActions[item.sphere]) {
          generalActions[item.sphere] = [];
        }
        generalActions[item.sphere].push(item);
      } else {
        if (!projectActions[item.file]) {
          projectActions[item.file] = [];
        }
        projectActions[item.file].push(item);
      }
    });

    return { projectActions, generalActions };
  }

  private renderGroupedItems(container: HTMLElement, grouped: GroupedHotlistItems) {
    // Project Actions section
    if (Object.keys(grouped.projectActions).length > 0) {
      const projectSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      projectSection.createEl("h3", {
        text: "Project Actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderFileGroup(projectSection, filePath, grouped.projectActions[filePath]);
        });
    }

    // General Actions section
    if (Object.keys(grouped.generalActions).length > 0) {
      const generalSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      generalSection.createEl("h3", {
        text: "General Actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderSphereGroup(generalSection, sphere, grouped.generalActions[sphere]);
        });
    }
  }

  private renderFileGroup(container: HTMLElement, filePath: string, items: FocusItem[]) {
    const fileSection = container.createDiv({ cls: "flow-gtd-focus-file-section" });

    const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-focus-file-header" });
    const fileName = filePath.split("/").pop() || filePath;
    const fileLink = fileHeader.createEl("a", {
      text: fileName,
      cls: "flow-gtd-focus-file-link",
    });
    fileLink.style.cursor = "pointer";
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openFile(filePath);
    });

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderSphereGroup(container: HTMLElement, sphere: string, items: FocusItem[]) {
    const sphereSection = container.createDiv({ cls: "flow-gtd-focus-sphere-section" });

    sphereSection.createEl("h4", {
      text: `(${sphere} sphere)`,
      cls: "flow-gtd-focus-sphere-header",
    });

    const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-focus-item" });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    const waitingBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "⏸",
    });
    waitingBtn.title = "Convert to waiting for";
    waitingBtn.addEventListener("click", async () => {
      await this.convertToWaitingFor(item);
    });

    const removeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from focus";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromHotlist(item);
    });
  }

  private renderEmptyMessage(container: HTMLElement) {
    container
      .createDiv({ cls: "flow-gtd-focus-empty" })
      .setText("No items in focus. Use planning mode in sphere view to add actions.");
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

  private async markItemComplete(item: FocusItem): Promise<void> {
    const validation = await this.validator.validateItem(item);
    if (!validation.found) {
      console.error("Cannot mark item complete: item not found");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[(?: |w)\]/i, "[x]");
      await this.app.vault.modify(file, lines.join("\n"));
      await this.removeFromHotlist(item);
    }
  }

  private async convertToWaitingFor(item: FocusItem): Promise<void> {
    const validation = await this.validator.validateItem(item);
    if (!validation.found) {
      console.error("Cannot convert item: item not found");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[ \]/i, "[w]");
      await this.app.vault.modify(file, lines.join("\n"));
      await this.removeFromHotlist(item);
    }
  }

  private async removeFromHotlist(item: FocusItem): Promise<void> {
    this.settings.focus = this.settings.focus.filter(
      (i) =>
        !(i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt)
    );
    await this.onOpen(); // Re-render
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: add focus view component with grouping and actions"
```

---

## Task 5: Add planning mode to sphere view

**Files:**

- Modify: `src/sphere-view.ts`
- Modify: `tests/sphere-view.test.ts`

**Step 1: Write the failing test for planning mode toggle**

Add to `tests/sphere-view.test.ts`:

```typescript
describe("planning mode", () => {
  it("should toggle planning mode on and off", () => {
    const view = new SphereView(mockLeaf, "work", mockSettings);
    (view as any).app = mockApp;

    expect((view as any).planningMode).toBe(false);

    (view as any).togglePlanningMode();
    expect((view as any).planningMode).toBe(true);

    (view as any).togglePlanningMode();
    expect((view as any).planningMode).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-view.test`
Expected: FAIL with "togglePlanningMode is not a function"

**Step 3: Add planning mode state and toggle to SphereView**

In `src/sphere-view.ts`, add after the class properties:

```typescript
export class SphereView extends ItemView {
  private readonly scanner: FlowProjectScanner;
  private sphere: string;
  private settings: PluginSettings;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private planningMode: boolean = false; // Add this

  // ... existing constructor

  private togglePlanningMode() {
    this.planningMode = !this.planningMode;
    this.onOpen(); // Re-render
  }
}
```

**Step 4: Modify renderContent to show planning mode UI**

In `src/sphere-view.ts`, modify `renderContent`:

```typescript
private renderContent(container: HTMLElement, data: SphereViewData) {
  const titleEl = container.createEl("h2", { cls: "flow-gtd-sphere-title" });
  titleEl.setText(this.getDisplaySphereName());

  // Add planning mode toggle button
  const toggleBtn = container.createEl("button", {
    cls: "flow-gtd-sphere-planning-toggle",
    text: this.planningMode ? "Exit Planning Mode" : "Planning Mode",
  });
  toggleBtn.addEventListener("click", () => {
    this.togglePlanningMode();
  });

  // Add planning mode banner if active
  if (this.planningMode) {
    const banner = container.createDiv({ cls: "flow-gtd-sphere-planning-banner" });
    banner.setText("Planning Mode - Click actions to add/remove from focus");
  }

  // Add planning mode background class
  if (this.planningMode) {
    container.addClass("flow-gtd-sphere-planning-active");
  }

  this.renderProjectsNeedingActionsSection(container, data.projectsNeedingNextActions);
  this.renderProjectsSection(container, data.projects);
  this.renderGeneralNextActionsSection(
    container,
    data.generalNextActions,
    data.generalNextActionsNotice
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- sphere-view.test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view.test.ts
git commit -m "feat: add planning mode toggle to sphere view"
```

---

## Task 6: Add clickable actions in planning mode

**Files:**

- Modify: `src/sphere-view.ts`
- Modify: `tests/sphere-view.test.ts`

**Step 1: Write test for adding action to focus**

Add to `tests/sphere-view.test.ts`:

```typescript
it("should add action to focus when clicked in planning mode", async () => {
  mockSettings.focus = [];
  const view = new SphereView(mockLeaf, "work", mockSettings);
  (view as any).app = mockApp;
  (view as any).planningMode = true;

  const mockProject: FlowProject = {
    file: "Projects/Test.md",
    title: "Test Project",
    tags: ["project/work"],
    priority: 1,
    status: "live",
    nextActions: ["Test action"],
  };

  await (view as any).addToHotlist(
    "Test action",
    "Projects/Test.md",
    5,
    "- [ ] Test action",
    "work",
    false
  );

  expect(mockSettings.focus).toHaveLength(1);
  expect(mockSettings.focus[0].text).toBe("Test action");
  expect(mockSettings.focus[0].file).toBe("Projects/Test.md");
});

it("should remove action from focus when clicked again in planning mode", async () => {
  mockSettings.focus = [
    {
      file: "Projects/Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    },
  ];
  const view = new SphereView(mockLeaf, "work", mockSettings);
  (view as any).app = mockApp;
  (view as any).planningMode = true;

  await (view as any).removeFromHotlist("Projects/Test.md", 5);

  expect(mockSettings.focus).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-view.test`
Expected: FAIL with "addToHotlist is not a function"

**Step 3: Add focus management methods to SphereView**

In `src/sphere-view.ts`, add these methods:

```typescript
private async addToHotlist(
  text: string,
  file: string,
  lineNumber: number,
  lineContent: string,
  sphere: string,
  isGeneral: boolean
): Promise<void> {
  const item: FocusItem = {
    file,
    lineNumber,
    lineContent,
    text,
    sphere,
    isGeneral,
    addedAt: Date.now(),
  };

  this.settings.focus.push(item);
  await this.onOpen(); // Re-render to show updated state
}

private async removeFromHotlist(file: string, lineNumber: number): Promise<void> {
  this.settings.focus = this.settings.focus.filter(
    (item) => !(item.file === file && item.lineNumber === lineNumber)
  );
  await this.onOpen(); // Re-render to show updated state
}

private isOnHotlist(file: string, lineNumber: number): boolean {
  return this.settings.focus.some(
    (item) => item.file === file && item.lineNumber === lineNumber
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- sphere-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view.test.ts
git commit -m "feat: add focus management methods to sphere view"
```

---

## Task 7: Make project actions clickable in planning mode

**Files:**

- Modify: `src/sphere-view.ts`

**Step 1: Modify renderProjectsSection to handle planning mode clicks**

In `src/sphere-view.ts`, replace the `renderProjectsSection` method:

```typescript
private renderProjectsSection(container: HTMLElement, projects: SphereProjectSummary[]) {
  const section = this.createSection(container, "Projects");

  if (projects.length === 0) {
    this.renderEmptyMessage(section, "No projects are tagged with this sphere yet.");
    return;
  }

  projects.forEach(({ project, priority }) => {
    const wrapper = section.createDiv({ cls: "flow-gtd-sphere-project" });
    const header = wrapper.createDiv({ cls: "flow-gtd-sphere-project-header" });

    const titleLink = header.createEl("a", {
      text: project.title,
      cls: "flow-gtd-sphere-project-title flow-gtd-sphere-project-link",
    });
    titleLink.style.cursor = "pointer";
    titleLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openProjectFile(project.file);
    });
    if (priority !== null) {
      header.createSpan({
        cls: "flow-gtd-sphere-project-priority",
        text: `Priority ${priority}`,
      });
    }

    if (project.nextActions && project.nextActions.length > 0) {
      const list = wrapper.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
      project.nextActions.forEach((action, index) => {
        const item = list.createEl("li", { text: action });

        // In planning mode, make actions clickable
        if (this.planningMode) {
          item.style.cursor = "pointer";

          // Calculate line number (approximate - will be validated)
          const lineNumber = index + 10; // Rough estimate, validator will fix

          // Show visual indicator if already on focus
          if (this.isOnHotlist(project.file, lineNumber)) {
            item.addClass("flow-gtd-focus-indicator");
          }

          item.addEventListener("click", async () => {
            if (this.isOnHotlist(project.file, lineNumber)) {
              await this.removeFromHotlist(project.file, lineNumber);
            } else {
              await this.addToHotlist(
                action,
                project.file,
                lineNumber,
                `- [ ] ${action}`,
                this.sphere,
                false
              );
            }
          });
        }
      });
    } else {
      this.renderEmptyMessage(wrapper, "No next actions captured yet.");
    }
  });
}
```

**Step 2: Test manually (no automated test for this rendering change)**

**Step 3: Commit**

```bash
git add src/sphere-view.ts
git commit -m "feat: make project actions clickable in planning mode"
```

---

## Task 8: Make general actions clickable in planning mode

**Files:**

- Modify: `src/sphere-view.ts`

**Step 1: Modify renderGeneralNextActionsSection to handle planning mode clicks**

In `src/sphere-view.ts`, replace the `renderGeneralNextActionsSection` method:

```typescript
private renderGeneralNextActionsSection(
  container: HTMLElement,
  actions: string[],
  notice?: string
) {
  const section = this.createSection(container, "General next actions");

  if (notice) {
    const noticeEl = section.createDiv({ cls: "flow-gtd-sphere-notice" });
    noticeEl.setText(notice);
  }

  if (actions.length === 0) {
    this.renderEmptyMessage(section, "No general next actions tagged for this sphere.");
    return;
  }

  const list = section.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
  const nextActionsFile = this.settings.nextActionsFilePath?.trim() || "Next actions.md";

  actions.forEach((action, index) => {
    const item = list.createEl("li", { text: action });

    // In planning mode, make actions clickable
    if (this.planningMode) {
      item.style.cursor = "pointer";

      // Calculate line number (approximate - will be validated)
      const lineNumber = index + 5; // Rough estimate, validator will fix

      // Show visual indicator if already on focus
      if (this.isOnHotlist(nextActionsFile, lineNumber)) {
        item.addClass("flow-gtd-focus-indicator");
      }

      item.addEventListener("click", async () => {
        if (this.isOnHotlist(nextActionsFile, lineNumber)) {
          await this.removeFromHotlist(nextActionsFile, lineNumber);
        } else {
          await this.addToHotlist(
            action,
            nextActionsFile,
            lineNumber,
            `- [ ] ${action} #sphere/${this.sphere}`,
            this.sphere,
            true
          );
        }
      });
    }
  });
}
```

**Step 2: Test manually (no automated test for this rendering change)**

**Step 3: Commit**

```bash
git add src/sphere-view.ts
git commit -m "feat: make general actions clickable in planning mode"
```

---

## Task 9: Register focus view and commands in main.ts

**Files:**

- Modify: `main.ts`

**Step 1: Write test for command registration**

Add to relevant test file or create new test:

```typescript
// This would normally go in a main.test.ts or integration test
// For now, we'll test manually
```

**Step 2: Import FocusView in main.ts**

At the top of `main.ts`, add:

```typescript
import { FocusView, FOCUS_VIEW_TYPE } from "./focus-view";
```

**Step 3: Register focus view type in onload**

In the `onload()` method of `main.ts`, add:

```typescript
async onload() {
  await this.loadSettings();

  // Register focus view
  this.registerView(
    FOCUS_VIEW_TYPE,
    (leaf) => new FocusView(leaf, this.settings)
  );

  // ... existing code
}
```

**Step 4: Add command to open focus view**

In the `onload()` method, add:

```typescript
this.addCommand({
  id: "open-focus",
  name: "Open Focus",
  callback: () => {
    this.activateHotlistView();
  },
});
```

**Step 5: Add activateHotlistView method**

In the main plugin class, add:

```typescript
async activateHotlistView() {
  const { workspace } = this.app;

  let leaf: WorkspaceLeaf | null = null;
  const leaves = workspace.getLeavesOfType(FOCUS_VIEW_TYPE);

  if (leaves.length > 0) {
    // View already exists, reveal it
    leaf = leaves[0];
  } else {
    // Create new leaf in right sidebar
    leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: FOCUS_VIEW_TYPE,
        active: true,
      });
    }
  }

  // Reveal the leaf
  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}
```

**Step 6: Add ribbon icon**

In the `onload()` method, add:

```typescript
this.addRibbonIcon("list-checks", "Open Focus", () => {
  this.activateHotlistView();
});
```

**Step 7: Test manually by building and loading in Obsidian**

Run: `npm run build`

**Step 8: Commit**

```bash
git add main.ts
git commit -m "feat: register focus view and commands"
```

---

## Task 10: Add CSS styling for focus and planning mode

**Files:**

- Create: `styles/focus.css` (or modify existing styles.css)

**Step 1: Create CSS for focus view**

```css
/* Focus View Styles */
.flow-gtd-focus-view {
  padding: 1rem;
}

.flow-gtd-focus-title {
  margin-bottom: 1rem;
}

.flow-gtd-focus-empty {
  color: var(--text-muted);
  font-style: italic;
  padding: 1rem;
}

.flow-gtd-focus-section {
  margin-bottom: 2rem;
}

.flow-gtd-focus-section-title {
  font-size: 1.2em;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 0.25rem;
}

.flow-gtd-focus-file-section,
.flow-gtd-focus-sphere-section {
  margin-bottom: 1rem;
}

.flow-gtd-focus-file-header,
.flow-gtd-focus-sphere-header {
  font-size: 1em;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-accent);
}

.flow-gtd-focus-file-link {
  color: var(--text-accent);
  text-decoration: none;
}

.flow-gtd-focus-file-link:hover {
  text-decoration: underline;
}

.flow-gtd-focus-items {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.flow-gtd-focus-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  background: var(--background-secondary);
}

.flow-gtd-focus-item:hover {
  background: var(--background-secondary-alt);
}

.flow-gtd-focus-item-text {
  flex: 1;
  cursor: pointer;
}

.flow-gtd-focus-item-actions {
  display: flex;
  gap: 0.25rem;
}

.flow-gtd-focus-action-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
}

.flow-gtd-focus-action-btn:hover {
  background: var(--interactive-accent-hover);
}

/* Planning Mode Styles */
.flow-gtd-sphere-planning-toggle {
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border: 2px solid var(--interactive-accent);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.flow-gtd-sphere-planning-toggle:hover {
  background: var(--background-secondary);
}

.flow-gtd-sphere-planning-banner {
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: var(--background-modifier-info);
  border-left: 4px solid var(--interactive-accent);
  border-radius: 4px;
  font-weight: 600;
  color: var(--text-normal);
}

.flow-gtd-sphere-planning-active {
  background: var(--background-secondary);
}

.flow-gtd-sphere-planning-active .flow-gtd-sphere-next-actions li {
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  transition: background 0.2s;
}

.flow-gtd-sphere-planning-active .flow-gtd-sphere-next-actions li:hover {
  background: var(--background-modifier-hover);
}

.flow-gtd-focus-indicator {
  background: var(--background-modifier-success);
  font-weight: 600;
}

.flow-gtd-focus-indicator::before {
  content: "✓ ";
  color: var(--text-success);
}
```

**Step 2: Test manually by loading in Obsidian**

**Step 3: Commit**

```bash
git add styles/focus.css
git commit -m "feat: add CSS styling for focus and planning mode"
```

---

## Task 11: Fix line number detection for accurate focus references

**Files:**

- Create: `src/action-line-finder.ts`
- Create: `tests/action-line-finder.test.ts`
- Modify: `src/sphere-view.ts`

**Step 1: Write test for finding action line numbers**

```typescript
// tests/action-line-finder.test.ts
import { ActionLineFinder } from "../src/action-line-finder";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("ActionLineFinder", () => {
  let finder: ActionLineFinder;
  let mockApp: any;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
    };
    finder = new ActionLineFinder(mockApp);
  });

  it("should find line number for project action", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] First action\n- [ ] Second action\n"
    );

    const result = await finder.findActionLine("Projects/Test.md", "First action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(9);
    expect(result.lineContent).toBe("- [ ] First action");
  });

  it("should find line number for general action with sphere tag", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Next Actions\n\n- [ ] General action #sphere/work\n- [ ] Another action #sphere/personal\n"
    );

    const result = await finder.findActionLine("Next actions.md", "General action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [ ] General action #sphere/work");
  });

  it("should return error when action not found", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Empty\n\nNo actions here\n");

    const result = await finder.findActionLine("Empty.md", "Missing action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("Action not found in file");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- action-line-finder.test`
Expected: FAIL with "Cannot find module '../src/action-line-finder'"

**Step 3: Create action-line-finder.ts**

```typescript
// src/action-line-finder.ts
// ABOUTME: Finds exact line numbers for actions in files by searching file content.
// ABOUTME: Used when adding actions to focus to get accurate line references.

import { App, TFile } from "obsidian";

export interface ActionLineResult {
  found: boolean;
  lineNumber?: number;
  lineContent?: string;
  error?: string;
}

export class ActionLineFinder {
  constructor(private app: App) {}

  async findActionLine(filePath: string, actionText: string): Promise<ActionLineResult> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return { found: false, error: "File not found" };
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Search for line containing the action text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match checkbox lines containing the action text
      if (line.match(/^[-*]\s*\[(?: |x|X|w)\]/) && line.includes(actionText)) {
        return {
          found: true,
          lineNumber: i + 1,
          lineContent: line,
        };
      }
    }

    return { found: false, error: "Action not found in file" };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- action-line-finder.test`
Expected: PASS

**Step 5: Update sphere-view.ts to use ActionLineFinder**

In `src/sphere-view.ts`, import ActionLineFinder:

```typescript
import { ActionLineFinder } from "./action-line-finder";
```

Add to class properties:

```typescript
private lineFinder: ActionLineFinder;
```

Initialize in constructor:

```typescript
constructor(leaf: WorkspaceLeaf, sphere: string, settings: PluginSettings) {
  super(leaf);
  this.sphere = sphere;
  this.settings = settings;
  this.scanner = new FlowProjectScanner(this.app);
  this.lineFinder = new ActionLineFinder(this.app);
}
```

Update the click handlers in `renderProjectsSection` and `renderGeneralNextActionsSection` to use real line finding:

```typescript
// In renderProjectsSection, replace the click handler:
item.addEventListener("click", async () => {
  const lineResult = await this.lineFinder.findActionLine(project.file, action);
  if (!lineResult.found) {
    console.error("Could not find line for action:", action);
    return;
  }

  if (this.isOnHotlist(project.file, lineResult.lineNumber!)) {
    await this.removeFromHotlist(project.file, lineResult.lineNumber!);
  } else {
    await this.addToHotlist(
      action,
      project.file,
      lineResult.lineNumber!,
      lineResult.lineContent!,
      this.sphere,
      false
    );
  }
});

// Similar change in renderGeneralNextActionsSection
```

**Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests)

**Step 7: Commit**

```bash
git add src/action-line-finder.ts tests/action-line-finder.test.ts src/sphere-view.ts
git commit -m "feat: add accurate line number detection for focus items"
```

---

## Task 12: Add comprehensive integration tests

**Files:**

- Create: `tests/focus-integration.test.ts`

**Step 1: Write integration test**

```typescript
// tests/focus-integration.test.ts
import { FocusView } from "../src/focus-view";
import { SphereView } from "../src/sphere-view";
import { FocusValidator } from "../src/focus-validator";
import { ActionLineFinder } from "../src/action-line-finder";
import { PluginSettings, FocusItem } from "../src/types";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("Focus Integration", () => {
  let mockApp: any;
  let mockVault: any;
  let mockSettings: PluginSettings;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      modify: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
      workspace: {
        getLeaf: jest.fn(),
      },
    };
    mockSettings = {
      anthropicApiKey: "",
      anthropicModel: "claude-sonnet-4-20250514",
      provider: "anthropic",
      openAIApiKey: "",
      openAIBaseURL: "https://openrouter.ai/api/v1",
      openAIModel: "openrouter/anthropic/claude-3.5-sonnet",
      defaultPriority: 2,
      defaultStatus: "live",
      inboxFilesFolder: "Flow Inbox Files",
      inboxFolder: "Flow Inbox Folder",
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      projectsFolder: "Projects",
      spheres: ["work", "personal"],
      focus: [],
    };
  });

  it("should add action to focus and validate it", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );

    // Find the line
    const finder = new ActionLineFinder(mockApp);
    const lineResult = await finder.findActionLine("Projects/Test.md", "Test action");

    expect(lineResult.found).toBe(true);

    // Add to focus
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: lineResult.lineNumber!,
      lineContent: lineResult.lineContent!,
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };
    mockSettings.focus.push(item);

    // Validate the item
    const validator = new FocusValidator(mockApp);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(mockSettings.focus).toHaveLength(1);
  });

  it("should handle line number changes after file edits", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // New content with action moved to line 11
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Description\n\nNew section\n\n## Next actions\n\n- [ ] Test action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(13);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- focus-integration.test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/focus-integration.test.ts
git commit -m "test: add comprehensive focus integration tests"
```

---

## Task 13: Update documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `README.md` (if exists)

**Step 1: Update CLAUDE.md with focus feature**

Add to the "Key Capabilities" section:

```markdown
- Focus for curating focused set of next actions
- Planning mode in sphere view for selecting actions
- Validation and resolution when source files change
```

Add new section after "Waiting For Support":

```markdown
### Focus Support

The plugin supports creating a curated "focus" of next actions to work on:

- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files
- **FocusValidator** (`src/focus-validator.ts`) - Validates and resolves focus items when files change
- **FocusView** (`src/focus-view.ts`) - Displays focus in sidebar with actions grouped by project/sphere
- **SphereView Planning Mode** - Toggle planning mode to click actions and add to focus
- **Commands** - "Open Focus" command and ribbon icon
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document focus feature in CLAUDE.md"
```

---

## Task 14: Run full test suite and verify coverage

**Files:**

- All test files

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run coverage check**

Run: `npm run test:coverage`
Expected: Coverage above 80% threshold

**Step 3: Fix any coverage gaps**

If coverage is below threshold, add tests for uncovered branches/lines.

**Step 4: Commit any test additions**

```bash
git add tests/
git commit -m "test: ensure full test coverage for focus feature"
```

---

## Task 15: Manual testing in Obsidian

**Files:**

- N/A (manual testing)

**Step 1: Build the plugin**

Run: `npm run build`
Expected: Clean build with no errors

**Step 2: Test in Obsidian**

1. Open sphere view for a sphere
2. Click "Planning Mode" button
3. Verify banner appears and background changes
4. Click several project actions to add to focus
5. Click several general actions to add to focus
6. Verify checkmarks appear on selected actions
7. Click "Exit Planning Mode"
8. Open focus view from ribbon or command palette
9. Verify actions are grouped correctly (project vs general)
10. Test marking action complete (should update source file and remove from focus)
11. Test converting to waiting-for (should update source file and remove from focus)
12. Test removing from focus (should only remove from focus, not touch source)
13. Test clicking action text (should open source file at correct line)

**Step 3: Test file editing scenarios**

1. Add action to focus
2. Edit source file to add lines above the action
3. Reopen focus view
4. Verify action still works (validator should find it)

**Step 4: Document any issues found**

Create issues or fix bugs discovered during testing.

---

## Task 16: Final cleanup and commit

**Files:**

- All modified files

**Step 1: Run formatter**

Run: `npm run format`

**Step 2: Run linter**

Run: `npm run lint` (if configured)

**Step 3: Review all changes**

Run: `git status` and `git diff`

**Step 4: Create final commit**

```bash
git add .
git commit -m "feat: complete focus feature implementation"
```

**Step 5: Run tests one final time**

Run: `npm test`
Expected: All tests pass

---

## Completion Checklist

- [ ] FocusItem type and settings storage
- [ ] Focus validator service with comprehensive tests
- [ ] Focus view component with grouping
- [ ] Planning mode in sphere view
- [ ] Clickable actions in planning mode (project and general)
- [ ] Commands and ribbon icon registered
- [ ] CSS styling for focus and planning mode
- [ ] Accurate line number detection with ActionLineFinder
- [ ] Integration tests
- [ ] Documentation updates
- [ ] Full test coverage (80%+)
- [ ] Manual testing in Obsidian
- [ ] Code formatted and cleaned
