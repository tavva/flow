# Due Date Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional due date support to all processing action types with context-aware UI labels and update waiting-for icons to handshake emoji.

**Architecture:** Rename existing `reminderDate` field to `dueDate` in data model, extend file writing to include dates for all action types, add collapsible date picker UI with dynamic labels, and replace clock emojis with handshake throughout.

**Tech Stack:** TypeScript, Obsidian API, Jest, HTML5 date inputs

---

## Task 1: Rename reminderDate to dueDate in Data Model

**Files:**
- Modify: `src/inbox-types.ts:24`
- Modify: `src/inbox-item-persistence.ts` (references to reminderDate)
- Modify: `tests/inbox-item-persistence.test.ts` (test assertions)

**Step 1: Update EditableItem interface**

In `src/inbox-types.ts`, change line 24:

```typescript
reminderDate?: string; // Optional reminder date for someday items (YYYY-MM-DD format)
```

to:

```typescript
dueDate?: string; // Optional date in YYYY-MM-DD format (due date, reminder, or follow-up depending on context)
```

**Step 2: Update persistence logic**

In `src/inbox-item-persistence.ts`, replace all occurrences of `reminderDate` with `dueDate`:
- When saving: `item.reminderDate` → `item.dueDate`
- When loading: `reminderDate` property → `dueDate` property

**Step 3: Update persistence tests**

In `tests/inbox-item-persistence.test.ts`, replace all test assertions checking `reminderDate` with `dueDate`.

**Step 4: Run tests to verify**

```bash
npm test -- inbox-item-persistence.test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/inbox-types.ts src/inbox-item-persistence.ts tests/inbox-item-persistence.test.ts
git commit -m "refactor: rename reminderDate to dueDate in data model"
```

---

## Task 2: Update File Writer for Next Actions

**Files:**
- Modify: `src/file-writer.ts` (writeToNextActionsFile function)
- Modify: `tests/file-writer.test.ts`

**Step 1: Write failing test for next action with due date**

In `tests/file-writer.test.ts`, add test in the "Next Actions file" describe block:

```typescript
it("should write next action with due date to next actions file", async () => {
  const item: EditableItem = {
    original: "Call dentist",
    isAIProcessed: true,
    selectedAction: "next-action",
    selectedSpheres: ["personal"],
    editedName: "Call dentist for appointment",
    dueDate: "2025-11-15",
  };

  await writer.writeToNextActionsFile(item);

  expect(mockVault.append).toHaveBeenCalledWith(
    mockNextActionsFile,
    "- [ ] Call dentist for appointment 📅 2025-11-15 #sphere/personal\n"
  );
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- file-writer.test -t "should write next action with due date"
```

Expected: FAIL - due date not included in output

**Step 3: Update writeToNextActionsFile implementation**

In `src/file-writer.ts`, find the `writeToNextActionsFile` function and update the line writing logic:

