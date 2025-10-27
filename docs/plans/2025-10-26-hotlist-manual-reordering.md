# Focus Manual Reordering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add manual reordering capability to focus with pinned section and drag-and-drop support.

**Architecture:** Hybrid approach with pinned items at top (flat list, drag-and-drop reorderable) and unpinned items below (maintaining existing project/sphere grouping). Uses `isPinned` flag and array position for ordering.

**Tech Stack:** TypeScript, Obsidian API, HTML5 Drag-and-Drop API, Jest

---

## Task 1: Data Model - Add isPinned Property

**Files:**

- Modify: `src/types.ts:23-31`
- Test: `tests/focus-view.test.ts`

**Step 1: Write failing test for isPinned property**

Add to `tests/focus-view.test.ts` after existing FocusView tests:

```typescript
describe("FocusView - Pinned Items", () => {
  it("should filter pinned items from unpinned items", async () => {
    const settings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      focus: [
        {
          file: "Projects/Project A.md",
          lineNumber: 10,
          lineContent: "- [ ] Pinned action",
          text: "Pinned action",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now() - 2000,
          isPinned: true,
        },
        {
          file: "Projects/Project B.md",
          lineNumber: 15,
          lineContent: "- [ ] Unpinned action",
          text: "Unpinned action",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now() - 1000,
          isPinned: false,
        },
      ],
    };

    const view = new FocusView(mockLeaf, settings, saveSettingsMock);
    await view.onOpen();

    const container = view.containerEl.children[1] as HTMLElement;
    const sections = container.querySelectorAll(".flow-gtd-focus-section");

    // Should have 2 sections: Pinned and Project Actions
    expect(sections.length).toBe(2);
    expect(sections[0].querySelector("h3")?.textContent).toBe("Pinned");
    expect(sections[1].querySelector("h3")?.textContent).toBe("Project Actions");
  });

  it("should treat items without isPinned as unpinned (backward compatibility)", async () => {
    const settings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      focus: [
        {
          file: "Projects/Project A.md",
          lineNumber: 10,
          lineContent: "- [ ] Legacy action",
          text: "Legacy action",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
          // No isPinned property
        } as FocusItem,
      ],
    };

    const view = new FocusView(mockLeaf, settings, saveSettingsMock);
    await view.onOpen();

    const container = view.containerEl.children[1] as HTMLElement;
    const sections = container.querySelectorAll(".flow-gtd-focus-section");

    // Should only have Project Actions section (no pinned)
    expect(sections.length).toBe(1);
    expect(sections[0].querySelector("h3")?.textContent).toBe("Project Actions");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/.config/superpowers/worktrees/flow/focus-manual-reordering
npm test -- focus-view.test.ts
```

