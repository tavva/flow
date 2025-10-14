# Hotlist Feature Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add a hotlist feature that allows users to curate a focused list of next actions from across their vault, with planning mode in sphere view for selection and a dedicated sidebar view for working through the list.

**Architecture:** Extend sphere view with planning mode toggle, create new hotlist view component similar to waiting-for view, implement validation service to handle file/line changes, store hotlist in plugin settings as array of file/line references with cached text.

**Tech Stack:** TypeScript, Obsidian API, Jest for testing

---

## Task 1: Add HotlistItem type and settings storage

**Files:**

- Modify: `src/types.ts` (add HotlistItem interface)
- Modify: `src/types.ts` (extend PluginSettings interface)

**Step 1: Write the failing test**

```typescript
// tests/types.test.ts (new file)
import { HotlistItem } from "../src/types";

describe("HotlistItem type", () => {
  it("should have all required properties", () => {
    const item: HotlistItem = {
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

**Step 3: Add HotlistItem interface to types.ts**

In `src/types.ts`, add after the FlowProject interface:

```typescript
export interface HotlistItem {
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
  hotlist: HotlistItem[];
}
```

**Step 5: Update DEFAULT_SETTINGS in main.ts**

In `main.ts`, add to DEFAULT_SETTINGS:

```typescript
const DEFAULT_SETTINGS: PluginSettings = {
  // ... existing fields
  hotlist: [],
};
```

**Step 6: Run test to verify it passes**

Run: `npm test -- types.test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/types.ts main.ts tests/types.test.ts
git commit -m "feat: add HotlistItem type and settings storage"
```

---

## Task 2: Create hotlist validator service

**Files:**

- Create: `src/hotlist-validator.ts`
- Create: `tests/hotlist-validator.test.ts`

**Step 1: Write the failing test for basic validation**

```typescript
// tests/hotlist-validator.test.ts
import { HotlistValidator, ValidationResult } from "../src/hotlist-validator";
import { HotlistItem } from "../src/types";
import { TFile } from "obsidian";

// Mock Obsidian
jest.mock("obsidian");

