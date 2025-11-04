# Completed Focus Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible "Completed Today" section at the bottom of the focus panel showing actions marked complete since midnight.

**Architecture:** Extend FocusItem with completedAt timestamp, filter items by completion state, render completed items in separate collapsible section with cleanup at midnight.

**Tech Stack:** TypeScript, Obsidian API, Jest

---

## Task 1: Extend FocusItem interface with completedAt field

**Files:**

- Modify: `src/types.ts:36-45`

**Step 1: Write the failing test**

```typescript
// tests/types.test.ts (add to existing tests)
describe("FocusItem", () => {
  it("should support optional completedAt timestamp", () => {
    const item: FocusItem = {
      file: "test.md",
      lineNumber: 1,
      lineContent: "- [ ] test",
      text: "test",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
      completedAt: Date.now(), // NEW field
    };
    expect(item.completedAt).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- types.test`
Expected: Type error - completedAt doesn't exist on FocusItem

**Step 3: Add completedAt field to interface**

```typescript
// src/types.ts:36-45
export interface FocusItem {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  isGeneral: boolean; // true if from Next Actions file
  addedAt: number; // Timestamp
  isPinned?: boolean; // true if item is in pinned section
  completedAt?: number; // NEW: Timestamp when marked complete
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- types.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add completedAt field to FocusItem interface"
```

---

## Task 2: Add completedTodaySectionCollapsed setting

**Files:**

- Modify: `src/types.ts` (PluginSettings interface)
- Modify: `src/settings-tab.ts` (default settings)

**Step 1: Write the failing test**

```typescript
// tests/main.test.ts (add to existing settings tests)
it("should include completedTodaySectionCollapsed in default settings", () => {
  const settings = DEFAULT_SETTINGS;
  expect(settings.completedTodaySectionCollapsed).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- main.test`
Expected: FAIL - property doesn't exist

**Step 3: Add setting to PluginSettings interface**

Find the PluginSettings interface in `src/types.ts` and add:

```typescript
completedTodaySectionCollapsed: boolean; // true = collapsed by default
```

**Step 4: Add to default settings**

In `src/settings-tab.ts`, find `DEFAULT_SETTINGS` and add:

```typescript
completedTodaySectionCollapsed: true,
```

**Step 5: Run test to verify it passes**

Run: `npm test -- main.test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types.ts src/settings-tab.ts tests/main.test.ts
git commit -m "feat: add completedTodaySectionCollapsed setting"
```

---

## Task 3: Modify markItemComplete to set completedAt instead of removing

**Files:**