Expected: FAIL with type error or test failure (isPinned property doesn't exist)

**Step 3: Add isPinned property to FocusItem interface**

In `src/types.ts`, modify the `FocusItem` interface:

```typescript
export interface FocusItem {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  isGeneral: boolean; // true if from Next Actions file
  addedAt: number; // Timestamp
  isPinned?: boolean; // NEW: true if item is in pinned section
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS (TypeScript accepts the property, tests still fail because rendering not implemented)

**Step 5: Commit**

```bash
git add src/types.ts tests/focus-view.test.ts
git commit -m "feat: add isPinned property to FocusItem interface"
```

---

## Task 2: Rendering - Split and Render Pinned Section

**Files:**

- Modify: `src/focus-view.ts:103-105`, `src/focus-view.ts:237-268`
- Test: Already added in Task 1

**Step 1: Extract method for rendering grouped items**

The current `renderGroupedItems` method will be refactored to split pinned/unpinned first.

In `src/focus-view.ts`, replace the existing `renderGroupedItems` method (lines 238-268):

```typescript
private renderGroupedItems(container: HTMLElement, items: FocusItem[]) {
  // Split items into pinned and unpinned
  const pinnedItems = items.filter((item) => item.isPinned === true);
  const unpinnedItems = items.filter((item) => item.isPinned !== true);

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
}
```

**Step 2: Add renderPinnedItem stub method**

Add this method after `renderItem` (around line 380):

```typescript
private renderPinnedItem(container: HTMLElement, item: FocusItem) {
  // Temporary stub - will be implemented in Task 4
  this.renderItem(container, item);
}
```

**Step 3: Run tests to verify they pass**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS (pinned section renders, uses stub for now)

**Step 4: Commit**

```bash
git add src/focus-view.ts
git commit -m "feat: split rendering into pinned and unpinned sections"
```

---

## Task 3: Pin/Unpin Functionality

**Files:**

- Modify: `src/focus-view.ts:319-380` (renderItem method), add new methods after line 571
- Test: `tests/focus-view.test.ts`

**Step 1: Write failing test for pinItem method**

Add to `tests/focus-view.test.ts` in the "Pinned Items" describe block:

```typescript
it("should pin an unpinned item and move to end of pinned section", async () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    focus: [
      {
        file: "Projects/Project A.md",
        lineNumber: 10,
        lineContent: "- [ ] Already pinned",
        text: "Already pinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 3000,
        isPinned: true,
      },
      {
        file: "Projects/Project B.md",
        lineNumber: 15,
        lineContent: "- [ ] To be pinned",
        text: "To be pinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 2000,
        isPinned: false,
      },
      {
        file: "Projects/Project C.md",
        lineNumber: 20,
        lineContent: "- [ ] Another unpinned",
        text: "Another unpinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 1000,
        isPinned: false,
      },
    ],
  };

  const view = new FocusView(mockLeaf, settings, saveSettingsMock);

  // Pin the second item
  await (view as any).pinItem(settings.focus[1]);

  // Check isPinned flag is set
  expect(settings.focus[1].isPinned).toBe(true);

  // Check it moved to end of pinned section (index 1, after existing pinned item)
  const pinnedItems = settings.focus.filter((i) => i.isPinned);
  expect(pinnedItems.length).toBe(2);
  expect(pinnedItems[1].text).toBe("To be pinned");

  // Check saveSettings was called
  expect(saveSettingsMock).toHaveBeenCalled();
});

it("should unpin a pinned item", async () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    focus: [
      {
        file: "Projects/Project A.md",
        lineNumber: 10,
        lineContent: "- [ ] Pinned action",
        text: "Pinned action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
        isPinned: true,
      },
    ],
  };

  const view = new FocusView(mockLeaf, settings, saveSettingsMock);

  // Unpin the item
  await (view as any).unpinItem(settings.focus[0]);

  // Check isPinned flag is cleared
  expect(settings.focus[0].isPinned).toBe(false);

  // Check saveSettings was called
  expect(saveSettingsMock).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- focus-view.test.ts
