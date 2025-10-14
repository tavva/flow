# Inbox Processing View Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Convert the inbox processing modal to a full Obsidian tab view for better navigation and state persistence.

**Architecture:** Create an `InboxProcessingView` extending Obsidian's `ItemView`, reusing all existing modal state management and rendering logic. Replace modal instantiation with view registration and leaf management. Implement view reuse with restart confirmation when already open.

**Tech Stack:** TypeScript, Obsidian Plugin API (ItemView, WorkspaceLeaf), existing modal state and rendering infrastructure

---

## Task 1: Create InboxProcessingView class

**Files:**

- Create: `src/inbox-processing-view.ts`
- Test: `tests/inbox-processing-view.test.ts`

**Step 1: Write the failing test**

Create test file that verifies view type and display text:

```typescript
import { App, WorkspaceLeaf } from "obsidian";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { DEFAULT_SETTINGS } from "../src/types";

describe("InboxProcessingView", () => {
  let mockApp: App;
  let mockLeaf: WorkspaceLeaf;

  beforeEach(() => {
    mockApp = {} as App;
    mockLeaf = {
      view: null,
    } as WorkspaceLeaf;
  });

  test("returns correct view type", () => {
    const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);
    expect(view.getViewType()).toBe(INBOX_PROCESSING_VIEW_TYPE);
  });

  test("returns correct display text", () => {
    const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);
    expect(view.getDisplayText()).toBe("Flow Inbox Processing");
  });

  test("returns correct icon", () => {
    const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);
    expect(view.getIcon()).toBe("inbox");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: FAIL with "Cannot find module '../src/inbox-processing-view'"

**Step 3: Write minimal implementation**

Create `src/inbox-processing-view.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
    super(leaf);
    this.settings = settings;
  }

  getViewType(): string {
    return INBOX_PROCESSING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flow Inbox Processing";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen() {
    // Implementation in next task
  }

  async onClose() {
    // Cleanup if needed
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add tests/inbox-processing-view.test.ts src/inbox-processing-view.ts
git commit -m "feat: add InboxProcessingView class with view type and display methods"
```

---

## Task 2: Integrate state management into view

**Files:**

- Modify: `src/inbox-processing-view.ts`
- Test: `tests/inbox-processing-view.test.ts`

**Step 1: Write the failing test**

Add test for state initialization in onOpen:

```typescript
import { InboxModalState } from "../src/inbox-modal-state";

// Add to existing test file
test("initializes state on open", async () => {
  const mockVault = {
    getAbstractFileByPath: jest.fn(),
  };
  const mockWorkspace = {};
  mockApp = { vault: mockVault, workspace: mockWorkspace } as unknown as App;

  const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);

  // Mock containerEl
  (view as any).containerEl = {
    children: [null, document.createElement("div")],
  };

  await view.onOpen();

  // Verify state was initialized
  expect((view as any).state).toBeDefined();
  expect((view as any).state).toBeInstanceOf(InboxModalState);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: FAIL with "expected state to be defined"

**Step 3: Write minimal implementation**

Update `src/inbox-processing-view.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { InboxModalState, RenderTarget } from "./inbox-modal-state";
import { renderInboxView } from "./inbox-modal-views";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;
  private state: InboxModalState;
  private renderTimeout?: NodeJS.Timeout;
  private pendingTarget: RenderTarget = "inbox";

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
    super(leaf);
    this.settings = settings;
    const controller = new InboxProcessingController(this.app, settings);
    this.state = new InboxModalState(controller, settings, (target, options) =>
      this.requestRender(target, options?.immediate === true)
    );
  }

  getViewType(): string {
    return INBOX_PROCESSING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flow Inbox Processing";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-inbox-modal");

    await this.state.loadReferenceData();

    renderInboxView(container as HTMLElement, this.state);
    await this.state.loadInboxItems();
  }

  async onClose() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = undefined;
    }
  }

  private requestRender(target: RenderTarget, immediate = false) {
    // Implementation in next task
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add tests/inbox-processing-view.test.ts src/inbox-processing-view.ts
git commit -m "feat: integrate InboxModalState into InboxProcessingView"
```

---

## Task 3: Add render management to view

**Files:**

- Modify: `src/inbox-processing-view.ts`
- Test: `tests/inbox-processing-view.test.ts`

**Step 1: Write the failing test**

Add test for render request handling:

```typescript
import { renderEditableItemsView } from "../src/inbox-modal-views";

// Mock the view modules
jest.mock("../src/inbox-modal-views", () => ({
  renderInboxView: jest.fn(),
  renderEditableItemsView: jest.fn(),
}));

// Add to existing test file
test("handles render requests with debouncing", async () => {
  jest.useFakeTimers();

  const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);
  (view as any).containerEl = {
    children: [null, document.createElement("div")],
  };

  await view.onOpen();

  // Trigger render request
  (view as any).requestRender("editable", false);

  // Should not render immediately
  expect(renderEditableItemsView).not.toHaveBeenCalled();

  // Fast-forward time
  jest.advanceTimersByTime(50);

  // Should render after debounce
  expect(renderEditableItemsView).toHaveBeenCalled();

  jest.useRealTimers();
});

test("handles immediate render requests", async () => {
  const view = new InboxProcessingView(mockLeaf, DEFAULT_SETTINGS);
  (view as any).containerEl = {
    children: [null, document.createElement("div")],
  };

  await view.onOpen();

  // Clear previous calls
  (renderEditableItemsView as jest.Mock).mockClear();

  // Trigger immediate render
  (view as any).requestRender("editable", true);

  // Should render immediately
  expect(renderEditableItemsView).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: FAIL with "expected renderEditableItemsView to have been called"

**Step 3: Write minimal implementation**

Update `src/inbox-processing-view.ts`, add requestRender and renderCurrentView methods:

```typescript
import { renderInboxView, renderEditableItemsView } from "./inbox-modal-views";

// ... existing code ...

private requestRender(target: RenderTarget, immediate = false) {
  if (immediate) {
    this.renderCurrentView(target);
    return;
  }

  this.pendingTarget = target;

  if (this.renderTimeout) {
    clearTimeout(this.renderTimeout);
  }

  this.renderTimeout = setTimeout(() => {
    this.renderCurrentView(this.pendingTarget);
    this.renderTimeout = undefined;
  }, 50);
}

private renderCurrentView(target: RenderTarget) {
  const container = this.containerEl.children[1] as HTMLElement;
  if (!container) {
    return;
  }

  if (target === "editable") {
    renderEditableItemsView(container, this.state, { onClose: () => this.handleClose() });
    return;
  }

  renderInboxView(container, this.state);
}

private handleClose() {
  this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- inbox-processing-view.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add tests/inbox-processing-view.test.ts src/inbox-processing-view.ts
git commit -m "feat: add render management with debouncing to InboxProcessingView"
```

---

## Task 4: Register view in plugin

**Files:**

- Modify: `main.ts`
- Test: Manual verification (integration test)

**Step 1: Write the failing test**

This is an integration change - we'll verify manually after implementation.

**Step 2: Add view registration**

Update `main.ts`:

```typescript
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "./src/inbox-processing-view";

// In onload(), after sphere view registration:
this.registerView(INBOX_PROCESSING_VIEW_TYPE, (leaf) => {
  return new InboxProcessingView(leaf, this.settings);
});

// In onunload(), after sphere view detachment:
this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
```

**Step 3: Run build to verify it compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add main.ts
git commit -m "feat: register InboxProcessingView in plugin"
```

---

## Task 5: Implement view opening with reuse logic

**Files:**

- Modify: `main.ts`
- Test: Manual verification (integration test)

**Step 1: Write the implementation**

Replace `openInboxModal()` with `openInboxProcessingView()` in `main.ts`:

```typescript
private async openInboxProcessingView() {
  if (!this.hasRequiredApiKey()) {
    new Notice(this.getMissingApiKeyMessage());
    return;
  }

  // Check if inbox processing view already exists
  const existingLeaves = this.app.workspace.getLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);

  if (existingLeaves.length > 0) {
    const leaf = existingLeaves[0];
    const view = leaf.view as InboxProcessingView;

    // Check if view has items in progress
    if (view.hasItemsInProgress()) {
      const shouldRestart = await this.confirmRestart();
      if (!shouldRestart) {
        // Just reveal the existing view
        this.app.workspace.revealLeaf(leaf);
        return;
      }
      // User wants to restart - will reuse the leaf
    }

    // Reveal and refresh the existing view
    this.app.workspace.revealLeaf(leaf);
    await view.refresh();
    return;
  }

  // No existing view, create new one
  const leaf = this.app.workspace.getLeaf("tab");
  await leaf.setViewState({
    type: INBOX_PROCESSING_VIEW_TYPE,
    active: true,
  });
}

private async confirmRestart(): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmationModal(
      this.app,
      "Restart inbox processing?",
      "You have items in progress. Starting a new session will discard your current work.",
      () => resolve(true),
      () => resolve(false)
    );
    modal.open();
  });
}

// Update all calls from openInboxModal() to openInboxProcessingView():
// - In ribbon icon callback
// - In registerInboxCommand
```

**Step 2: Add helper methods to InboxProcessingView**

Update `src/inbox-processing-view.ts`:

```typescript
hasItemsInProgress(): boolean {
  return this.state.editableItems.length > 0;
}

async refresh() {
  await this.onOpen();
}
```

**Step 3: Create ConfirmationModal**

Create `src/confirmation-modal.ts`:

```typescript
import { App, Modal } from "obsidian";

export class ConfirmationModal extends Modal {
  private message: string;
  private description: string;
  private onConfirm: () => void;
  private onCancel: () => void;

  constructor(
    app: App,
    message: string,
    description: string,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.message = message;
    this.description = description;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.message });
    contentEl.createEl("p", { text: this.description });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => {
      this.close();
      this.onCancel();
    });

    const confirmButton = buttonContainer.createEl("button", {
      text: "Restart",
      cls: "mod-warning",
    });
    confirmButton.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

**Step 4: Run build to verify it compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add main.ts src/inbox-processing-view.ts src/confirmation-modal.ts
git commit -m "feat: implement view opening with reuse and restart confirmation"
```

---

## Task 6: Remove modal files and references

**Files:**

- Delete: `src/inbox-modal.ts`
- Modify: `main.ts`
- Modify: `tests/inbox-modal-state.test.ts` (if it imports the modal)
- Test: `npm test`

**Step 1: Write test verification plan**

We'll verify by running all tests after removing the modal file.

**Step 2: Remove modal imports from main.ts**

Update `main.ts`:

```typescript
// Remove this import:
// import { InboxProcessingModal } from "./src/inbox-modal";

// Already replaced openInboxModal() with openInboxProcessingView() in previous task
```

**Step 3: Check for other modal references**

Run: `grep -r "InboxProcessingModal" src/ tests/`
Expected: Should only find references in inbox-modal.ts itself

**Step 4: Delete the modal file**

Run: `git rm src/inbox-modal.ts`

**Step 5: Run all tests to verify nothing broke**

Run: `npm test`
Expected: All tests pass (same count as baseline)

**Step 6: Commit**

```bash
git commit -m "refactor: remove InboxProcessingModal, replaced by InboxProcessingView"
```

---

## Task 7: Update tests to use view instead of modal

**Files:**

- Modify: `tests/inbox-modal-state.test.ts` (if needed)
- Modify: `tests/inbox-modal-views.test.ts` (if needed)
- Test: `npm test`

**Step 1: Check if tests need updates**

Run: `npm test`
Expected: Tests should still pass since they test state and views independently

**Step 2: Update test names if they reference "modal"**

If test files have "modal" in describe blocks but test view rendering (inbox-modal-views.test.ts), consider updating names for clarity:

```typescript
// Before:
describe("renderInboxView for modal", () => { ... });

// After:
describe("renderInboxView", () => { ... });
```

**Step 3: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit if changes made**

```bash
git add tests/inbox-modal-views.test.ts tests/inbox-modal-state.test.ts
git commit -m "refactor: update test descriptions to reflect view architecture"
```

---

## Task 8: Manual testing and documentation

**Files:**

- Create: `docs/manual-test-plan.md`
- Manual testing to be performed

**Step 1: Create manual test plan**

Create `docs/manual-test-plan.md`:

```markdown
# Inbox Processing View - Manual Test Plan

## Test 1: Open view from ribbon

1. Click inbox icon in ribbon
2. Verify: New tab opens with "Flow Inbox Processing" title
3. Verify: View shows inbox items

## Test 2: Open view from command palette

1. Open command palette (Cmd+P)
2. Type "Process Inbox"
3. Select command
4. Verify: New tab opens with inbox view

## Test 3: Navigate away and return

1. Open inbox processing view
2. Start AI refinement on an item
3. Navigate to a different note
4. Return to inbox processing tab
5. Verify: AI refinement results are still present
6. Verify: Can continue processing items

## Test 4: Reuse existing tab

1. Open inbox processing view (has items)
2. Navigate to different note
3. Run "Process Inbox" command again
4. Verify: Existing tab is revealed (not new tab created)

## Test 5: Restart confirmation

1. Open inbox processing view
2. Load some items (don't process yet)
3. Close the tab
4. Open inbox processing view again
5. Let items load
6. Close tab again
7. Open inbox processing view again
8. Verify: Should ask for restart confirmation
9. Click "Cancel"
10. Verify: Existing view revealed with current items
11. Run command again
12. Click "Restart"
13. Verify: View refreshes with new item load

## Test 6: Close view

1. Open inbox processing view
2. Process and save all items
3. Verify: "All items processed" message shows
4. Click "Close" button
5. Verify: Tab closes

## Test 7: Multiple spheres workflow

1. Open inbox processing view
2. Process items selecting different spheres
3. Navigate to different notes between items
4. Return and continue processing
5. Verify: All selections and edits preserved
```

**Step 2: Perform manual testing**

Follow the test plan and note any issues.

**Step 3: Document completion**

Add to the test plan:

```markdown
## Test Results

Date: [Test date]
Tester: [Name]
Result: PASS/FAIL

Issues found:

- [List any issues]
```

**Step 4: Commit**

```bash
git add docs/manual-test-plan.md
git commit -m "docs: add manual test plan for inbox processing view"
```

---

## Completion

All tasks complete. The inbox processing modal has been converted to a full tab view with:

- State persistence while tab is open
- Navigation freedom (can switch away and return)
- Tab reuse with restart confirmation
- Full Obsidian ItemView integration
- All existing functionality preserved

Run final verification:

```bash
npm test
npm run build
```

Expected: All tests pass, build succeeds