```typescript
const dueDate = item.dueDate ? ` 📅 ${item.dueDate}` : "";
const line = `- [ ] ${item.editedName}${dueDate} #sphere/${sphere}\n`;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- file-writer.test -t "should write next action with due date"
```

Expected: PASS

**Step 5: Add test for waiting-for with due date**

In `tests/file-writer.test.ts`, add test:

```typescript
it("should write waiting-for action with due date to next actions file", async () => {
  const item: EditableItem = {
    original: "Wait for Sarah",
    isAIProcessed: true,
    selectedAction: "next-action",
    selectedSpheres: ["work"],
    editedNames: ["Wait for Sarah's feedback"],
    waitingFor: [true],
    dueDate: "2025-11-01",
  };

  await writer.writeToNextActionsFile(item);

  expect(mockVault.append).toHaveBeenCalledWith(
    mockNextActionsFile,
    "- [w] Wait for Sarah's feedback 📅 2025-11-01 #sphere/work\n"
  );
});
```

**Step 6: Run test to verify it passes**

```bash
npm test -- file-writer.test -t "should write waiting-for action with due date"
```

Expected: PASS (already supported by previous implementation)

**Step 7: Commit**

```bash
git add src/file-writer.ts tests/file-writer.test.ts
git commit -m "feat: add due date support to next actions file writing"
```

---

## Task 3: Update File Writer for Someday Items

**Files:**
- Modify: `src/file-writer.ts` (writeToSomedayFile function)
- Modify: `tests/file-writer.test.ts`

**Step 1: Update existing someday tests to use dueDate**

In `tests/file-writer.test.ts`, find tests that reference `reminderDate` and change to `dueDate`. Example:

```typescript
it("should write someday item with reminder date", async () => {
  const item: EditableItem = {
    original: "Learn Spanish",
    isAIProcessed: true,
    selectedAction: "someday",
    selectedSpheres: ["personal"],
    editedNames: ["Learn Spanish"],
    dueDate: "2026-01-12", // Changed from reminderDate
  };

  await writer.writeToSomedayFile(item);

  expect(mockVault.append).toHaveBeenCalledWith(
    mockSomedayFile,
    "- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal\n"
  );
});
```

**Step 2: Update writeToSomedayFile implementation**

In `src/file-writer.ts`, find `writeToSomedayFile` and update references from `reminderDate` to `dueDate`:

```typescript
const dueDate = item.dueDate ? ` 📅 ${item.dueDate}` : "";
// ... use dueDate in line construction
```

**Step 3: Run tests to verify**

```bash
npm test -- file-writer.test -t "someday"
```

Expected: All someday tests pass

**Step 4: Commit**

```bash
git add src/file-writer.ts tests/file-writer.test.ts
git commit -m "refactor: update someday file writing to use dueDate"
```

---

## Task 4: Update File Writer for Projects

**Files:**
- Modify: `src/file-writer.ts` (createProjectFile and updateProjectFile functions)
- Modify: `tests/file-writer.test.ts`

**Step 1: Write failing test for project creation with due date**

In `tests/file-writer.test.ts`, add test:

```typescript
it("should create project with next action with due date", async () => {
  const item: EditableItem = {
    original: "Website redesign",
    isAIProcessed: true,
    selectedAction: "project",
    selectedSpheres: ["work"],
    editedProjectTitle: "Website redesign",
    editedNames: ["Draft proposal outline", "Review with stakeholders"],
    dueDate: "2025-11-05",
    projectPriority: 2,
  };

  await writer.createProjectFile(item, mockPlugin.settings);

  const expectedContent = expect.stringContaining(
    "- [ ] Draft proposal outline 📅 2025-11-05\n- [ ] Review with stakeholders 📅 2025-11-05"
  );
  expect(mockVault.create).toHaveBeenCalledWith(
    expect.stringContaining("Website redesign.md"),
    expectedContent
  );
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- file-writer.test -t "should create project with next action with due date"
```

Expected: FAIL - due date not in next actions

**Step 3: Update createProjectFile implementation**

In `src/file-writer.ts`, find the `createProjectFile` function where it writes next actions:

```typescript
// In the section building next actions
const dueDate = item.dueDate ? ` 📅 ${item.dueDate}` : "";
content += `- [ ] ${action}${dueDate}\n`;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- file-writer.test -t "should create project with next action with due date"
```

Expected: PASS

**Step 5: Write test for updateProjectFile with due date**

In `tests/file-writer.test.ts`, add test:

```typescript
it("should update project file adding next action with due date", async () => {
  const existingContent = `---
creation-date: 2025-10-15
priority: 2
tags: project/work
status: live
---

# Engineering Strategy

Develop AI capabilities

## Next actions

- [ ] Existing action
`;

  mockVault.read.mockResolvedValue(existingContent);

  const item: EditableItem = {
    original: "Add new action",
    isAIProcessed: true,
    selectedAction: "project",
    selectedProject: mockProject,
    selectedSpheres: ["work"],
    editedNames: ["Complete impact analysis"],
    dueDate: "2025-11-10",
  };

  await writer.updateProjectFile(item);

  const expectedContent = expect.stringContaining(
    "- [ ] Complete impact analysis 📅 2025-11-10"
  );
  expect(mockVault.modify).toHaveBeenCalledWith(mockProjectFile, expectedContent);
});
```

**Step 6: Update updateProjectFile implementation**

In `src/file-writer.ts`, find `updateProjectFile` where it appends actions:

```typescript
const dueDate = item.dueDate ? ` 📅 ${item.dueDate}` : "";
const newAction = `- [ ] ${action}${dueDate}\n`;
```

**Step 7: Run tests to verify**

```bash
npm test -- file-writer.test -t "project"
```

Expected: All project tests pass

**Step 8: Commit**

```bash
git add src/file-writer.ts tests/file-writer.test.ts
git commit -m "feat: add due date support to project file writing"
```

---

## Task 5: Update File Writer for Person Notes

**Files:**
- Modify: `src/file-writer.ts` (addToPersonNote function)
- Modify: `tests/file-writer.test.ts`

**Step 1: Write failing test for person note with due date**

In `tests/file-writer.test.ts`, add test:

```typescript
it("should add action with due date to person note", async () => {
  const existingContent = `# Sarah Johnson

## Actions

- [ ] Existing action
`;

  mockVault.read.mockResolvedValue(existingContent);

  const item: EditableItem = {
    original: "Follow up with Sarah",
    isAIProcessed: true,
    selectedAction: "person",
    selectedPerson: mockPerson,
    selectedSpheres: ["work"],
    editedName: "Follow up about Q4 planning",
    dueDate: "2025-11-02",
  };

  await writer.addToPersonNote(item);

  const expectedContent = expect.stringContaining(
    "- [ ] Follow up about Q4 planning 📅 2025-11-02"
  );
  expect(mockVault.modify).toHaveBeenCalledWith(mockPersonFile, expectedContent);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- file-writer.test -t "should add action with due date to person note"
```

Expected: FAIL - due date not included

**Step 3: Update addToPersonNote implementation**

In `src/file-writer.ts`, find `addToPersonNote` where it creates the action line:

```typescript
const dueDate = item.dueDate ? ` 📅 ${item.dueDate}` : "";
const actionLine = `- [ ] ${item.editedName}${dueDate}\n`;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- file-writer.test -t "should add action with due date to person note"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/file-writer.ts tests/file-writer.test.ts
git commit -m "feat: add due date support to person note writing"
```

---

## Task 6: Add Collapsible Date Section to UI

**Files:**
- Modify: `src/inbox-modal-views.ts` (renderEditableItemsView function)
- Modify: `tests/inbox-modal-views.test.ts`

**Step 1: Write test for date section rendering**

In `tests/inbox-modal-views.test.ts`, add test:

```typescript
it("should render collapsible date section", () => {
  const state = createMockState({
    editableItems: [
      {
        original: "Test item",
        isAIProcessed: true,
        selectedAction: "next-action",
        selectedSpheres: ["work"],
        editedName: "Test action",
      },
    ],
  });

  const container = document.createElement("div");
  renderEditableItemsView(container, state, { onClose: () => {} });

  const dateSection = container.querySelector(".flow-gtd-date-section");
  expect(dateSection).toBeTruthy();

  const dateLabel = dateSection?.querySelector(".flow-gtd-date-label");
  expect(dateLabel?.textContent).toContain("Set due date (optional)");
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- inbox-modal-views.test -t "should render collapsible date section"
```

Expected: FAIL - section not found

**Step 3: Add date section UI code**

In `src/inbox-modal-views.ts`, find where action controls are rendered (after the waiting/done toggles) and add:

```typescript
// Date section (collapsible)
const dateSection = actionItem.createDiv({
  cls: "flow-gtd-date-section",
});
dateSection.style.marginTop = "8px";

const dateSectionHeader = dateSection.createDiv({
  cls: "flow-gtd-date-section-header",
});
dateSectionHeader.style.display = "flex";
dateSectionHeader.style.alignItems = "center";
dateSectionHeader.style.cursor = "pointer";
dateSectionHeader.style.fontSize = "13px";
dateSectionHeader.style.color = "var(--text-muted)";

const chevron = dateSectionHeader.createSpan({
  cls: "flow-gtd-date-chevron",
  text: "▶",
});
chevron.style.marginRight = "6px";
chevron.style.fontSize = "10px";

const dateLabel = dateSectionHeader.createSpan({
  cls: "flow-gtd-date-label",
});

// Get label based on action type
const getDateLabel = (action: ProcessingAction, isWaiting: boolean): string => {
  if (isWaiting) return "Set follow-up date (optional)";
  switch (action) {
    case "next-action":
      return "Set due date (optional)";
    case "project":
      return "Set target date (optional)";
    case "someday":
      return "Set reminder date (optional)";
    case "person":
      return "Set follow-up date (optional)";
    default:
      return null;
  }
};

const label = getDateLabel(item.selectedAction, item.waitingFor?.[i] || false);
if (label) {
  dateLabel.textContent = label;
} else {
  dateSection.style.display = "none";
}

const dateInputContainer = dateSection.createDiv({
  cls: "flow-gtd-date-input-container",
});
dateInputContainer.style.marginTop = "8px";
dateInputContainer.style.display = "none"; // Hidden by default

const dateInput = dateInputContainer.createEl("input", {
  type: "date",
  cls: "flow-gtd-date-input",
});
dateInput.value = item.dueDate || "";
dateInput.style.width = "150px";
dateInput.style.marginRight = "8px";

dateInput.addEventListener("change", () => {
  item.dueDate = dateInput.value || undefined;
});

if (item.dueDate) {
  const clearButton = dateInputContainer.createEl("button", {
    text: "×",
    cls: "flow-gtd-date-clear",
  });
  clearButton.style.cursor = "pointer";
  clearButton.addEventListener("click", () => {
    item.dueDate = undefined;
    dateInput.value = "";
    clearButton.remove();
  });
}

// Toggle collapsed/expanded
let isExpanded = false;
dateSectionHeader.addEventListener("click", () => {
  isExpanded = !isExpanded;
  dateInputContainer.style.display = isExpanded ? "block" : "none";
  chevron.textContent = isExpanded ? "▼" : "▶";
});
```

**Step 4: Run test to verify it passes**

```bash
npm test -- inbox-modal-views.test -t "should render collapsible date section"
```

Expected: PASS

**Step 5: Write test for dynamic label based on action type**

In `tests/inbox-modal-views.test.ts`, add test:

```typescript
it("should show different date labels based on action type", () => {
  const actionLabels: Record<ProcessingAction, string | null> = {
    "next-action": "Set due date (optional)",
    project: "Set target date (optional)",
    someday: "Set reminder date (optional)",
    person: "Set follow-up date (optional)",
    reference: null,
  };

  Object.entries(actionLabels).forEach(([action, expectedLabel]) => {
    const state = createMockState({
      editableItems: [
        {
          original: "Test",
          isAIProcessed: true,
          selectedAction: action as ProcessingAction,
          selectedSpheres: ["work"],
          editedName: "Test",
        },
      ],
    });

    const container = document.createElement("div");
    renderEditableItemsView(container, state, { onClose: () => {} });

    const dateSection = container.querySelector(".flow-gtd-date-section") as HTMLElement;

    if (expectedLabel) {
      expect(dateSection.style.display).not.toBe("none");
      const label = dateSection.querySelector(".flow-gtd-date-label");
      expect(label?.textContent).toBe(expectedLabel);
    } else {
      expect(dateSection.style.display).toBe("none");
    }
  });
});
```

**Step 6: Run test to verify it passes**

```bash
npm test -- inbox-modal-views.test -t "should show different date labels"
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/inbox-modal-views.ts tests/inbox-modal-views.test.ts
git commit -m "feat: add collapsible date section to inbox processing UI"
```

---

## Task 7: Change Waiting-For Icons to Handshake

**Files:**
- Modify: `src/inbox-modal-views.ts`
- Modify: `src/sphere-view.ts`
- Modify: `src/focus-view.ts`
- Modify: `tests/inbox-modal-views.test.ts`
- Modify: `tests/sphere-view.test.ts`
- Modify: `tests/focus-view.test.ts`

**Step 1: Update inbox modal toggle button icon**

In `src/inbox-modal-views.ts`, find the waiting-for toggle button (search for `⏰`):

```typescript
const waitingToggle = actionItem.createEl("button", {
  cls: "flow-gtd-next-action-waiting-toggle",
  text: "🤝", // Changed from ⏰
});
```

**Step 2: Update sphere view display**

In `src/sphere-view.ts`, find the display text construction (search for `🕐`):

```typescript
// Create the display text with handshake emoji if waiting-for
const displayText = isWaitingFor ? `🤝 ${action}` : action; // Changed from 🕐
```

**Step 3: Update focus view indicator (location 1)**

In `src/focus-view.ts`, find the first waiting-for indicator (in pinned section, search for first occurrence):

```typescript
// Add handshake emoji for waiting-for items (outside the item box)
if (isWaitingFor) {
  const handshakeSpan = itemEl.createSpan({
    cls: "flow-gtd-focus-item-waiting-indicator",
    text: "🤝 ", // Changed from clock emoji
  });
  handshakeSpan.style.marginRight = "6px";
  handshakeSpan.style.fontSize = "14px";
}
```

**Step 4: Update focus view indicator (location 2)**

In `src/focus-view.ts`, find the second waiting-for indicator (in unpinned section):

```typescript
// Add handshake emoji for waiting-for items (outside the item box)
if (isWaitingFor) {
  const handshakeSpan = itemEl.createSpan({
    cls: "flow-gtd-focus-item-waiting-indicator",
    text: "🤝 ", // Changed from clock emoji
  });
  handshakeSpan.style.marginRight = "6px";
  handshakeSpan.style.fontSize = "14px";
}
```

**Step 5: Update inbox modal view test**

In `tests/inbox-modal-views.test.ts`, find test checking toggle button text:

```typescript
expect(waitingToggle.textContent).toBe("🤝"); // Changed from ⏰
```

**Step 6: Update sphere view test**

In `tests/sphere-view.test.ts`, find the "waiting-for visual indicator" describe block and update test:

```typescript
it("should display handshake emoji for waiting-for items", async () => { // Changed from "clock emoji"
  // ... test setup ...

  // Should have handshake emoji prefix in markdown
  expect(renderMarkdownSpy).toHaveBeenCalledWith(
    "🤝 Wait for client response", // Changed from 🕐
    expect.anything(),
    "",
    view
  );
});

it("should not display handshake emoji for regular actions", async () => { // Changed from "clock emoji"
  // ... test code with updated description ...
});
```

**Step 7: Update focus view tests**

In `tests/focus-view.test.ts`, find tests checking waiting-for indicator and update emoji expectations from clock to 🤝.

**Step 8: Run all tests to verify**

```bash
npm test
```

Expected: All tests pass

**Step 9: Commit**

```bash
git add src/inbox-modal-views.ts src/sphere-view.ts src/focus-view.ts tests/inbox-modal-views.test.ts tests/sphere-view.test.ts tests/focus-view.test.ts
git commit -m "refactor: change waiting-for icon from clock to handshake emoji"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Someday/Maybe section**

In `CLAUDE.md`, find the "Someday/Maybe with Reminder Dates" section and update:

```markdown
### Someday/Maybe with Dates

The plugin supports adding optional dates to items in the Someday/Maybe file:

- **Editable Items** - When processing items to the Someday/Maybe file, you can edit the item text and add/remove multiple items
- **Date Picker UI** - A collapsible date picker allows setting dates for items
- **Format** - Dates are stored in YYYY-MM-DD format with a 📅 emoji (e.g., `- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal`)
- **Integration** - Works with the Reminders plugin for Obsidian to surface items at the appropriate time
- **Validation** - The `validateReminderDate()` function ensures dates are valid and properly formatted
- **Optional** - Dates are optional; items can be added to Someday/Maybe without a date
- **Multiple Items** - You can add multiple items to the Someday/Maybe file in one operation
```

**Step 2: Add Due Date Support section**

After the Someday/Maybe section, add:

```markdown
### Due Date Support

The plugin supports optional due dates for all processing action types:

- **All Action Types** - Next actions, projects, someday items, waiting-for items, and person notes all support dates
- **Context-Aware Labels** - UI labels adapt based on action type (due date, reminder date, follow-up date, target date)
- **Consistent Format** - All dates use 📅 YYYY-MM-DD format for compatibility with Reminders plugin
- **Minimal UI** - Collapsible date section hidden by default to avoid clutter
- **Optional** - Dates are never required; only add when meaningful
- **Manual Entry** - No AI suggestions for dates; user sets them explicitly during review

**Date semantic meaning by action type:**
- **Next actions**: Due date (when action must be completed)
- **Projects**: Target date (desired completion timeline)
- **Someday items**: Reminder date (when to review the item)
- **Waiting-for items**: Follow-up date (when to check back)
- **Person notes**: Follow-up date (when to reach out)

**Example entries with dates:**

```markdown
# Next Actions file
- [ ] Call dentist for appointment 📅 2025-11-15 #sphere/personal
- [w] Wait for Sarah's feedback 📅 2025-11-01 #sphere/work

# Project file
## Next actions
- [ ] Draft proposal outline 📅 2025-11-05
```
```

**Step 3: Update Waiting For Support section**

Find the "Waiting For Support" section and update icon references:

```markdown
### Waiting For Support

The plugin supports GTD "Waiting For" items using `[w]` checkbox status:

- **Scanner** (`src/waiting-for-scanner.ts`) - Finds all `[w]` items across vault
- **View** (`src/waiting-for-view.ts`) - Aggregates waiting-for items in dedicated pane
- **Status Cycler** (`src/task-status-cycler.ts`) - Cycles checkbox status: [ ] → [w] → [x]
- **Visual Indicator** - Waiting-for items show 🤝 handshake emoji in sphere and focus views
- **AI Integration** - Processor recognizes waiting-for scenarios during inbox processing
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with due date support and handshake icon"
```

---

## Task 9: Run Full Test Suite and Format

**Files:**
- All modified files

**Step 1: Run complete test suite**

```bash
npm test
```

Expected: All 553+ tests pass with 80%+ coverage

**Step 2: Run format check**

```bash
npm run format:check
```

Expected: No formatting issues

**Step 3: If formatting issues, run format**

```bash
npm run format
```

**Step 4: Commit formatting if needed**

```bash
git add -A
git commit -m "style: format code with Prettier"
```

**Step 5: Final verification**

```bash
npm test && npm run format:check
```

Expected: All tests pass, code formatted

---

## Completion Checklist

- [ ] Data model updated (reminderDate → dueDate)
- [ ] File writing supports due dates for all action types
- [ ] UI has collapsible date section with dynamic labels
- [ ] Waiting-for icons changed to handshake throughout
- [ ] All tests pass (80%+ coverage)
- [ ] Code formatted with Prettier
- [ ] Documentation updated
- [ ] Ready for code review using @superpowers:requesting-code-review

**After implementation:**
1. Use @superpowers:verification-before-completion to verify all changes work
2. Use @superpowers:requesting-code-review to review against plan
3. Use @superpowers:finishing-a-development-branch to merge or create PR