```

Expected: FAIL with "pinItem is not a function"

**Step 3: Implement pinItem and unpinItem methods**

Add these methods after the `removeFromHotlist` method (around line 571):

```typescript
private async pinItem(item: FocusItem): Promise<void> {
  // Find item in settings.focus
  const index = this.settings.focus.findIndex(
    (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
  );

  if (index === -1) return;

  // Set isPinned flag
  this.settings.focus[index].isPinned = true;

  // Move to end of pinned section
  const pinnedCount = this.settings.focus.filter((i) => i.isPinned).length;
  const [pinnedItem] = this.settings.focus.splice(index, 1);
  this.settings.focus.splice(pinnedCount - 1, 0, pinnedItem);

  await this.saveSettings();
  await this.onOpen(); // Re-render
}

private async unpinItem(item: FocusItem): Promise<void> {
  const index = this.settings.focus.findIndex(
    (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
  );

  if (index === -1) return;

  // Clear isPinned flag (item stays in array, position doesn't matter for unpinned)
  this.settings.focus[index].isPinned = false;

  await this.saveSettings();
  await this.onOpen(); // Re-render
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS

**Step 5: Add pin button to unpinned items in renderItem**

In `src/focus-view.ts`, modify the `renderItem` method to add a pin button. Around line 349 (in the actionsSpan section, before the completeBtn):

```typescript
const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

// Pin button (NEW)
const pinBtn = actionsSpan.createEl("button", {
  cls: "flow-gtd-focus-action-btn",
  text: "📌",
});
pinBtn.title = "Pin to top";
pinBtn.addEventListener("click", async () => {
  await this.pinItem(item);
});

// ... existing buttons (complete, waiting, remove)
```

**Step 6: Run tests and verify still passing**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: implement pin/unpin functionality with pin button"
```

---

## Task 4: Drag-and-Drop Support

**Files:**

- Modify: `src/focus-view.ts` (renderPinnedItem method, add drag handlers)
- Test: `tests/focus-view.test.ts`

**Step 1: Write failing test for drag-and-drop reordering**

Add to `tests/focus-view.test.ts`:

```typescript
it("should reorder pinned items on drop", async () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    focus: [
      {
        file: "Projects/Project A.md",
        lineNumber: 10,
        lineContent: "- [ ] First pinned",
        text: "First pinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 3000,
        isPinned: true,
      },
      {
        file: "Projects/Project B.md",
        lineNumber: 15,
        lineContent: "- [ ] Second pinned",
        text: "Second pinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 2000,
        isPinned: true,
      },
      {
        file: "Projects/Project C.md",
        lineNumber: 20,
        lineContent: "- [ ] Third pinned",
        text: "Third pinned",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 1000,
        isPinned: true,
      },
    ],
  };

  const view = new FocusView(mockLeaf, settings, saveSettingsMock);

  // Simulate dragging third item to first position
  const draggedItem = settings.focus[2];
  const dropTarget = settings.focus[0];

  // Set up drag state
  (view as any).draggedItem = draggedItem;

  // Simulate drop event
  const mockDropEvent = {
    preventDefault: jest.fn(),
  } as unknown as DragEvent;

  await (view as any).onDrop(mockDropEvent, dropTarget);

  // Check order changed: "Third" should now be at index 0
  expect(settings.focus[0].text).toBe("Third pinned");
  expect(settings.focus[1].text).toBe("First pinned");
  expect(settings.focus[2].text).toBe("Second pinned");

  // Check all are still pinned
  expect(settings.focus[0].isPinned).toBe(true);
  expect(settings.focus[1].isPinned).toBe(true);
  expect(settings.focus[2].isPinned).toBe(true);

  // Check saveSettings was called
  expect(saveSettingsMock).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- focus-view.test.ts
```

Expected: FAIL with "onDrop is not a function"

**Step 3: Add drag state property to class**

In `src/focus-view.ts`, add after the existing private properties (around line 28):

```typescript
private draggedItem: FocusItem | null = null;
```

**Step 4: Implement drag event handlers**

Add these methods after the `unpinItem` method:

```typescript
private onDragStart(e: DragEvent, item: FocusItem): void {
  this.draggedItem = item;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
  }
  // Add dragging class to item
  const target = e.target as HTMLElement;
  target.addClass("dragging");
}

private onDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}

private async onDrop(e: DragEvent, dropTarget: FocusItem): Promise<void> {
  e.preventDefault();
  if (!this.draggedItem || this.draggedItem === dropTarget) return;

  // Find indices in settings.focus
  const draggedIndex = this.settings.focus.findIndex(
    (i) =>
      i.file === this.draggedItem!.file &&
      i.lineNumber === this.draggedItem!.lineNumber &&
      i.addedAt === this.draggedItem!.addedAt
  );
  const targetIndex = this.settings.focus.findIndex(
    (i) =>
      i.file === dropTarget.file &&
      i.lineNumber === dropTarget.lineNumber &&
      i.addedAt === dropTarget.addedAt
  );

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Remove dragged item and insert at target position
  const [item] = this.settings.focus.splice(draggedIndex, 1);
  this.settings.focus.splice(targetIndex, 0, item);

  await this.saveSettings();
  await this.onOpen(); // Re-render
}

private onDragEnd(e: DragEvent): void {
  this.draggedItem = null;
  // Remove dragging class
  const target = e.target as HTMLElement;
  target.removeClass("dragging");
}
```

**Step 5: Update renderPinnedItem to add drag support**

Replace the stub `renderPinnedItem` method with:

```typescript
private renderPinnedItem(container: HTMLElement, item: FocusItem) {
  const itemEl = container.createEl("li", {
    cls: "flow-gtd-focus-item flow-gtd-focus-pinned-item",
    attr: { draggable: "true" },
  });

  // Drag handle
  const dragHandle = itemEl.createSpan({ cls: "flow-gtd-focus-drag-handle" });
  setIcon(dragHandle, "grip-vertical");

  // Pin icon indicator
  itemEl.createSpan({ text: "📌 ", cls: "flow-gtd-focus-pin-indicator" });

  // Drag event handlers
  itemEl.addEventListener("dragstart", (e) => this.onDragStart(e, item));
  itemEl.addEventListener("dragover", (e) => this.onDragOver(e));
  itemEl.addEventListener("drop", (e) => this.onDrop(e, item));
  itemEl.addEventListener("dragend", (e) => this.onDragEnd(e));

  // Check if this is a waiting-for item
  const checkboxStatus = this.extractCheckboxStatus(item.lineContent);
  const isWaitingFor = checkboxStatus.toLowerCase() === "w";

  // Add clock emoji for waiting-for items (outside the item box)
  if (isWaitingFor) {
    const clockSpan = itemEl.createSpan({
      cls: "flow-gtd-focus-waiting-indicator",
      text: "🕐 ",
    });
    clockSpan.style.marginRight = "8px";
  }

  const textSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-text" });
  textSpan.setText(item.text);
  textSpan.style.cursor = "pointer";

  // Gray out waiting-for items
  if (isWaitingFor) {
    textSpan.style.opacity = "0.6";
    textSpan.style.fontStyle = "italic";
  }

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

  // Only show "Convert to waiting for" button for non-waiting items
  if (!isWaitingFor) {
    const waitingBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "⏸",
    });
    waitingBtn.title = "Convert to waiting for";
    waitingBtn.addEventListener("click", async () => {
      await this.convertToWaitingFor(item);
    });
  }

  const removeBtn = actionsSpan.createEl("button", {
    cls: "flow-gtd-focus-action-btn",
    text: "🗑️",
  });
  removeBtn.title = "Remove from focus";
  removeBtn.addEventListener("click", async () => {
    await this.removeFromHotlist(item);
  });

  // Unpin button
  const unpinBtn = actionsSpan.createEl("button", {
    cls: "flow-gtd-focus-action-btn",
    text: "📌",
  });
  unpinBtn.title = "Unpin";
  unpinBtn.addEventListener("click", async () => {
    await this.unpinItem(item);
  });
}
```

**Step 6: Run test to verify it passes**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/focus-view.ts tests/focus-view.test.ts
git commit -m "feat: implement drag-and-drop reordering for pinned items"
```