describe("HotlistValidator", () => {
  let validator: HotlistValidator;
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
    validator = new HotlistValidator(mockApp);
  });

  describe("validateItem", () => {
    it("should validate when line number and content match", async () => {
      const item: HotlistItem = {
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
      const item: HotlistItem = {
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

Run: `npm test -- hotlist-validator.test`
Expected: FAIL with "Cannot find module '../src/hotlist-validator'"

**Step 3: Create hotlist-validator.ts with basic structure**

```typescript
// src/hotlist-validator.ts
// ABOUTME: Validates and resolves hotlist items when files or line numbers change.
// ABOUTME: Uses exact match first, then searches file for matching content.

import { App, TFile } from "obsidian";
import { HotlistItem } from "./types";

export interface ValidationResult {
  found: boolean;
  updatedLineNumber?: number;
  currentContent?: string;
  error?: string;
}

export class HotlistValidator {
  constructor(private app: App) {}

  async validateItem(item: HotlistItem): Promise<ValidationResult> {
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

Run: `npm test -- hotlist-validator.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hotlist-validator.ts tests/hotlist-validator.test.ts
git commit -m "feat: add hotlist validator with basic validation"
```

---

## Task 3: Add comprehensive validator tests for edge cases

**Files:**

- Modify: `tests/hotlist-validator.test.ts`

**Step 1: Write tests for line movement scenarios**

Add to `tests/hotlist-validator.test.ts`:

```typescript
it("should find item when lines inserted above", async () => {
  const item: HotlistItem = {
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
  const item: HotlistItem = {
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
  const item: HotlistItem = {
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
  const item: HotlistItem = {
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
  const item: HotlistItem = {
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

Run: `npm test -- hotlist-validator.test`
Expected: PASS (all tests)

**Step 3: Commit**

```bash
git add tests/hotlist-validator.test.ts
git commit -m "test: add comprehensive hotlist validator edge case tests"
```

---

## Task 4: Create hotlist view component

**Files:**

- Create: `src/hotlist-view.ts`
- Create: `tests/hotlist-view.test.ts`

**Step 1: Write the failing test for basic rendering**

```typescript
// tests/hotlist-view.test.ts
import { HotlistView, HOTLIST_VIEW_TYPE } from "../src/hotlist-view";
import { HotlistItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

describe("HotlistView", () => {
  let view: HotlistView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(() => {
    mockSettings = {
      hotlist: [],
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

    view = new HotlistView(mockLeaf, mockSettings);
    (view as any).app = mockApp;
  });

  it("should have correct view type", () => {
    expect(view.getViewType()).toBe(HOTLIST_VIEW_TYPE);
  });

  it("should have correct display text", () => {
    expect(view.getDisplayText()).toBe("Hotlist");
  });

  it("should render empty state when no items", async () => {
    const mockContainer = {
      children: [null, document.createElement("div")],
    };
    (view as any).containerEl = mockContainer;

    await view.onOpen();

    const container = mockContainer.children[1] as HTMLElement;
    expect(container.querySelector(".flow-gtd-hotlist-empty")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- hotlist-view.test`
Expected: FAIL with "Cannot find module '../src/hotlist-view'"

**Step 3: Create hotlist-view.ts with basic structure**

```typescript
// src/hotlist-view.ts
// ABOUTME: Leaf view displaying curated hotlist of next actions from across the vault.
// ABOUTME: Allows marking items complete, converting to waiting-for, or removing from list.

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { HotlistItem, PluginSettings } from "./types";
import { HotlistValidator, ValidationResult } from "./hotlist-validator";

export const HOTLIST_VIEW_TYPE = "flow-gtd-hotlist-view";

interface GroupedHotlistItems {
  projectActions: { [filePath: string]: HotlistItem[] };
  generalActions: { [sphere: string]: HotlistItem[] };
}

export class HotlistView extends ItemView {
  private settings: PluginSettings;
  private validator: HotlistValidator;
  private rightPaneLeaf: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
    super(leaf);
    this.settings = settings;
    this.validator = new HotlistValidator(this.app);
  }

  getViewType(): string {
    return HOTLIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Hotlist";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-hotlist-view");

    const titleEl = container.createEl("h2", { cls: "flow-gtd-hotlist-title" });
    titleEl.setText("Hotlist");

    if (this.settings.hotlist.length === 0) {
      this.renderEmptyMessage(container as HTMLElement);
      return;
    }

    const grouped = this.groupItems(this.settings.hotlist);
    this.renderGroupedItems(container as HTMLElement, grouped);
  }

  async onClose() {
    // Cleanup if needed
  }

  private groupItems(items: HotlistItem[]): GroupedHotlistItems {
    const projectActions: { [filePath: string]: HotlistItem[] } = {};
    const generalActions: { [sphere: string]: HotlistItem[] } = {};

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
      const projectSection = container.createDiv({ cls: "flow-gtd-hotlist-section" });
      projectSection.createEl("h3", {
        text: "Project Actions",
        cls: "flow-gtd-hotlist-section-title",
      });

      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderFileGroup(projectSection, filePath, grouped.projectActions[filePath]);
        });
    }

    // General Actions section
    if (Object.keys(grouped.generalActions).length > 0) {
      const generalSection = container.createDiv({ cls: "flow-gtd-hotlist-section" });
      generalSection.createEl("h3", {
        text: "General Actions",
        cls: "flow-gtd-hotlist-section-title",
      });

      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderSphereGroup(generalSection, sphere, grouped.generalActions[sphere]);
        });
    }
  }

  private renderFileGroup(container: HTMLElement, filePath: string, items: HotlistItem[]) {
    const fileSection = container.createDiv({ cls: "flow-gtd-hotlist-file-section" });

    const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-hotlist-file-header" });
    const fileName = filePath.split("/").pop() || filePath;
    const fileLink = fileHeader.createEl("a", {
      text: fileName,
      cls: "flow-gtd-hotlist-file-link",
    });
    fileLink.style.cursor = "pointer";
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openFile(filePath);
    });

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-hotlist-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderSphereGroup(container: HTMLElement, sphere: string, items: HotlistItem[]) {
    const sphereSection = container.createDiv({ cls: "flow-gtd-hotlist-sphere-section" });

    sphereSection.createEl("h4", {
      text: `(${sphere} sphere)`,
      cls: "flow-gtd-hotlist-sphere-header",
    });

    const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-hotlist-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderItem(container: HTMLElement, item: HotlistItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-hotlist-item" });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    const waitingBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "⏸",
    });
    waitingBtn.title = "Convert to waiting for";
    waitingBtn.addEventListener("click", async () => {
      await this.convertToWaitingFor(item);
    });

    const removeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from hotlist";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromHotlist(item);
    });
  }

  private renderEmptyMessage(container: HTMLElement) {
    container
      .createDiv({ cls: "flow-gtd-hotlist-empty" })
      .setText("No items in hotlist. Use planning mode in sphere view to add actions.");
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

  private async markItemComplete(item: HotlistItem): Promise<void> {
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

  private async convertToWaitingFor(item: HotlistItem): Promise<void> {
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

  private async removeFromHotlist(item: HotlistItem): Promise<void> {
    this.settings.hotlist = this.settings.hotlist.filter(
      (i) =>
        !(i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt)
    );
    await this.onOpen(); // Re-render
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- hotlist-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hotlist-view.ts tests/hotlist-view.test.ts
git commit -m "feat: add hotlist view component with grouping and actions"
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
    banner.setText("Planning Mode - Click actions to add/remove from hotlist");
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

**Step 1: Write test for adding action to hotlist**

Add to `tests/sphere-view.test.ts`:

```typescript
it("should add action to hotlist when clicked in planning mode", async () => {
  mockSettings.hotlist = [];
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

  expect(mockSettings.hotlist).toHaveLength(1);
  expect(mockSettings.hotlist[0].text).toBe("Test action");
  expect(mockSettings.hotlist[0].file).toBe("Projects/Test.md");
});

it("should remove action from hotlist when clicked again in planning mode", async () => {
  mockSettings.hotlist = [
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

  expect(mockSettings.hotlist).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-view.test`
Expected: FAIL with "addToHotlist is not a function"

**Step 3: Add hotlist management methods to SphereView**

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
  const item: HotlistItem = {
    file,
    lineNumber,
    lineContent,
    text,
    sphere,
    isGeneral,
    addedAt: Date.now(),
  };

  this.settings.hotlist.push(item);
  await this.onOpen(); // Re-render to show updated state
}

private async removeFromHotlist(file: string, lineNumber: number): Promise<void> {
  this.settings.hotlist = this.settings.hotlist.filter(
    (item) => !(item.file === file && item.lineNumber === lineNumber)
  );
  await this.onOpen(); // Re-render to show updated state
}

private isOnHotlist(file: string, lineNumber: number): boolean {
  return this.settings.hotlist.some(
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
git commit -m "feat: add hotlist management methods to sphere view"
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

          // Show visual indicator if already on hotlist
          if (this.isOnHotlist(project.file, lineNumber)) {
            item.addClass("flow-gtd-hotlist-indicator");
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

      // Show visual indicator if already on hotlist
      if (this.isOnHotlist(nextActionsFile, lineNumber)) {
        item.addClass("flow-gtd-hotlist-indicator");
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

## Task 9: Register hotlist view and commands in main.ts

**Files:**

- Modify: `main.ts`

**Step 1: Write test for command registration**

Add to relevant test file or create new test:

```typescript
// This would normally go in a main.test.ts or integration test
// For now, we'll test manually
```

**Step 2: Import HotlistView in main.ts**

At the top of `main.ts`, add:

```typescript
import { HotlistView, HOTLIST_VIEW_TYPE } from "./hotlist-view";
```

**Step 3: Register hotlist view type in onload**

In the `onload()` method of `main.ts`, add:

```typescript
async onload() {
  await this.loadSettings();

  // Register hotlist view
  this.registerView(
    HOTLIST_VIEW_TYPE,
    (leaf) => new HotlistView(leaf, this.settings)
  );

  // ... existing code
}
```

**Step 4: Add command to open hotlist view**

In the `onload()` method, add:

```typescript
this.addCommand({
  id: "open-hotlist",
  name: "Open Hotlist",
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
  const leaves = workspace.getLeavesOfType(HOTLIST_VIEW_TYPE);

  if (leaves.length > 0) {
    // View already exists, reveal it
    leaf = leaves[0];
  } else {
    // Create new leaf in right sidebar
    leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: HOTLIST_VIEW_TYPE,
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
this.addRibbonIcon("list-checks", "Open Hotlist", () => {
  this.activateHotlistView();
});
```

**Step 7: Test manually by building and loading in Obsidian**

Run: `npm run build`

**Step 8: Commit**

```bash
git add main.ts
git commit -m "feat: register hotlist view and commands"
```

---

## Task 10: Add CSS styling for hotlist and planning mode

**Files:**

- Create: `styles/hotlist.css` (or modify existing styles.css)

**Step 1: Create CSS for hotlist view**

```css
/* Hotlist View Styles */
.flow-gtd-hotlist-view {
  padding: 1rem;
}

.flow-gtd-hotlist-title {
  margin-bottom: 1rem;
}

.flow-gtd-hotlist-empty {
  color: var(--text-muted);
  font-style: italic;
  padding: 1rem;
}

.flow-gtd-hotlist-section {
  margin-bottom: 2rem;
}

.flow-gtd-hotlist-section-title {
  font-size: 1.2em;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 0.25rem;
}

.flow-gtd-hotlist-file-section,
.flow-gtd-hotlist-sphere-section {
  margin-bottom: 1rem;
}

.flow-gtd-hotlist-file-header,
.flow-gtd-hotlist-sphere-header {
  font-size: 1em;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-accent);
}

.flow-gtd-hotlist-file-link {
  color: var(--text-accent);
  text-decoration: none;
}

.flow-gtd-hotlist-file-link:hover {
  text-decoration: underline;
}

.flow-gtd-hotlist-items {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.flow-gtd-hotlist-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  background: var(--background-secondary);
}

.flow-gtd-hotlist-item:hover {
  background: var(--background-secondary-alt);
}

.flow-gtd-hotlist-item-text {
  flex: 1;
  cursor: pointer;
}

.flow-gtd-hotlist-item-actions {
  display: flex;
  gap: 0.25rem;
}

.flow-gtd-hotlist-action-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
}

.flow-gtd-hotlist-action-btn:hover {
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

.flow-gtd-hotlist-indicator {
  background: var(--background-modifier-success);
  font-weight: 600;
}

.flow-gtd-hotlist-indicator::before {
  content: "✓ ";
  color: var(--text-success);
}
```

**Step 2: Test manually by loading in Obsidian**

**Step 3: Commit**

```bash
git add styles/hotlist.css
git commit -m "feat: add CSS styling for hotlist and planning mode"
```

---

## Task 11: Fix line number detection for accurate hotlist references

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
// ABOUTME: Used when adding actions to hotlist to get accurate line references.

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
git commit -m "feat: add accurate line number detection for hotlist items"
```

---

## Task 12: Add comprehensive integration tests

**Files:**

- Create: `tests/hotlist-integration.test.ts`

**Step 1: Write integration test**

```typescript
// tests/hotlist-integration.test.ts
import { HotlistView } from "../src/hotlist-view";
import { SphereView } from "../src/sphere-view";
import { HotlistValidator } from "../src/hotlist-validator";
import { ActionLineFinder } from "../src/action-line-finder";
import { PluginSettings, HotlistItem } from "../src/types";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("Hotlist Integration", () => {
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
      hotlist: [],
    };
  });

  it("should add action to hotlist and validate it", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );

    // Find the line
    const finder = new ActionLineFinder(mockApp);
    const lineResult = await finder.findActionLine("Projects/Test.md", "Test action");

    expect(lineResult.found).toBe(true);

    // Add to hotlist
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: lineResult.lineNumber!,
      lineContent: lineResult.lineContent!,
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };
    mockSettings.hotlist.push(item);

    // Validate the item
    const validator = new HotlistValidator(mockApp);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(mockSettings.hotlist).toHaveLength(1);
  });

  it("should handle line number changes after file edits", async () => {
    const item: HotlistItem = {
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

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(13);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- hotlist-integration.test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/hotlist-integration.test.ts
git commit -m "test: add comprehensive hotlist integration tests"
```

---

## Task 13: Update documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `README.md` (if exists)

**Step 1: Update CLAUDE.md with hotlist feature**

Add to the "Key Capabilities" section:

```markdown
- Hotlist for curating focused set of next actions
- Planning mode in sphere view for selecting actions
- Validation and resolution when source files change
```

Add new section after "Waiting For Support":

```markdown
### Hotlist Support

The plugin supports creating a curated "hotlist" of next actions to work on:

- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files
- **HotlistValidator** (`src/hotlist-validator.ts`) - Validates and resolves hotlist items when files change
- **HotlistView** (`src/hotlist-view.ts`) - Displays hotlist in sidebar with actions grouped by project/sphere
- **SphereView Planning Mode** - Toggle planning mode to click actions and add to hotlist
- **Commands** - "Open Hotlist" command and ribbon icon
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document hotlist feature in CLAUDE.md"
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
git commit -m "test: ensure full test coverage for hotlist feature"
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
4. Click several project actions to add to hotlist
5. Click several general actions to add to hotlist
6. Verify checkmarks appear on selected actions
7. Click "Exit Planning Mode"
8. Open hotlist view from ribbon or command palette
9. Verify actions are grouped correctly (project vs general)
10. Test marking action complete (should update source file and remove from hotlist)
11. Test converting to waiting-for (should update source file and remove from hotlist)
12. Test removing from hotlist (should only remove from hotlist, not touch source)
13. Test clicking action text (should open source file at correct line)

**Step 3: Test file editing scenarios**

1. Add action to hotlist
2. Edit source file to add lines above the action
3. Reopen hotlist view
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
git commit -m "feat: complete hotlist feature implementation"
```

**Step 5: Run tests one final time**

Run: `npm test`
Expected: All tests pass

---

## Completion Checklist

- [ ] HotlistItem type and settings storage
- [ ] Hotlist validator service with comprehensive tests
- [ ] Hotlist view component with grouping
- [ ] Planning mode in sphere view
- [ ] Clickable actions in planning mode (project and general)
- [ ] Commands and ribbon icon registered
- [ ] CSS styling for hotlist and planning mode
- [ ] Accurate line number detection with ActionLineFinder
- [ ] Integration tests
- [ ] Documentation updates
- [ ] Full test coverage (80%+)
- [ ] Manual testing in Obsidian
- [ ] Code formatted and cleaned