- Modify: `src/focus-view.ts:671-698`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts (add new test)
describe("markItemComplete", () => {
  it("should set completedAt timestamp instead of removing from focus", async () => {
    const mockItem: FocusItem = {
      file: "test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    mockVault.read.mockResolvedValue("line1\nline2\nline3\nline4\n- [ ] Test action\nline6");

    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = [mockItem];

    await (view as any).markItemComplete(mockItem);

    const items = (view as any).focusItems;
    expect(items.length).toBe(1);
    expect(items[0].completedAt).toBeDefined();
    expect(items[0].completedAt).toBeGreaterThan(Date.now() - 1000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - item gets removed instead of marked complete

**Step 3: Modify markItemComplete implementation**

```typescript
// src/focus-view.ts:671-698
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
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    // Replace checkbox with [x] and add completion date
    lines[lineIndex] = lines[lineIndex].replace(/\[(?: |w)\]/i, "[x]") + ` ✅ ${dateStr}`;

    await this.app.vault.modify(file, lines.join("\n"));

    // Set completedAt instead of removing from focus
    const focusIndex = this.focusItems.findIndex(
      (i) =>
        i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
    );

    if (focusIndex !== -1) {
      this.focusItems[focusIndex].completedAt = Date.now();
      await this.saveFocus();
      await this.refreshSphereViews();
      await this.onOpen(); // Re-render
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: mark items complete with timestamp instead of removing"
```

---

## Task 4: Add midnight timestamp calculation utility

**Files:**

- Modify: `src/focus-view.ts` (add private method)
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts (add new test)
describe("getMidnightTimestamp", () => {
  it("should return today's midnight timestamp", () => {
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    const midnight = (view as any).getMidnightTimestamp();

    const expected = new Date();
    expected.setHours(0, 0, 0, 0);

    expect(midnight).toBe(expected.getTime());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - method doesn't exist

**Step 3: Add getMidnightTimestamp method**

Add after the `extractCheckboxStatus` method in `src/focus-view.ts`:

```typescript
private getMidnightTimestamp(): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: add getMidnightTimestamp utility method"
```

---

## Task 5: Add method to filter completed today items

**Files:**

- Modify: `src/focus-view.ts`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("getCompletedTodayItems", () => {
  it("should return items completed since midnight", () => {
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const midnightTimestamp = midnight.getTime();

    const items: FocusItem[] = [
      { ...createMockFocusItem(), completedAt: now }, // Today
      { ...createMockFocusItem(), completedAt: midnightTimestamp + 1000 }, // Today
      { ...createMockFocusItem(), completedAt: midnightTimestamp - 1000 }, // Yesterday
      { ...createMockFocusItem() }, // Not completed
    ];

    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = items;

    const completed = (view as any).getCompletedTodayItems();

    expect(completed.length).toBe(2);
    expect(completed[0].completedAt).toBeGreaterThanOrEqual(midnightTimestamp);
    expect(completed[1].completedAt).toBeGreaterThanOrEqual(midnightTimestamp);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - method doesn't exist

**Step 3: Add getCompletedTodayItems method**

Add after `getMidnightTimestamp` in `src/focus-view.ts`:

```typescript
private getCompletedTodayItems(): FocusItem[] {
  const midnight = this.getMidnightTimestamp();
  return this.focusItems.filter(
    item => item.completedAt && item.completedAt >= midnight
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: add getCompletedTodayItems filter method"
```

---

## Task 6: Add cleanup of old completed items in refresh

**Files:**

- Modify: `src/focus-view.ts:148-230`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("refresh with old completed items", () => {
  it("should remove items completed before midnight", async () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const midnightTimestamp = midnight.getTime();

    const items: FocusItem[] = [
      { ...createMockFocusItem(), file: "active.md", completedAt: undefined },
      { ...createMockFocusItem(), file: "today.md", completedAt: midnightTimestamp + 1000 },
      { ...createMockFocusItem(), file: "yesterday.md", completedAt: midnightTimestamp - 1000 },
    ];

    mockVault.read.mockResolvedValue("- [ ] test");

    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = items;

    await (view as any).refresh();

    const remaining = (view as any).focusItems;
    expect(remaining.length).toBe(2);
    expect(remaining.find((i: FocusItem) => i.file === "yesterday.md")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - old items not removed

**Step 3: Add cleanup logic to refresh method**

At the start of the `refresh()` method in `src/focus-view.ts:148-230`, add cleanup before validation:

```typescript
private async refresh() {
  // Prevent concurrent refreshes
  if (this.isRefreshing) {
    return;
  }

  this.isRefreshing = true;

  try {
    // Reload focus items from file to pick up changes from other views
    await this.loadFocus();

    // Clean up old completed items (before midnight)
    const midnight = this.getMidnightTimestamp();
    this.focusItems = this.focusItems.filter(
      item => !item.completedAt || item.completedAt >= midnight
    );

    // Validate all remaining active items (skip completed items)
    const activeItems = this.focusItems.filter(item => !item.completedAt);
    const validatedItems: FocusItem[] = [...this.focusItems.filter(item => item.completedAt)];
    let needsSave = false;

    for (const item of activeItems) {
      const validation = await this.validator.validateItem(item);

      if (!validation.found) {
        // Item no longer exists or line content changed significantly
        needsSave = true;
        continue;
      }

      // Check if item was marked as complete
      const file = this.app.vault.getAbstractFileByPath(item.file);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        const lines = content.split(/\r?\n/);
        const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

        if (lineIndex >= 0 && lineIndex < lines.length) {
          const line = lines[lineIndex];
          // If marked as complete [x], remove from focus
          // Note: We keep waiting-for [w] items in the focus
          if (line.match(/\[x\]/i)) {
            needsSave = true;
            continue;
          }
        }
      }

      // Item is still valid and not complete
      if (validation.updatedLineNumber && validation.updatedLineNumber !== item.lineNumber) {
        // Update line number if it moved
        validatedItems.push({ ...item, lineNumber: validation.updatedLineNumber });
        needsSave = true;
      } else {
        validatedItems.push(item);
      }
    }

    // Update focus if any items were removed or updated
    if (needsSave) {
      this.focusItems = validatedItems;
      await this.saveFocus();
    }

    // Re-render the view
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-focus-view");

    const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
    titleEl.setText("Focus");

    // Show clear notification if applicable
    if (this.shouldShowClearNotification()) {
      this.renderClearNotification(container as HTMLElement);
    }

    if (validatedItems.length === 0) {
      this.renderEmptyMessage(container as HTMLElement);
    } else {
      this.renderGroupedItems(container as HTMLElement, validatedItems);
    }
  } catch (error) {
    console.error("Failed to refresh focus view", error);
  } finally {
    this.isRefreshing = false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: clean up completed items older than midnight on refresh"
```

---

## Task 7: Add cleanup of old completed items in onOpen

**Files:**

- Modify: `src/focus-view.ts:65-110`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("onOpen with old completed items", () => {
  it("should remove items completed before midnight on view open", async () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const midnightTimestamp = midnight.getTime();

    const items: FocusItem[] = [
      { ...createMockFocusItem(), file: "active.md" },
      { ...createMockFocusItem(), file: "today.md", completedAt: midnightTimestamp + 1000 },
      { ...createMockFocusItem(), file: "yesterday.md", completedAt: midnightTimestamp - 1000 },
    ];

    // Mock loadFocusItems to return test items
    jest.spyOn(require("../src/focus-persistence"), "loadFocusItems").mockResolvedValue(items);

    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    await view.onOpen();

    const remaining = (view as any).focusItems;
    expect(remaining.length).toBe(2);
    expect(remaining.find((i: FocusItem) => i.file === "yesterday.md")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - old items not removed on open

**Step 3: Add cleanup logic after loadFocus in onOpen**

In `src/focus-view.ts:65-110`, add cleanup after `await this.loadFocus()`:

```typescript
async onOpen() {
  const container = this.containerEl.children[1];
  container.empty();
  container.addClass("flow-gtd-focus-view");

  // Show loading state immediately
  this.renderLoadingState(container as HTMLElement);

  // Load focus items from file
  await this.loadFocus();

  // Clean up old completed items (before midnight)
  const midnight = this.getMidnightTimestamp();
  const originalLength = this.focusItems.length;
  this.focusItems = this.focusItems.filter(
    item => !item.completedAt || item.completedAt >= midnight
  );

  // Save if any items were removed
  if (this.focusItems.length < originalLength) {
    await this.saveFocus();
  }

  // Load all projects for parent context
  this.allProjects = await this.scanner.scanProjects();

  // Register event listener for metadata cache changes (fires after file is indexed)
  this.modifyEventRef = this.app.metadataCache.on("changed", (file) => {
    // Check if file has list items (tasks) that might be focus items
    const cache = this.app.metadataCache.getFileCache(file);
    if (cache?.listItems && cache.listItems.length > 0) {
      // Check if this file contains any focus items
      const hasFocusItems = this.focusItems.some((item) => item.file === file.path);
      if (hasFocusItems) {
        this.scheduleRefresh();
      }
    }
  });

  // Clear container and render actual content
  container.empty();
  container.addClass("flow-gtd-focus-view");

  const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
  titleEl.setText("Focus");

  // Show clear notification if applicable
  if (this.shouldShowClearNotification()) {
    this.renderClearNotification(container as HTMLElement);
  }

  if (this.focusItems.length === 0) {
    this.renderEmptyMessage(container as HTMLElement);
    return;
  }

  this.renderGroupedItems(container as HTMLElement, this.focusItems);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: clean up old completed items on view open"
```

---

## Task 8: Create renderCompletedItem method

**Files:**

- Modify: `src/focus-view.ts`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("renderCompletedItem", () => {
  it("should render completed item with strikethrough and no actions", () => {
    const mockItem: FocusItem = {
      file: "test.md",
      lineNumber: 5,
      lineContent: "- [x] Test action ✅ 2025-11-04",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
      completedAt: Date.now(),
    };

    const container = document.createElement("ul");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);

    (view as any).renderCompletedItem(container, mockItem);

    const itemEl = container.querySelector(".flow-gtd-focus-completed");
    expect(itemEl).toBeTruthy();

    const textEl = itemEl?.querySelector(".flow-gtd-focus-item-text") as HTMLElement;
    expect(textEl?.style.textDecoration).toBe("line-through");
    expect(textEl?.style.opacity).toBe("0.6");

    // Should have checkmark indicator
    const indicator = itemEl?.querySelector(".flow-gtd-focus-completed-indicator");
    expect(indicator?.textContent).toBe("✅ ");

    // Should NOT have action buttons
    const actions = itemEl?.querySelector(".flow-gtd-focus-item-actions");
    expect(actions).toBeFalsy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - method doesn't exist

**Step 3: Add renderCompletedItem method**

Add after the `renderItem` method in `src/focus-view.ts`:

```typescript
private renderCompletedItem(container: HTMLElement, item: FocusItem) {
  const itemEl = container.createEl("li", { cls: "flow-gtd-focus-item flow-gtd-focus-completed" });

  // Add checkmark indicator
  itemEl.createSpan({
    cls: "flow-gtd-focus-completed-indicator",
    text: "✅ ",
  });

  const textSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-text" });
  textSpan.setText(item.text);
  textSpan.style.cursor = "pointer";
  textSpan.style.textDecoration = "line-through";
  textSpan.style.opacity = "0.6";

  textSpan.addEventListener("click", () => {
    this.openFile(item.file, item.lineNumber);
  });

  // No action buttons for completed items
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: add renderCompletedItem method for completed item display"
```

---

## Task 9: Create renderCompletedTodaySection method

**Files:**

- Modify: `src/focus-view.ts`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("renderCompletedTodaySection", () => {
  it("should render collapsible section with completed items", () => {
    const completedItems: FocusItem[] = [
      {
        file: "test1.md",
        lineNumber: 5,
        lineContent: "- [x] Action 1 ✅ 2025-11-04",
        text: "Action 1",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
        completedAt: Date.now(),
      },
      {
        file: "test2.md",
        lineNumber: 3,
        lineContent: "- [x] Action 2 ✅ 2025-11-04",
        text: "Action 2",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
        completedAt: Date.now(),
      },
    ];

    const container = document.createElement("div");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = completedItems;
    mockSettings.completedTodaySectionCollapsed = false;

    (view as any).renderCompletedTodaySection(container);

    // Should have section header with count
    const header = container.querySelector(".flow-gtd-focus-section-title");
    expect(header?.textContent).toContain("Completed Today (2)");

    // Should have collapse icon
    const icon = container.querySelector(".flow-gtd-focus-collapse-icon");
    expect(icon).toBeTruthy();

    // Should render items when not collapsed
    const items = container.querySelectorAll(".flow-gtd-focus-completed");
    expect(items.length).toBe(2);
  });

  it("should hide items when section is collapsed", () => {
    const completedItems: FocusItem[] = [{ ...createMockFocusItem(), completedAt: Date.now() }];

    const container = document.createElement("div");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = completedItems;
    mockSettings.completedTodaySectionCollapsed = true;

    (view as any).renderCompletedTodaySection(container);

    // Should have header but no items
    const header = container.querySelector(".flow-gtd-focus-section-title");
    expect(header).toBeTruthy();

    const items = container.querySelectorAll(".flow-gtd-focus-completed");
    expect(items.length).toBe(0);
  });

  it("should not render section when no completed items", () => {
    const container = document.createElement("div");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = [];

    (view as any).renderCompletedTodaySection(container);

    expect(container.children.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - method doesn't exist

**Step 3: Add renderCompletedTodaySection method**

Add after the `renderGroupedItems` method in `src/focus-view.ts`:

```typescript
private renderCompletedTodaySection(container: HTMLElement): void {
  const completedItems = this.getCompletedTodayItems();
  if (completedItems.length === 0) return;

  const section = container.createDiv({ cls: "flow-gtd-focus-section" });

  // Collapsible header
  const header = section.createEl("h3", {
    cls: "flow-gtd-focus-section-title flow-gtd-focus-collapsible",
  });

  const toggleIcon = header.createSpan({ cls: "flow-gtd-focus-collapse-icon" });
  setIcon(toggleIcon, this.settings.completedTodaySectionCollapsed ? "chevron-right" : "chevron-down");

  header.createSpan({ text: ` Completed Today (${completedItems.length})` });

  header.addEventListener("click", async () => {
    this.settings.completedTodaySectionCollapsed = !this.settings.completedTodaySectionCollapsed;
    await this.saveSettings();
    await this.onOpen(); // Re-render
  });

  // Content (hidden if collapsed)
  if (!this.settings.completedTodaySectionCollapsed) {
    const grouped = this.groupItems(completedItems);

    // Render project actions
    if (Object.keys(grouped.projectActions).length > 0) {
      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderCompletedFileGroup(section, filePath, grouped.projectActions[filePath]);
        });
    }

    // Render general actions
    if (Object.keys(grouped.generalActions).length > 0) {
      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderCompletedSphereGroup(section, sphere, grouped.generalActions[sphere]);
        });
    }
  }
}
```

**Step 4: Add helper methods for rendering completed groups**

Add these methods after `renderCompletedTodaySection`:

```typescript
private renderCompletedFileGroup(container: HTMLElement, filePath: string, items: FocusItem[]) {
  const fileSection = container.createDiv({ cls: "flow-gtd-focus-file-section" });

  const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-focus-file-header" });

  // Get project display name with parent context
  const displayName = getProjectDisplayName(filePath, this.allProjects);

  const fileLink = fileHeader.createEl("a", {
    text: displayName.primary,
    cls: "flow-gtd-focus-file-link",
  });
  fileLink.style.cursor = "pointer";
  fileLink.addEventListener("click", (e) => {
    e.preventDefault();
    this.openFile(filePath);
  });

  // Add parent project context if it exists
  if (displayName.parent) {
    const parentSpan = fileHeader.createSpan({
      text: ` (${displayName.parent})`,
      cls: "flow-gtd-focus-parent-context",
    });
    parentSpan.style.fontSize = "0.85em";
    parentSpan.style.opacity = "0.7";
    parentSpan.style.fontWeight = "normal";
  }

  const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
  items.forEach((item) => {
    this.renderCompletedItem(itemsList, item);
  });
}

private renderCompletedSphereGroup(container: HTMLElement, sphere: string, items: FocusItem[]) {
  const sphereSection = container.createDiv({ cls: "flow-gtd-focus-sphere-section" });

  sphereSection.createEl("h4", {
    text: `(${sphere} sphere)`,
    cls: "flow-gtd-focus-sphere-header",
  });

  const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-focus-items" });
  items.forEach((item) => {
    this.renderCompletedItem(itemsList, item);
  });
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: add renderCompletedTodaySection with collapsible UI"
```

---

## Task 10: Integrate completed section into renderGroupedItems

**Files:**

- Modify: `src/focus-view.ts:253-306`
- Modify: `tests/focus-view.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-view.test.ts
describe("renderGroupedItems with completed section", () => {
  it("should render completed section after active sections", () => {
    const items: FocusItem[] = [
      { ...createMockFocusItem(), file: "active1.md", text: "Active 1" },
      { ...createMockFocusItem(), file: "active2.md", text: "Active 2", completedAt: Date.now() },
    ];

    const container = document.createElement("div");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    mockSettings.completedTodaySectionCollapsed = false;

    (view as any).renderGroupedItems(container, items);

    // Should have both active and completed sections
    const sections = container.querySelectorAll(".flow-gtd-focus-section");
    expect(sections.length).toBeGreaterThan(0);

    // Last section should be completed
    const lastSection = sections[sections.length - 1];
    const header = lastSection.querySelector(".flow-gtd-focus-section-title");
    expect(header?.textContent).toContain("Completed Today");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-view.test`
Expected: FAIL - completed section not rendered

**Step 3: Modify renderGroupedItems to call renderCompletedTodaySection**

In `src/focus-view.ts:253-306`, modify the `renderGroupedItems` method to filter out completed items and add the completed section at the end:

```typescript
private renderGroupedItems(container: HTMLElement, items: FocusItem[]) {
  // Split items into pinned, unpinned active, and completed
  const activeItems = items.filter((item) => !item.completedAt);
  const pinnedItems = activeItems.filter((item) => item.isPinned === true);
  const unpinnedItems = activeItems.filter((item) => item.isPinned !== true);

  // Render pinned section (if any pinned items exist)
  if (pinnedItems.length > 0) {
    const pinnedSection = container.createDiv({ cls: "flow-gtd-focus-section" });
    pinnedSection.createEl("h3", {
      text: "Pinned",
      cls: "flow-gtd-focus-section-title",
    });

    const pinnedList = pinnedSection.createEl("ul", {
      cls: "flow-gtd-focus-items flow-gtd-focus-pinned-items",
    });
    pinnedItems.forEach((item) => {
      this.renderPinnedItem(pinnedList, item);
    });
  }

  // Render unpinned items with existing grouping logic
  const grouped = this.groupItems(unpinnedItems);

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

  // Completed Today section (at the end)
  this.renderCompletedTodaySection(container);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: integrate completed today section into view rendering"
```

---

## Task 11: Modify focus auto-clear to skip completed items

**Files:**

- Modify: `src/focus-auto-clear.ts`
- Modify: `tests/focus-auto-clear.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/focus-auto-clear.test.ts
describe("auto-clear with completed items", () => {
  it("should not archive completed items", async () => {
    const now = Date.now();
    const focusItems: FocusItem[] = [
      {
        file: "Projects/test.md",
        lineNumber: 5,
        lineContent: "- [ ] Active action",
        text: "Active action",
        sphere: "work",
        isGeneral: false,
        addedAt: now - 86400000,
      },
      {
        file: "Projects/test.md",
        lineNumber: 6,
        lineContent: "- [x] Completed action ✅ 2025-11-04",
        text: "Completed action",
        sphere: "work",
        isGeneral: false,
        addedAt: now - 86400000,
        completedAt: now,
      },
    ];

    saveFocusItemsMock.mockResolvedValue();
    loadFocusItemsMock.mockResolvedValue(focusItems);
    mockVault.adapter.exists.mockResolvedValue(false);
    mockVault.create.mockResolvedValue({} as TFile);

    await clearFocusAndArchive(mockVault, settings);

    // Should have created archive file
    expect(mockVault.create).toHaveBeenCalled();
    const archiveContent = mockVault.create.mock.calls[0][1] as string;

    // Archive should contain only active item
    expect(archiveContent).toContain("Active action");
    expect(archiveContent).not.toContain("Completed action");

    // Should have saved empty focus (completed item removed, active item archived)
    expect(saveFocusItemsMock).toHaveBeenCalledWith(mockVault, []);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-auto-clear.test`
Expected: FAIL - completed items being archived

**Step 3: Modify clearFocusAndArchive to filter completed items**

Find the `clearFocusAndArchive` function in `src/focus-auto-clear.ts` and modify it to filter out completed items before archiving:

```typescript
export async function clearFocusAndArchive(vault: Vault, settings: PluginSettings): Promise<void> {
  // Load current focus items
  const focusItems = await loadFocusItems(vault);

  if (focusItems.length === 0) {
    // Nothing to clear
    return;
  }

  // Separate active and completed items
  const activeItems = focusItems.filter((item) => !item.completedAt);
  const hasActiveItems = activeItems.length > 0;

  // Only archive active items (completed items are already done, no need to archive)
  if (hasActiveItems) {
    const archiveContent = buildArchiveContent(activeItems);
    const archiveFile = settings.focusArchiveFile;

    try {
      // Check if archive file exists
      const fileExists = await vault.adapter.exists(archiveFile);

      if (fileExists) {
        // Append to existing file
        const existingContent = await vault.adapter.read(archiveFile);
        await vault.adapter.write(archiveFile, existingContent + "\n\n" + archiveContent);
      } else {
        // Create new archive file
        await vault.create(archiveFile, archiveContent);
      }

      // Clear focus (both active and completed items)
      await saveFocusItems(vault, []);

      // Update settings to track successful clear
      settings.lastFocusClearTimestamp = Date.now();
      settings.lastFocusArchiveSucceeded = true;
      settings.focusClearedNotificationDismissed = false;
    } catch (error) {
      console.error("Failed to archive focus items", error);
      settings.lastFocusArchiveSucceeded = false;
      throw error;
    }
  } else {
    // Only completed items - just clear focus without archiving
    await saveFocusItems(vault, []);
    settings.lastFocusClearTimestamp = Date.now();
    settings.lastFocusArchiveSucceeded = true;
    settings.focusClearedNotificationDismissed = false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- focus-auto-clear.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/focus-auto-clear.ts tests/focus-auto-clear.test.ts
git commit -m "feat: exclude completed items from focus auto-clear archiving"
```

---

## Task 12: Add CSS styles for completed section

**Files:**

- Modify: `styles.css`

**Step 1: Add CSS for collapsible section**

Add to `styles.css`:

```css
/* Collapsible section header */
.flow-gtd-focus-collapsible {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.flow-gtd-focus-collapsible:hover {
  opacity: 0.8;
}

.flow-gtd-focus-collapse-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Completed items styling */
.flow-gtd-focus-completed {
  opacity: 0.7;
}

.flow-gtd-focus-completed .flow-gtd-focus-item-text {
  text-decoration: line-through;
  opacity: 0.6;
}

.flow-gtd-focus-completed-indicator {
  margin-right: 4px;
  flex-shrink: 0;
}
```

**Step 2: Test styles manually**

Build and test in Obsidian:

1. Run `npm run build`
2. Reload Obsidian
3. Mark some items complete
4. Verify completed section appears with proper styling
5. Test collapse/expand functionality

**Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add CSS for completed today section and collapsible UI"
```

---

## Task 13: Add integration test for complete workflow

**Files:**

- Modify: `tests/focus-integration.test.ts`

**Step 1: Write comprehensive integration test**

```typescript
// tests/focus-integration.test.ts
describe("completed focus actions workflow", () => {
  it("should complete full lifecycle: mark complete, persist, cleanup", async () => {
    // Setup: Create focus with active item
    const now = Date.now();
    const item: FocusItem = {
      file: "Projects/test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: now,
    };

    mockVault.read.mockResolvedValue("line1\nline2\nline3\nline4\n- [ ] Test action\nline6");

    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = [item];

    // Step 1: Mark item complete
    await (view as any).markItemComplete(item);

    // Verify: Item marked complete with timestamp
    let items = (view as any).focusItems;
    expect(items.length).toBe(1);
    expect(items[0].completedAt).toBeDefined();
    expect(items[0].completedAt).toBeGreaterThan(now);

    // Step 2: Refresh view (should keep item since completed today)
    await (view as any).refresh();

    items = (view as any).focusItems;
    expect(items.length).toBe(1);
    expect(items[0].completedAt).toBeDefined();

    // Step 3: Mock next day (midnight passed)
    const originalDate = Date;
    const mockDate = new Date("2025-11-05T00:00:01Z");
    global.Date = jest.fn(() => mockDate) as any;
    global.Date.now = jest.fn(() => mockDate.getTime());

    // Refresh should remove old completed item
    await (view as any).refresh();

    items = (view as any).focusItems;
    expect(items.length).toBe(0);

    // Restore Date
    global.Date = originalDate;
  });

  it("should render completed section when items completed today", async () => {
    const now = Date.now();
    const items: FocusItem[] = [
      {
        file: "active.md",
        lineNumber: 1,
        lineContent: "- [ ] Active",
        text: "Active",
        sphere: "work",
        isGeneral: false,
        addedAt: now,
      },
      {
        file: "completed.md",
        lineNumber: 2,
        lineContent: "- [x] Completed ✅ 2025-11-04",
        text: "Completed",
        sphere: "work",
        isGeneral: false,
        addedAt: now,
        completedAt: now,
      },
    ];

    const container = document.createElement("div");
    const view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).focusItems = items;
    mockSettings.completedTodaySectionCollapsed = false;

    (view as any).renderGroupedItems(container, items);

    // Should have both active and completed sections
    const completedSection = Array.from(
      container.querySelectorAll(".flow-gtd-focus-section-title")
    ).find((el) => el.textContent?.includes("Completed Today"));

    expect(completedSection).toBeTruthy();
    expect(completedSection?.textContent).toContain("(1)");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- focus-integration.test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/focus-integration.test.ts
git commit -m "test: add integration tests for completed actions workflow"
```

---

## Task 14: Update documentation

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Document new feature in CLAUDE.md**

Find the "Focus Support" section and add information about completed actions:

```markdown
### Focus Support

The plugin supports creating a curated "focus" of next actions to work on:

- **Manual Reordering** - Pin items to a "Pinned" section at the top and reorder via drag-and-drop
- **Completed Today Section** - Shows actions marked complete since midnight in a collapsible section at the bottom
- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files by searching for checkbox patterns
  ...

**Completed Actions Display:**

- Items marked complete remain in focus until midnight
- Displayed in collapsible "Completed Today" section at bottom
- Strikethrough styling with checkmark indicator
- Click to navigate to source file
- Old completions automatically removed at midnight
- Completed items excluded from auto-clear archiving
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document completed today section in CLAUDE.md"
```

---

## Task 15: Run full test suite and build

**Files:**

- None (verification step)

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass with 80%+ coverage

**Step 2: Build production bundle**

Run: `npm run build`
Expected: Build succeeds, no errors

**Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Format code**

Run: `npm run format`
Expected: Code formatted successfully

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: format code and verify build"
```

---

## Task 16: Manual testing checklist

**Manual Testing Steps:**

1. **Build and reload:**
   - Run `npm run build`
   - Copy `main.js` and `styles.css` to Obsidian vault `.obsidian/plugins/flow-gtd-coach/`
   - Reload Obsidian (Ctrl/Cmd + R)

2. **Test marking items complete:**
   - Open focus view
   - Mark an active item complete (✓ button)
   - Verify item moves to "Completed Today" section
   - Verify strikethrough styling and checkmark

3. **Test collapse/expand:**
   - Click "Completed Today" header to collapse
   - Verify items hidden, chevron points right
   - Click again to expand
   - Verify items shown, chevron points down
   - Reload Obsidian, verify state persists

4. **Test multiple completions:**
   - Mark several items complete
   - Verify count in header updates: "Completed Today (3)"
   - Verify all items shown in section

5. **Test navigation:**
   - Click completed item text
   - Verify source file opens at correct line

6. **Test midnight cleanup:**
   - Mark items complete
   - Mock system clock to next day (or wait until midnight)
   - Open focus view
   - Verify old completed items removed

7. **Test auto-clear:**
   - Add active and completed items to focus
   - Trigger auto-clear (wait for scheduled time or mock)
   - Verify only active items in archive file
   - Verify completed items not archived
   - Verify all items removed from focus

8. **Test edge cases:**
   - Mark item complete when section collapsed - verify section stays collapsed
   - Complete last active item - verify empty message shown, completed section still visible
   - Collapse section with many items - verify performance is good

**Sign-off:**

```bash
# After all manual tests pass
git tag completed-focus-actions-tested
```

---

## Completion Checklist

- [ ] Task 1: Extend FocusItem interface (completedAt field)
- [ ] Task 2: Add completedTodaySectionCollapsed setting
- [ ] Task 3: Modify markItemComplete to set timestamp
- [ ] Task 4: Add getMidnightTimestamp utility
- [ ] Task 5: Add getCompletedTodayItems filter
- [ ] Task 6: Add cleanup in refresh method
- [ ] Task 7: Add cleanup in onOpen method
- [ ] Task 8: Create renderCompletedItem method
- [ ] Task 9: Create renderCompletedTodaySection method
- [ ] Task 10: Integrate completed section into renderGroupedItems
- [ ] Task 11: Modify auto-clear to skip completed items
- [ ] Task 12: Add CSS styles
- [ ] Task 13: Add integration tests
- [ ] Task 14: Update documentation
- [ ] Task 15: Run full test suite and build
- [ ] Task 16: Manual testing

---

## Notes for Engineer

### Key Design Decisions

1. **Storage:** Completed items stay in focus array with `completedAt` timestamp until midnight - simple, reuses existing patterns
2. **Cleanup:** Happens on view open/refresh, no background timer needed
3. **Archiving:** Completed items excluded from auto-clear archives - they're already marked complete in source
4. **Collapse:** Section collapsed by default to avoid clutter, state persists in settings
5. **Validation:** Completed items skip validation - don't care if they moved/deleted

### Testing Strategy

Follow @superpowers:test-driven-development:

1. Write failing test
2. Run to verify failure
3. Implement minimal code
4. Run to verify pass
5. Commit

Every task follows this pattern - don't skip steps.

### Common Pitfalls

- **Don't forget to filter completed items in renderGroupedItems** - they should only appear in completed section
- **Don't validate completed items in refresh** - wastes time, they're already done
- **Don't archive completed items** - they're marked complete in source, no need to duplicate
- **Remember to update focusItems reference after filtering** - otherwise old items come back

### Resources

- Design doc: `docs/plans/2025-11-04-completed-focus-actions-design.md`
- Existing focus tests: `tests/focus-view.test.ts`, `tests/focus-integration.test.ts`
- Similar UI pattern: See "Pinned" section in `focus-view.ts:259-272` for collapsible sections