---

## Task 5: CSS Styling

**Files:**

- Modify: `styles.css`

**Step 1: Add CSS for pinned section and drag-and-drop**

Add to `styles.css` at the end of the file:

```css
/* Pinned section styling */
.flow-gtd-focus-pinned-items {
  background: var(--background-primary-alt);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

/* Drag handle - hidden by default, visible on hover */
.flow-gtd-focus-drag-handle {
  opacity: 0.3;
  cursor: grab;
  margin-right: 8px;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
}

.flow-gtd-focus-pinned-item:hover .flow-gtd-focus-drag-handle {
  opacity: 0.7;
}

.flow-gtd-focus-drag-handle:active {
  cursor: grabbing;
}

/* Dragging state */
.flow-gtd-focus-item.dragging {
  opacity: 0.5;
}

.flow-gtd-focus-item.drag-over {
  border-top: 2px solid var(--interactive-accent);
}

/* Pin indicator */
.flow-gtd-focus-pin-indicator {
  margin-right: 4px;
}
```

**Step 2: Manual testing**

Build and test in Obsidian:

```bash
npm run build
```

Then in Obsidian:

1. Open focus view
2. Pin some items (should appear in "Pinned" section)
3. Hover over pinned items (drag handle should appear)
4. Drag items to reorder (should see visual feedback)
5. Unpin items (should move back to project/general sections)

**Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add CSS for pinned section and drag-and-drop"
```

---

## Task 6: Edge Case - Planning Mode Integration

**Files:**

- Modify: `src/sphere-view.ts` (verify new items added as unpinned)
- Test: `tests/sphere-view.test.ts`

**Step 1: Write test for planning mode adding unpinned items**

Add to `tests/sphere-view.test.ts`:

```typescript
it("should add items from planning mode as unpinned by default", async () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    focus: [],
  };

  // Mock the necessary infrastructure
  const view = new SphereView(mockLeaf, "work", settings, saveSettingsMock);

  // Simulate adding action via planning mode
  const action = "Test action";
  const file = "Projects/Test.md";
  const lineNumber = 10;

  await (view as any).addToHotlist(action, file, lineNumber, "work", false);

  // Check item was added with isPinned: false (or undefined, which is treated as false)
  expect(settings.focus.length).toBe(1);
  expect(settings.focus[0].isPinned).toBeFalsy();
  expect(settings.focus[0].text).toBe(action);
});
```

**Step 2: Run test to verify current behavior**

```bash
npm test -- sphere-view.test.ts
```

Expected: Should PASS if `addToHotlist` doesn't set `isPinned` (defaults to undefined/false)

**Step 3: Review sphere-view.ts addToHotlist method**

Check `src/sphere-view.ts` for the `addToHotlist` method. Verify it doesn't set `isPinned: true`. The method should create items like:

```typescript
const newItem: FocusItem = {
  file,
  lineNumber,
  lineContent,
  text: action,
  sphere,
  isGeneral,
  addedAt: Date.now(),
  // isPinned intentionally omitted (defaults to undefined/false)
};
```

If it already doesn't set `isPinned`, no code changes needed.

**Step 4: Run tests to verify**

```bash
npm test -- sphere-view.test.ts
```

Expected: PASS

**Step 5: Commit (if any changes made)**

```bash
git add src/sphere-view.ts tests/sphere-view.test.ts
git commit -m "test: verify planning mode adds unpinned items by default"
```

---

## Task 7: Edge Case - Validation Preserves Pin State

**Files:**

- Modify: `src/focus-view.ts:148-183` (refresh method)
- Test: `tests/focus-view.test.ts`

**Step 1: Write test for validation preserving pin state**

Add to `tests/focus-view.test.ts`:

```typescript
it("should preserve isPinned state when validating and updating line numbers", async () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    focus: [
      {
        file: "Projects/Project A.md",
        lineNumber: 10,
        lineContent: "- [ ] Pinned action",
        text: "Pinned action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
        isPinned: true,
      },
    ],
  };

  // Mock validator to return updated line number
  const mockValidator = {
    validateItem: jest.fn().mockResolvedValue({
      found: true,
      updatedLineNumber: 15, // Line moved
    }),
  };

  const view = new FocusView(mockLeaf, settings, saveSettingsMock);
  (view as any).validator = mockValidator;

  // Mock file read
  mockApp.vault.read = jest.fn().mockResolvedValue("- [ ] Pinned action");

  await (view as any).refresh();

  // Check isPinned state is preserved
  expect(settings.focus[0].isPinned).toBe(true);
  expect(settings.focus[0].lineNumber).toBe(15);
});
```

**Step 2: Run test to verify current behavior**

```bash
npm test -- focus-view.test.ts
```

Expected: Should PASS if refresh already preserves all properties

**Step 3: Review refresh method in focus-view.ts**

Check the `refresh` method (around line 148-183). Verify the line that updates items:

```typescript
if (validation.updatedLineNumber && validation.updatedLineNumber !== item.lineNumber) {
  // Update line number if it moved
  validatedItems.push({ ...item, lineNumber: validation.updatedLineNumber });
  needsSettingsSave = true;
} else {
  validatedItems.push(item);
}
```

This already uses spread operator `{ ...item, ... }` which preserves all properties including `isPinned`. No changes needed.

**Step 4: Run tests to verify**

```bash
npm test -- focus-view.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/focus-view.test.ts
git commit -m "test: verify validation preserves isPinned state"
```

---

## Task 8: Integration Testing

**Files:**

- Test: `tests/focus-integration.test.ts`

**Step 1: Write end-to-end integration test**

Add to `tests/focus-integration.test.ts`:

```typescript
describe("Focus Manual Reordering Integration", () => {
  it("should support full pin/reorder/unpin workflow", async () => {
    const settings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      focus: [
        {
          file: "Projects/Project A.md",
          lineNumber: 10,
          lineContent: "- [ ] Action A",
          text: "Action A",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now() - 3000,
          isPinned: false,
        },
        {
          file: "Projects/Project B.md",
          lineNumber: 15,
          lineContent: "- [ ] Action B",
          text: "Action B",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now() - 2000,
          isPinned: false,
        },
        {
          file: "Projects/Project C.md",
          lineNumber: 20,
          lineContent: "- [ ] Action C",
          text: "Action C",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now() - 1000,
          isPinned: false,
        },
      ],
    };

    const view = new FocusView(mockLeaf, settings, saveSettingsMock);
    await view.onOpen();

    // Step 1: Pin first item
    await (view as any).pinItem(settings.focus[0]);
    expect(settings.focus[0].isPinned).toBe(true);

    // Step 2: Pin third item
    await (view as any).pinItem(settings.focus[2]);
    expect(settings.focus[1].isPinned).toBe(true);
    expect(settings.focus[1].text).toBe("Action C");

    // Step 3: Reorder pinned items (swap them)
    (view as any).draggedItem = settings.focus[1]; // Action C
    const mockDropEvent = { preventDefault: jest.fn() } as unknown as DragEvent;
    await (view as any).onDrop(mockDropEvent, settings.focus[0]); // Drop on Action A

    // Check order: C should now be first
    expect(settings.focus[0].text).toBe("Action C");
    expect(settings.focus[1].text).toBe("Action A");

    // Step 4: Unpin first item (Action C)
    await (view as any).unpinItem(settings.focus[0]);
    expect(settings.focus[0].isPinned).toBe(false);

    // Check only Action A is still pinned
    const pinnedItems = settings.focus.filter((i) => i.isPinned);
    expect(pinnedItems.length).toBe(1);
    expect(pinnedItems[0].text).toBe("Action A");
  });
});
```

**Step 2: Run test to verify**

```bash
npm test -- focus-integration.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add tests/focus-integration.test.ts
git commit -m "test: add end-to-end integration test for pin/reorder/unpin workflow"
```

---

## Task 9: Run Full Test Suite and Build

**Files:**

- All test files

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests PASS (536+ tests)

**Step 2: Check test coverage**

```bash
npm run test:coverage
```

Expected: Coverage meets thresholds (80%+ for all metrics)

**Step 3: Build for production**

```bash
npm run build
```

Expected: Clean build, no TypeScript errors

**Step 4: Commit if any fixes were needed**

```bash
git add .
git commit -m "fix: address any issues found in full test suite"
```

---

## Task 10: Update Documentation

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with new feature description**

In `CLAUDE.md`, find the "### Focus Support" section and update it:

```markdown
### Focus Support

