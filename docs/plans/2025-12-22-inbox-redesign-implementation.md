# Inbox Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the accordion-style inbox with a responsive two-pane layout (list + detail) that's clean, scannable, and keyboard-friendly.

**Architecture:** State tracks `selectedIndex` instead of per-item `isExpanded`. Wide viewport shows horizontal split; narrow viewport shows single pane with navigation. List pane renders minimal item rows; detail pane renders all editing fields.

**Tech Stack:** TypeScript, Obsidian API, CSS (media queries for responsive)

---

## Task 1: Add Selection State to InboxModalState

**Files:**
- Modify: `src/inbox-modal-state.ts`
- Test: `tests/inbox-modal-state.test.ts`

**Step 1: Write failing test for selectedIndex**

Add to `tests/inbox-modal-state.test.ts`:

```typescript
describe("selection state", () => {
  it("should initialise selectedIndex to 0 when items loaded", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
      { content: "Item 2", file: "inbox/2.md", type: "note", startLine: 0, endLine: 1 },
    ]);

    await state.loadInboxItems();

    expect(state.selectedIndex).toBe(0);
  });

  it("should initialise selectedIndex to -1 when no items", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([]);

    await state.loadInboxItems();

    expect(state.selectedIndex).toBe(-1);
  });

  it("should update selectedIndex when selectItem called", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
      { content: "Item 2", file: "inbox/2.md", type: "note", startLine: 0, endLine: 1 },
    ]);
    await state.loadInboxItems();

    state.selectItem(1);

    expect(state.selectedIndex).toBe(1);
  });

  it("should clamp selectedIndex to valid range", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
      { content: "Item 2", file: "inbox/2.md", type: "note", startLine: 0, endLine: 1 },
    ]);
    await state.loadInboxItems();

    state.selectItem(99);
    expect(state.selectedIndex).toBe(1);

    state.selectItem(-5);
    expect(state.selectedIndex).toBe(0);
  });

  it("should return selected item via getter", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
      { content: "Item 2", file: "inbox/2.md", type: "note", startLine: 0, endLine: 1 },
    ]);
    await state.loadInboxItems();

    state.selectItem(1);

    expect(state.selectedItem?.original).toBe("Item 2");
  });

  it("should return undefined for selectedItem when no items", async () => {
    const { state } = createTestState();
    state.inboxScanner = mockInboxScanner([]);
    await state.loadInboxItems();

    expect(state.selectedItem).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-modal-state`
Expected: FAIL - `selectedIndex` property doesn't exist

**Step 3: Implement selection state**

In `src/inbox-modal-state.ts`, add:

```typescript
// Add property after existing public properties
public selectedIndex = -1;

// Add getter for convenience
get selectedItem(): EditableItem | undefined {
  if (this.selectedIndex >= 0 && this.selectedIndex < this.editableItems.length) {
    return this.editableItems[this.selectedIndex];
  }
  return undefined;
}

// Add selection method
selectItem(index: number) {
  if (this.editableItems.length === 0) {
    this.selectedIndex = -1;
    return;
  }
  this.selectedIndex = Math.max(0, Math.min(index, this.editableItems.length - 1));
  this.queueRender("editable");
}
```

Update `loadInboxItems()` - replace `this.initializeExpandedState()` with:

```typescript
this.selectedIndex = inboxEditableItems.length > 0 ? 0 : -1;
```

Update `saveAndRemoveItem()` - replace auto-expand logic with:

```typescript
// Adjust selectedIndex after removal
if (this.editableItems.length === 0) {
  this.selectedIndex = -1;
} else if (this.selectedIndex >= this.editableItems.length) {
  this.selectedIndex = this.editableItems.length - 1;
}
```

Update `discardItem()` with same selectedIndex adjustment.

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-modal-state`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-modal-state.ts tests/inbox-modal-state.test.ts
git commit -m "Add selection state tracking to InboxModalState"
```

---

## Task 2: Add View Mode State for Narrow Viewport

**Files:**
- Modify: `src/inbox-modal-state.ts`
- Test: `tests/inbox-modal-state.test.ts`

**Step 1: Write failing tests for viewMode**

Add to `tests/inbox-modal-state.test.ts`:

```typescript
describe("view mode", () => {
  it("should initialise viewMode to list", () => {
    const { state } = createTestState();
    expect(state.viewMode).toBe("list");
  });

  it("should switch to detail mode when showDetail called", () => {
    const { state } = createTestState();
    state.showDetail();
    expect(state.viewMode).toBe("detail");
  });

  it("should switch to list mode when showList called", () => {
    const { state } = createTestState();
    state.showDetail();
    state.showList();
    expect(state.viewMode).toBe("list");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-modal-state`