The plugin supports creating a curated "focus" of next actions to work on:

- **Manual Reordering** - Pin items to a "Pinned" section at the top and reorder via drag-and-drop
- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files by searching for checkbox patterns
- **FocusValidator** (`src/focus-validator.ts`) - Validates and resolves focus items when files change, searches for moved lines
- **FocusView** (`src/focus-view.ts`) - Displays focus in right sidebar with actions grouped by project/sphere
- **FocusEditorMenu** (`src/focus-editor-menu.ts`) - Right-click context menu for adding/removing actions from focus
- **SphereView Planning Mode** - Toggle planning mode to click actions and add/remove from focus
- **Commands** - "Open Focus" command (`open-focus`) and ribbon icon with `list-checks` icon
- **Focus Item Actions** - Mark complete, convert to waiting-for, pin/unpin, or remove from focus
- **File Navigation** - Click action text to open source file at correct line in split pane

**Workflow:**

1. **Via Sphere View (Planning Mode):**
   - Open a sphere view (work, personal, etc.)
   - Click "Planning Mode" button to enter planning mode
   - Click next actions from projects or general actions to add them to the focus
   - Selected actions show visual indicator (checkmark)
   - Exit planning mode when done selecting

2. **Via Context Menu (Direct from Files):**
   - Right-click on any checkbox line in a project or next actions file
   - Select "Add to Focus" or "Remove from Focus" from context menu
   - Sphere is automatically determined from project tags or inline #sphere/X tags

3. **Using the Focus:**
   - Open focus view to see curated list of actions
   - Pin important items to "Pinned" section at top
   - Drag-and-drop to reorder pinned items
   - Work through focus, marking complete or converting to waiting-for
   - Unpin items when priorities change

**Storage:**

Focus items are stored in plugin settings as `FocusItem[]` with:

- `file`: Source file path
- `lineNumber`: Last known line number
- `lineContent`: Full line content for exact matching
- `text`: Display text (action without checkbox)
- `sphere`: Which sphere the action belongs to
- `isGeneral`: Whether from Next Actions file vs project file
- `addedAt`: Timestamp for ordering
- `isPinned`: Whether item is pinned to top section (optional, defaults to false)

**Pinned Item Ordering:**

Pinned items appear at the front of the `focus` array in their display order. Array position determines rendering order for pinned items. Unpinned items follow in the array but are rendered using project/sphere grouping regardless of array position.
```

**Step 2: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with manual reordering feature"
```

---

## Task 11: Final Verification and Cleanup

**Files:**

- All files

**Step 1: Run format check**

```bash
npm run format:check
```

Expected: All files properly formatted

If not:

```bash
npm run format
git add .
git commit -m "style: apply code formatting"
```

**Step 2: Manual testing checklist**

Build and load in Obsidian:

```bash
npm run build
```

Test in Obsidian:

- [ ] Pin items from different sections (Project Actions, General Actions)
- [ ] Verify pinned items appear in "Pinned" section
- [ ] Drag handle appears on hover
- [ ] Drag-and-drop reordering works
- [ ] Visual feedback during drag (dimmed item, drop indicator)
- [ ] Unpin button works
- [ ] Unpinned items return to correct grouped sections
- [ ] Planning mode still adds items as unpinned
- [ ] Validation preserves pin state when lines move
- [ ] Pin state persists across Obsidian restarts
- [ ] Waiting-for items can be pinned/unpinned
- [ ] Empty pinned section doesn't show header

**Step 3: Git status check**

```bash
git status
```

Expected: Clean working directory, all changes committed

**Step 4: Push branch**

```bash
git push -u origin feature/focus-manual-reordering
```

---

## Completion Checklist

- [ ] Task 1: Data model changes (isPinned property)
- [ ] Task 2: Rendering split (pinned/unpinned sections)
- [ ] Task 3: Pin/unpin functionality
- [ ] Task 4: Drag-and-drop support
- [ ] Task 5: CSS styling
- [ ] Task 6: Planning mode integration verified
- [ ] Task 7: Validation preserves pin state verified
- [ ] Task 8: Integration testing
- [ ] Task 9: Full test suite passes
- [ ] Task 10: Documentation updated
- [ ] Task 11: Final verification and cleanup
- [ ] All tests passing (536+ tests)
- [ ] Code formatted
- [ ] Branch pushed to origin

## Next Steps

After implementation:

1. Use `superpowers:finishing-a-development-branch` to decide merge strategy
2. Create PR or merge to main
3. Test in production Obsidian vault
4. Consider follow-up enhancements (bulk pin/unpin, keyboard shortcuts, etc.)