Expected: FAIL - `viewMode` property doesn't exist

**Step 3: Implement view mode**

In `src/inbox-modal-state.ts`:

```typescript
// Add type at top of file
export type ViewMode = "list" | "detail";

// Add property
public viewMode: ViewMode = "list";

// Add methods
showDetail() {
  this.viewMode = "detail";
  this.queueRender("editable");
}

showList() {
  this.viewMode = "list";
  this.queueRender("editable");
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-modal-state`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-modal-state.ts tests/inbox-modal-state.test.ts
git commit -m "Add viewMode state for narrow viewport navigation"
```

---

## Task 3: Add Last Used Sphere Tracking

**Files:**
- Modify: `src/inbox-modal-state.ts`
- Test: `tests/inbox-modal-state.test.ts`

**Step 1: Write failing tests for lastUsedSphere**

Add to `tests/inbox-modal-state.test.ts`:

```typescript
describe("last used sphere", () => {
  it("should initialise lastUsedSphere to first sphere from settings", () => {
    const settings = createMockSettings();
    settings.spheres = ["work", "personal"];
    const { state } = createTestState({ settings });

    expect(state.lastUsedSphere).toBe("work");
  });

  it("should initialise lastUsedSphere to undefined if no spheres", () => {
    const settings = createMockSettings();
    settings.spheres = [];
    const { state } = createTestState({ settings });

    expect(state.lastUsedSphere).toBeUndefined();
  });

  it("should update lastUsedSphere when item saved with sphere", async () => {
    const settings = createMockSettings();
    settings.spheres = ["work", "personal"];
    const { state } = createTestState({ settings });
    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
    ]);
    await state.loadInboxItems();

    state.editableItems[0].selectedSpheres = ["personal"];
    await state.saveAndRemoveItem(state.editableItems[0]);

    expect(state.lastUsedSphere).toBe("personal");
  });

  it("should apply lastUsedSphere as default to new items", async () => {
    const settings = createMockSettings();
    settings.spheres = ["work", "personal"];
    const { state } = createTestState({ settings });

    // Simulate lastUsedSphere being set from previous save
    state.lastUsedSphere = "personal";

    state.inboxScanner = mockInboxScanner([
      { content: "Item 1", file: "inbox/1.md", type: "note", startLine: 0, endLine: 1 },
    ]);
    await state.loadInboxItems();

    expect(state.editableItems[0].selectedSpheres).toEqual(["personal"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-modal-state`
Expected: FAIL - `lastUsedSphere` property doesn't exist

**Step 3: Implement last used sphere**

In `src/inbox-modal-state.ts`:

```typescript
// Add property initialised in constructor
public lastUsedSphere: string | undefined;

// In constructor, after existing code:
constructor(
  private readonly controller: InboxProcessingController,
  private readonly settings: PluginSettings,
  private readonly requestRender: RenderCallback
) {
  this.lastUsedSphere = settings.spheres?.[0];
}
```

Update `loadInboxItems()` to apply default sphere after creating items:

```typescript
this.editableItems = inboxEditableItems;
// Apply default sphere
if (this.lastUsedSphere) {
  for (const item of this.editableItems) {
    if (item.selectedSpheres.length === 0) {
      item.selectedSpheres = [this.lastUsedSphere];
    }
  }
}
this.selectedIndex = inboxEditableItems.length > 0 ? 0 : -1;
```

Update `saveAndRemoveItem()` to track last used sphere:

```typescript
// After successful save, before removing item
if (item.selectedSpheres.length > 0) {
  this.lastUsedSphere = item.selectedSpheres[0];
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-modal-state`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-modal-state.ts tests/inbox-modal-state.test.ts
git commit -m "Add lastUsedSphere tracking with smart defaults"
```

---

## Task 4: Create List Pane Rendering Function

**Files:**
- Modify: `src/inbox-modal-views.ts`
- Test: `tests/inbox-modal-views.test.ts`

**Step 1: Write failing test for renderListPane**

Add to `tests/inbox-modal-views.test.ts`:

```typescript
describe("renderListPane", () => {
  it("should render list header with item count", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [
      createMockEditableItem("Item 1"),
      createMockEditableItem("Item 2"),
    ];

    renderListPane(container, state);

    const header = container.querySelector(".flow-inbox-list-header");
    expect(header?.textContent).toContain("Inbox");
    expect(header?.textContent).toContain("2");
  });

  it("should render list items with truncated text", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [
      createMockEditableItem("This is a very long item that should be truncated"),
      createMockEditableItem("Short item"),
    ];

    renderListPane(container, state);

    const items = container.querySelectorAll(".flow-inbox-list-item");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("This is a very long item");
  });

  it("should mark selected item with selected class", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [
      createMockEditableItem("Item 1"),
      createMockEditableItem("Item 2"),
    ];
    state.selectedIndex = 1;

    renderListPane(container, state);

    const items = container.querySelectorAll(".flow-inbox-list-item");
    expect(items[0].classList.contains("selected")).toBe(false);
    expect(items[1].classList.contains("selected")).toBe(true);
  });

  it("should call selectItem when item clicked", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [
      createMockEditableItem("Item 1"),
      createMockEditableItem("Item 2"),
    ];
    state.selectItem = jest.fn();

    renderListPane(container, state);

    const items = container.querySelectorAll(".flow-inbox-list-item");
    (items[1] as HTMLElement).click();

    expect(state.selectItem).toHaveBeenCalledWith(1);
  });

  it("should render empty state when no items", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [];

    renderListPane(container, state);

    const emptyState = container.querySelector(".flow-inbox-empty");
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain("empty");
  });

  it("should render refresh button in header", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Item 1")];

    renderListPane(container, state);

    const refreshBtn = container.querySelector(".flow-inbox-refresh");
    expect(refreshBtn).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-modal-views`
Expected: FAIL - `renderListPane` is not defined

**Step 3: Implement renderListPane**

In `src/inbox-modal-views.ts`, add new function:

```typescript
export function renderListPane(
  container: HTMLElement,
  state: InboxModalState,
  options: { onRefresh?: () => void; onItemSelect?: (index: number) => void } = {}
) {
  container.empty();
  container.addClass("flow-inbox-list-pane");

  // Header
  const header = container.createDiv("flow-inbox-list-header");
  const title = header.createSpan("flow-inbox-list-title");
  title.setText(`Inbox (${state.editableItems.length})`);

  const refreshBtn = header.createEl("button", { cls: "flow-inbox-refresh clickable-icon" });
  setIcon(refreshBtn, "refresh-cw");
  refreshBtn.setAttribute("aria-label", "Refresh inbox");
  if (options.onRefresh) {
    refreshBtn.addEventListener("click", options.onRefresh);
  }

  // List or empty state
  if (state.editableItems.length === 0) {
    const emptyState = container.createDiv("flow-inbox-empty");
    const icon = emptyState.createDiv("flow-inbox-empty-icon");
    icon.setText("✨");
    emptyState.createEl("p", { text: "Your inbox is empty" });
    return;
  }

  const list = container.createDiv("flow-inbox-list");
  state.editableItems.forEach((item, index) => {
    const itemEl = list.createDiv("flow-inbox-list-item");
    if (index === state.selectedIndex) {
      itemEl.addClass("selected");
    }

    const text = itemEl.createSpan("flow-inbox-list-item-text");
    text.setText(item.original);

    itemEl.addEventListener("click", () => {
      state.selectItem(index);
      options.onItemSelect?.(index);
    });
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-modal-views`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-modal-views.ts tests/inbox-modal-views.test.ts
git commit -m "Add renderListPane function for inbox list"
```

---

## Task 5: Create Detail Pane Rendering Function

**Files:**
- Modify: `src/inbox-modal-views.ts`
- Test: `tests/inbox-modal-views.test.ts`

**Step 1: Write failing tests for renderDetailPane**

Add to `tests/inbox-modal-views.test.ts`:

```typescript
describe("renderDetailPane", () => {
  it("should render empty state when no item selected", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [];
    state.selectedIndex = -1;

    renderDetailPane(container, state, {});

    const emptyState = container.querySelector(".flow-inbox-detail-empty");
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain("Select an item");
  });

  it("should render full original text", () => {
    const container = document.createElement("div");
    const state = createMockState();
    const longText = "This is a very long piece of text that would be truncated in the list but should be shown in full here";
    state.editableItems = [createMockEditableItem(longText)];
    state.selectedIndex = 0;

    renderDetailPane(container, state, {});

    const originalText = container.querySelector(".flow-inbox-detail-original");
    expect(originalText?.textContent).toBe(longText);
  });

  it("should render action type buttons", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Test item")];
    state.selectedIndex = 0;

    renderDetailPane(container, state, {});

    const actionButtons = container.querySelectorAll(".flow-inbox-action-btn");
    expect(actionButtons.length).toBe(7); // All 7 action types
  });

  it("should highlight selected action type", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Test item")];
    state.editableItems[0].selectedAction = "someday-file";
    state.selectedIndex = 0;

    renderDetailPane(container, state, {});

    const selectedBtn = container.querySelector(".flow-inbox-action-btn.selected");
    expect(selectedBtn?.textContent).toContain("Someday");
  });

  it("should render Save and Discard buttons", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Test item")];
    state.selectedIndex = 0;

    renderDetailPane(container, state, {});

    const saveBtn = container.querySelector(".flow-inbox-save-btn");
    const discardBtn = container.querySelector(".flow-inbox-discard-btn");
    expect(saveBtn).toBeTruthy();
    expect(discardBtn).toBeTruthy();
  });

  it("should render back button when showBack option is true", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Test item")];
    state.selectedIndex = 0;

    renderDetailPane(container, state, { showBack: true });

    const backBtn = container.querySelector(".flow-inbox-back-btn");
    expect(backBtn).toBeTruthy();
  });

  it("should not render back button when showBack is false", () => {
    const container = document.createElement("div");
    const state = createMockState();
    state.editableItems = [createMockEditableItem("Test item")];
    state.selectedIndex = 0;

    renderDetailPane(container, state, { showBack: false });

    const backBtn = container.querySelector(".flow-inbox-back-btn");
    expect(backBtn).toBeFalsy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-modal-views`
Expected: FAIL - `renderDetailPane` is not defined

**Step 3: Implement renderDetailPane**

In `src/inbox-modal-views.ts`, add:

```typescript
export interface DetailPaneOptions {
  showBack?: boolean;
  onBack?: () => void;
  onSave?: (item: EditableItem) => void;
  onDiscard?: (item: EditableItem) => void;
}

export function renderDetailPane(
  container: HTMLElement,
  state: InboxModalState,
  options: DetailPaneOptions
) {
  container.empty();
  container.addClass("flow-inbox-detail-pane");

  const item = state.selectedItem;

  // Header with buttons
  const header = container.createDiv("flow-inbox-detail-header");

  if (options.showBack) {
    const backBtn = header.createEl("button", {
      cls: "flow-inbox-back-btn clickable-icon",
    });
    setIcon(backBtn, "arrow-left");
    backBtn.createSpan().setText(`Inbox (${state.editableItems.length})`);
    if (options.onBack) {
      backBtn.addEventListener("click", options.onBack);
    }
  }

  // Empty state
  if (!item) {
    const emptyState = container.createDiv("flow-inbox-detail-empty");
    emptyState.createEl("p", { text: "Select an item to process" });
    return;
  }

  // Action buttons in header (right side)
  const headerActions = header.createDiv("flow-inbox-detail-header-actions");

  const discardBtn = headerActions.createEl("button", {
    text: "Discard",
    cls: "flow-inbox-discard-btn",
  });
  discardBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to discard this item?")) {
      options.onDiscard?.(item);
    }
  });

  const saveBtn = headerActions.createEl("button", {
    text: item.selectedAction === "trash" ? "Delete" : "Save",
    cls: "flow-inbox-save-btn mod-cta",
  });
  saveBtn.addEventListener("click", () => options.onSave?.(item));

  // Original text
  const originalSection = container.createDiv("flow-inbox-detail-section");
  const originalText = originalSection.createDiv("flow-inbox-detail-original");
  originalText.setText(item.original);

  // Action type selector
  const actionSection = container.createDiv("flow-inbox-detail-section");
  renderActionTypeSelector(actionSection, item, state);

  // Conditional sections based on action type
  if (item.selectedAction === "create-project") {
    renderProjectCreationSection(container, item, state);
  } else if (item.selectedAction === "add-to-project" || item.selectedAction === "reference") {
    renderProjectSelectionSection(container, item, state);
  } else if (item.selectedAction === "person") {
    renderPersonSelectionSection(container, item, state);
  }

  // Next actions editor (for most action types)
  if (
    item.selectedAction !== "reference" &&
    item.selectedAction !== "trash"
  ) {
    renderNextActionsEditor(container, item, state);
  }

  // Sphere selector (for applicable action types)
  if (
    item.selectedAction !== "add-to-project" &&
    item.selectedAction !== "reference" &&
    item.selectedAction !== "trash"
  ) {
    renderSphereSelector(container, item, state);
  }

  // Bottom options (focus, mark done, more)
  if (
    item.selectedAction === "create-project" ||
    item.selectedAction === "add-to-project" ||
    item.selectedAction === "next-actions-file"
  ) {
    renderBottomOptions(container, item, state);
  }
}

function renderActionTypeSelector(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const selectorEl = container.createDiv("flow-inbox-action-selector");

  const actions = [
    { key: "c", value: "create-project", label: "Create" },
    { key: "a", value: "add-to-project", label: "Add" },
    { key: "n", value: "next-actions-file", label: "Next" },
    { key: "s", value: "someday-file", label: "Someday" },
    { key: "r", value: "reference", label: "Ref" },
    { key: "p", value: "person", label: "Person" },
    { key: "t", value: "trash", label: "Trash" },
  ];

  const row1 = selectorEl.createDiv("flow-inbox-action-row");
  const row2 = selectorEl.createDiv("flow-inbox-action-row");

  actions.forEach((action, index) => {
    const row = index < 4 ? row1 : row2;
    const btn = row.createEl("button", {
      cls: "flow-inbox-action-btn",
    });
    btn.setAttribute("data-action", action.value);

    const keyHint = btn.createSpan("flow-inbox-action-key");
    keyHint.setText(action.key.toUpperCase());
    btn.appendText(" " + action.label);

    if (item.selectedAction === action.value) {
      btn.addClass("selected");
    }

    btn.addEventListener("click", () => {
      item.selectedAction = action.value as any;
      state.queueRender("editable");
    });
  });
}

function renderBottomOptions(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const section = container.createDiv("flow-inbox-detail-section flow-inbox-bottom-options");

  // Reuse existing renderFocusCheckbox logic
  renderFocusCheckbox(section, item, state);

  // More options toggle
  const moreToggle = section.createDiv("flow-inbox-more-toggle");
  const chevron = moreToggle.createSpan("flow-inbox-more-chevron");
  chevron.setText("▶");
  moreToggle.appendText(" More options");

  const moreContent = section.createDiv("flow-inbox-more-content");
  moreContent.style.display = "none";

  // Date section inside more
  if (item.selectedAction !== "reference" && item.selectedAction !== "trash") {
    renderDateSection(moreContent, item, state);
  }

  moreToggle.addEventListener("click", () => {
    const isExpanded = moreContent.style.display !== "none";
    moreContent.style.display = isExpanded ? "none" : "block";
    chevron.setText(isExpanded ? "▶" : "▼");
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-modal-views`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-modal-views.ts tests/inbox-modal-views.test.ts
git commit -m "Add renderDetailPane function for inbox detail view"
```

---

## Task 6: Add CSS for Two-Pane Layout

**Files:**
- Modify: `styles.css`

**Step 1: Add layout CSS**

Add to `styles.css`:

```css
/* Inbox two-pane layout */
.flow-inbox-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
}

.flow-inbox-list-pane {
  width: 300px;
  min-width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--background-modifier-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.flow-inbox-detail-pane {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

/* Responsive: narrow viewport */
@media (max-width: 799px) {
  .flow-inbox-container {
    flex-direction: column;
  }

  .flow-inbox-list-pane {
    width: 100%;
    border-right: none;
  }

  .flow-inbox-container.view-detail .flow-inbox-list-pane {
    display: none;
  }

  .flow-inbox-container.view-list .flow-inbox-detail-pane {
    display: none;
  }
}

@media (min-width: 800px) {
  .flow-inbox-container .flow-inbox-back-btn {
    display: none;
  }
}

/* List pane styles */
.flow-inbox-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.flow-inbox-list-title {
  font-weight: 600;
  font-size: 16px;
}

.flow-inbox-refresh {
  color: var(--text-muted);
}

.flow-inbox-list {
  flex: 1;
  overflow-y: auto;
}

.flow-inbox-list-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--background-modifier-border);
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.flow-inbox-list-item:hover {
  background-color: var(--background-modifier-hover);
}

.flow-inbox-list-item.selected {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.flow-inbox-list-item-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Empty state */
.flow-inbox-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
}

.flow-inbox-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Detail pane styles */
.flow-inbox-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.flow-inbox-back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: 4px;
}

.flow-inbox-back-btn:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

.flow-inbox-detail-header-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.flow-inbox-discard-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 8px;
}

.flow-inbox-discard-btn:hover {
  color: var(--text-normal);
}

.flow-inbox-save-btn {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  padding: 8px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.flow-inbox-save-btn:hover {
  opacity: 0.9;
}

.flow-inbox-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.flow-inbox-detail-section {
  margin-bottom: 16px;
}

.flow-inbox-detail-original {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
  padding: 12px;
  background-color: var(--background-secondary);
  border-radius: 8px;
}

/* Action type selector */
.flow-inbox-action-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-inbox-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-inbox-action-btn {
  padding: 8px 12px;
  border-radius: 16px;
  border: 1px solid var(--background-modifier-border);
  background: transparent;
  color: var(--text-normal);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.flow-inbox-action-btn:hover {
  background-color: var(--background-modifier-hover);
}

.flow-inbox-action-btn.selected {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.flow-inbox-action-key {
  opacity: 0.6;
  font-size: 12px;
  margin-right: 2px;
}

/* Bottom options */
.flow-inbox-bottom-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.flow-inbox-more-toggle {
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
}

.flow-inbox-more-toggle:hover {
  color: var(--text-normal);
}

.flow-inbox-more-content {
  width: 100%;
  margin-top: 12px;
}
```

**Step 2: Run format and verify build**

Run: `npm run format && npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add styles.css
git commit -m "Add CSS for responsive two-pane inbox layout"
```

---

## Task 7: Update Main View to Use Two-Pane Layout

**Files:**
- Modify: `src/inbox-processing-view.ts`
- Test: `tests/inbox-processing-view.test.ts`

**Step 1: Write failing test for two-pane rendering**

Add to `tests/inbox-processing-view.test.ts`:

```typescript
describe("two-pane layout", () => {
  it("should render both list and detail panes", async () => {
    const { view, container } = await createTestView();

    const listPane = container.querySelector(".flow-inbox-list-pane");
    const detailPane = container.querySelector(".flow-inbox-detail-pane");

    expect(listPane).toBeTruthy();
    expect(detailPane).toBeTruthy();
  });

  it("should update detail pane when selection changes", async () => {
    const { view, container, state } = await createTestView();
    state.editableItems = [
      createMockEditableItem("Item 1"),
      createMockEditableItem("Item 2"),
    ];
    state.selectedIndex = 0;

    await view.refresh();

    let detailOriginal = container.querySelector(".flow-inbox-detail-original");
    expect(detailOriginal?.textContent).toContain("Item 1");

    state.selectItem(1);
    await view.refresh();

    detailOriginal = container.querySelector(".flow-inbox-detail-original");
    expect(detailOriginal?.textContent).toContain("Item 2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-processing-view`
Expected: FAIL - layout structure doesn't match

**Step 3: Update inbox-processing-view.ts**

Replace the render methods in `src/inbox-processing-view.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { InboxModalState } from "./inbox-modal-state";
import { renderListPane, renderDetailPane } from "./inbox-modal-views";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;
  private state: InboxModalState;
  private renderTimeout?: NodeJS.Timeout;
  private saveSettings: () => Promise<void>;
  private listPaneEl?: HTMLElement;
  private detailPaneEl?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    const controller = new InboxProcessingController(this.app, settings, {}, saveSettings);
    this.state = new InboxModalState(controller, settings, (target, options) =>
      this.requestRender(options?.immediate === true)
    );
  }

  getViewType(): string {
    return INBOX_PROCESSING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flow Inbox";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen() {
    const contentEl = this.containerEl.children[1] as HTMLElement;
    contentEl.empty();
    contentEl.addClass("flow-gtd-inbox-modal");

    // Create two-pane container
    const container = contentEl.createDiv("flow-inbox-container");
    this.listPaneEl = container.createDiv();
    this.detailPaneEl = container.createDiv();

    // Initial loading state
    this.renderLoadingState();

    await this.state.loadReferenceData();
    await this.state.loadInboxItems();

    window.addEventListener("keydown", this.handleKeyDown);
  }

  async onClose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = undefined;
    }
  }

  private requestRender(immediate = false) {
    if (immediate) {
      this.renderCurrentView();
      return;
    }

    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }

    this.renderTimeout = setTimeout(() => {
      this.renderCurrentView();
      this.renderTimeout = undefined;
    }, 50);
  }

  private renderLoadingState() {
    if (!this.listPaneEl || !this.detailPaneEl) return;

    this.listPaneEl.empty();
    this.listPaneEl.addClass("flow-inbox-list-pane");
    const loadingEl = this.listPaneEl.createDiv("flow-inbox-loading");
    loadingEl.setText("Loading inbox...");

    this.detailPaneEl.empty();
    this.detailPaneEl.addClass("flow-inbox-detail-pane");
  }

  private renderCurrentView() {
    if (!this.listPaneEl || !this.detailPaneEl) return;

    const container = this.listPaneEl.parentElement;
    if (!container) return;

    // Update view mode class for responsive CSS
    container.removeClass("view-list", "view-detail");
    container.addClass(`view-${this.state.viewMode}`);

    // Render list pane
    renderListPane(this.listPaneEl, this.state, {
      onRefresh: () => this.refresh(),
      onItemSelect: () => {
        // In narrow mode, switch to detail view
        if (window.innerWidth < 800) {
          this.state.showDetail();
        }
      },
    });

    // Render detail pane
    renderDetailPane(this.detailPaneEl, this.state, {
      showBack: window.innerWidth < 800,
      onBack: () => this.state.showList(),
      onSave: (item) => this.state.saveAndRemoveItem(item),
      onDiscard: (item) => this.state.discardItem(item),
    });
  }

  private handleClose() {
    this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
  }

  hasItemsInProgress(): boolean {
    return this.state.editableItems.length > 0;
  }

  async refresh() {
    await this.state.loadReferenceData();
    await this.state.loadInboxItems();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.app.workspace.getActiveViewOfType(InboxProcessingView) !== this) {
      return;
    }

    const target = event.target as HTMLElement;
    const isInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    const item = this.state.selectedItem;

    // Navigation shortcuts (work even in narrow mode)
    if (event.key === "ArrowUp" && !isInInput) {
      event.preventDefault();
      this.state.selectItem(this.state.selectedIndex - 1);
      return;
    }

    if (event.key === "ArrowDown" && !isInInput) {
      event.preventDefault();
      this.state.selectItem(this.state.selectedIndex + 1);
      return;
    }

    if (event.key === "Enter" && !isInInput && window.innerWidth < 800) {
      event.preventDefault();
      this.state.showDetail();
      return;
    }

    if (event.key === "Escape") {
      if (window.innerWidth < 800 && this.state.viewMode === "detail") {
        event.preventDefault();
        this.state.showList();
        return;
      }
      if (isInInput) {
        (target as HTMLElement).blur();
        event.preventDefault();
        return;
      }
    }

    // Cmd+Enter to save
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && item) {
      event.preventDefault();
      this.state.saveAndRemoveItem(item);
      return;
    }

    // Cmd+Backspace to discard
    if (event.key === "Backspace" && (event.ctrlKey || event.metaKey) && item) {
      event.preventDefault();
      if (confirm("Are you sure you want to discard this item?")) {
        this.state.discardItem(item);
      }
      return;
    }

    // Action type shortcuts (only when not in input)
    if (!isInInput && item) {
      const actionMap: Record<string, string> = {
        c: "create-project",
        a: "add-to-project",
        n: "next-actions-file",
        s: "someday-file",
        r: "reference",
        p: "person",
        t: "trash",
      };

      const action = actionMap[event.key.toLowerCase()];
      if (action) {
        event.preventDefault();
        item.selectedAction = action as any;
        this.state.queueRender("editable");
        return;
      }
    }

    // Cmd+1-9 for sphere selection
    if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key) && item) {
      const sphereIndex = parseInt(event.key) - 1;
      const spheres = this.settings.spheres;

      if (sphereIndex < spheres.length) {
        event.preventDefault();
        const sphere = spheres[sphereIndex];
        if (item.selectedSpheres.includes(sphere)) {
          item.selectedSpheres = item.selectedSpheres.filter((s) => s !== sphere);
        } else {
          item.selectedSpheres.push(sphere);
        }
        this.state.queueRender("editable");
      }
      return;
    }

    // Cmd+J for add to focus
    if (event.key === "j" && (event.ctrlKey || event.metaKey) && item) {
      const showsFocus = ["create-project", "add-to-project", "next-actions-file"].includes(item.selectedAction);
      if (showsFocus) {
        event.preventDefault();
        item.addToFocus = !item.addToFocus;
        if (item.addToFocus && item.markAsDone?.[0]) {
          item.markAsDone[0] = false;
        }
        this.state.queueRender("editable");
      }
      return;
    }

    // Cmd+D for mark as done
    if (event.key === "d" && (event.ctrlKey || event.metaKey) && item) {
      const showsFocus = ["create-project", "add-to-project", "next-actions-file"].includes(item.selectedAction);
      if (showsFocus) {
        event.preventDefault();
        if (!item.markAsDone) item.markAsDone = [];
        item.markAsDone[0] = !item.markAsDone[0];
        if (item.markAsDone[0] && item.addToFocus) {
          item.addToFocus = false;
        }
        this.state.queueRender("editable");
      }
      return;
    }

    // Cmd+M for more options toggle
    if (event.key === "m" && (event.ctrlKey || event.metaKey) && item) {
      event.preventDefault();
      const moreContent = this.detailPaneEl?.querySelector(".flow-inbox-more-content") as HTMLElement;
      const chevron = this.detailPaneEl?.querySelector(".flow-inbox-more-chevron");
      if (moreContent && chevron) {
        const isExpanded = moreContent.style.display !== "none";
        moreContent.style.display = isExpanded ? "none" : "block";
        chevron.textContent = isExpanded ? "▶" : "▼";
      }
      return;
    }
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- inbox-processing-view`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/inbox-processing-view.ts tests/inbox-processing-view.test.ts
git commit -m "Update InboxProcessingView to use two-pane layout"
```

---

## Task 8: Clean Up Old Accordion Code

**Files:**
- Modify: `src/inbox-modal-views.ts`
- Modify: `src/inbox-modal-state.ts`
- Modify: `src/inbox-types.ts`

**Step 1: Remove unused accordion code**

In `src/inbox-types.ts`, remove `isExpanded` property:

```typescript
// Remove this line from EditableItem interface:
isExpanded?: boolean;
```

In `src/inbox-modal-state.ts`:
- Remove `initializeExpandedState()` method
- Remove `expandItem()` method
- Remove all references to `isExpanded`

In `src/inbox-modal-views.ts`:
- Remove `renderEditableItemsView()` function (replaced by renderDetailPane)
- Remove `renderIndividualEditableItems()` function
- Remove accordion-related rendering code
- Keep: `renderProjectCreationSection`, `renderProjectSelectionSection`, `renderPersonSelectionSection`, `renderNextActionsEditor`, `renderSphereSelector`, `renderFocusCheckbox`, `renderDateSection` (these are reused)

**Step 2: Run tests to ensure nothing broke**

Run: `npm test`
Expected: All tests PASS (some may need updating if they tested removed functions)

**Step 3: Run format and build**

Run: `npm run format && npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/inbox-modal-views.ts src/inbox-modal-state.ts src/inbox-types.ts tests/
git commit -m "Remove accordion code, keep shared rendering functions"
```

---

## Task 9: Manual Testing and Polish

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test in Obsidian**

Open Obsidian with the plugin loaded. Test:

1. **Wide viewport (≥800px)**
   - [ ] List and detail panes visible side by side
   - [ ] Clicking list item updates detail pane
   - [ ] Arrow keys navigate list
   - [ ] Action type shortcuts work (c, a, n, s, r, p, t)
   - [ ] Cmd+Enter saves item
   - [ ] Cmd+Backspace discards with confirmation
   - [ ] Save advances to next item
   - [ ] Empty state shows when inbox clear

2. **Narrow viewport (<800px)**
   - [ ] Only list visible initially
   - [ ] Click/Enter opens detail view
   - [ ] Back button returns to list
   - [ ] Esc returns to list
   - [ ] All editing functions work

3. **Smart defaults**
   - [ ] First sphere auto-selected
   - [ ] After saving with different sphere, next item has that sphere

4. **All action types**
   - [ ] Create Project shows project name field
   - [ ] Add to Project shows project search
   - [ ] Reference shows project search, hides next actions
   - [ ] Person shows person dropdown
   - [ ] Next Actions just shows actions/spheres
   - [ ] Someday just shows actions/spheres
   - [ ] Trash hides most fields

**Step 3: Fix any issues found**

Address visual polish, alignment issues, edge cases.

**Step 4: Final commit**

```bash
git add .
git commit -m "Polish inbox redesign based on manual testing"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Add selection state | 10 min |
| 2 | Add view mode state | 5 min |
| 3 | Add last used sphere | 10 min |
| 4 | Create list pane render | 15 min |
| 5 | Create detail pane render | 20 min |
| 6 | Add CSS layout | 10 min |
| 7 | Update main view | 20 min |
| 8 | Clean up old code | 10 min |
| 9 | Manual testing | 30 min |

**Total: ~2 hours**
