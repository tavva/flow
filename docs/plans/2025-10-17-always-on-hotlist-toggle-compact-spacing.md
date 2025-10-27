# Always-On Focus Toggle and Compact Sphere View Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Remove planning mode toggle from sphere view, make all actions always clickable to toggle focus membership, add visual indicators for focus items, and reduce spacing for more compact display.

**Architecture:** Simplify SphereView by removing planning mode state. All action buttons always trigger focus toggle. Add CSS class for focus items with persistent subtle background. Reduce button padding for compact layout.

**Tech Stack:** TypeScript, Obsidian API, Jest for testing

---

## Task 1: Read Current Implementation

**Files:**

- Read: `src/sphere-view.ts`
- Read: `src/focus-editor-menu.ts`
- Read: `tests/sphere-view.test.ts`

**Step 1: Read sphere view implementation**

Read `src/sphere-view.ts` to understand:

- Current planning mode implementation
- How actions are rendered
- Click handler logic
- CSS classes used

**Step 2: Read focus editor menu**

Read `src/focus-editor-menu.ts` to understand:

- How focus add/remove works
- Methods available for toggling focus membership

**Step 3: Read existing tests**

Read `tests/sphere-view.test.ts` to understand:

- Current test coverage
- Planning mode tests to remove
- Test structure to follow

---

## Task 2: Remove Planning Mode State

**Files:**

- Modify: `src/sphere-view.ts`

**Step 1: Write failing test for always-on click behavior**

In `tests/sphere-view.test.ts`, add test that verifies action click always toggles focus (no planning mode check):

```typescript
it("should toggle focus on action click without planning mode", async () => {
  const mockApp = createMockApp();
  const mockPlugin = createMockPlugin();
  mockPlugin.settings.focusItems = [];

  const view = new SphereView(mockApp, mockPlugin, "work");
  await view.render();

  const actionButton = view.containerEl.querySelector(".sphere-action") as HTMLElement;
  expect(actionButton).toBeTruthy();

  actionButton.click();

  expect(mockPlugin.settings.focusItems.length).toBe(1);
  await mockPlugin.saveSettings.wait();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-view.test.ts -t "should toggle focus on action click without planning mode"`
Expected: FAIL (planning mode check prevents focus toggle)

**Step 3: Remove planning mode property and toggle button**

In `src/sphere-view.ts`, remove:

- `private planningMode: boolean = false;` property declaration
- Planning mode toggle button rendering code
- Any UI text/labels related to planning mode

**Step 4: Remove planning mode conditional from click handlers**

In `src/sphere-view.ts`, find action click handlers and remove `if (this.planningMode)` conditions:

```typescript
// Before:
actionEl.addEventListener("click", () => {
  if (this.planningMode) {
    this.toggleHotlist(file, lineNumber, lineContent, text, sphere, isGeneral);
  }
});

// After:
actionEl.addEventListener("click", () => {
  this.toggleHotlist(file, lineNumber, lineContent, text, sphere, isGeneral);
});
```

**Step 5: Run test to verify it passes**

Run: `npm test -- sphere-view.test.ts -t "should toggle focus on action click without planning mode"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view.test.ts
git commit -m "refactor: remove planning mode, make focus toggle always active"
```

---

## Task 3: Add Focus Visual Indicators

**Files:**

- Modify: `src/sphere-view.ts`
- Modify: `styles.css`

**Step 1: Write failing test for CSS class application**

In `tests/sphere-view.test.ts`, add test:

```typescript
it("should apply CSS class to actions in focus", async () => {
  const mockApp = createMockApp();
  const mockPlugin = createMockPlugin();

  // Pre-populate focus with one item
  mockPlugin.settings.focusItems = [
    {
      file: "Projects/Test Project.md",
      lineNumber: 10,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    },
  ];

  const view = new SphereView(mockApp, mockPlugin, "work");
  await view.render();

  const actionButtons = view.containerEl.querySelectorAll(".sphere-action");
  const focusAction = Array.from(actionButtons).find((el) =>
    el.textContent?.includes("Test action")
  );

  expect(focusAction?.classList.contains("sphere-action-in-focus")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-view.test.ts -t "should apply CSS class to actions in focus"`
Expected: FAIL (CSS class not applied)

**Step 3: Add focus membership check to action rendering**

In `src/sphere-view.ts`, find where actions are rendered and add focus check:

```typescript
private renderAction(
  actionEl: HTMLElement,
  file: string,
  lineNumber: number,
  lineContent: string,
  text: string,
  sphere: string,
  isGeneral: boolean
): void {
  actionEl.addClass("sphere-action");

  // Check if action is in focus
  const inHotlist = this.plugin.settings.focusItems.some(
    item => item.file === file && item.lineContent === lineContent
  );

  if (inHotlist) {
    actionEl.addClass("sphere-action-in-focus");
  }

  actionEl.setText(text);

  actionEl.addEventListener("click", () => {
    this.toggleHotlist(file, lineNumber, lineContent, text, sphere, isGeneral);
    this.render(); // Refresh to update visual state
  });
}
```

**Step 4: Add CSS styling for focus items**

In `styles.css`, add:

```css
.sphere-action-in-focus {
  background-color: var(--interactive-accent);
  opacity: 0.15;
}

.sphere-action-in-focus:hover {
  opacity: 0.25;
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- sphere-view.test.ts -t "should apply CSS class to actions in focus"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/sphere-view.ts styles.css tests/sphere-view.test.ts
git commit -m "feat: add visual indicators for focus items in sphere view"
```

---

## Task 4: Reduce Button Spacing for Compact Layout

**Files:**

- Modify: `styles.css`

**Step 1: Identify current button padding**

Review `styles.css` for `.sphere-action` button styling. Look for padding values.

**Step 2: Reduce vertical and horizontal padding**

In `styles.css`, update `.sphere-action` button styles:

```css
.sphere-action {
  padding: 2px 8px; /* Reduced from likely 8px 12px or similar */
  margin-bottom: 2px; /* Reduce spacing between buttons */
  cursor: pointer;
  border: none;
  background: transparent;
  text-align: left;
  width: 100%;
  font-size: inherit;
  font-family: inherit;
}

.sphere-action:hover {
  background-color: var(--background-modifier-hover);
}
```

**Step 3: Visual verification**

Manual test:

1. Run `npm run dev`
2. Open Obsidian
3. Open a sphere view
4. Verify actions are more compact
5. Verify focus items have subtle background
6. Verify hover states work correctly

**Step 4: Commit**

```bash
git add styles.css
git commit -m "style: reduce button padding for more compact sphere view"
```

---

## Task 5: Update and Clean Up Tests

**Files:**

- Modify: `tests/sphere-view.test.ts`

**Step 1: Remove planning mode tests**

In `tests/sphere-view.test.ts`, delete all tests related to:

- Planning mode toggle button
- Planning mode state changes
- Conditional click behavior based on planning mode

**Step 2: Add test for toggle behavior (add then remove)**

```typescript
it("should toggle focus item off when clicked again", async () => {
  const mockApp = createMockApp();
  const mockPlugin = createMockPlugin();
  mockPlugin.settings.focusItems = [];

  const view = new SphereView(mockApp, mockPlugin, "work");
  await view.render();

  const actionButton = view.containerEl.querySelector(".sphere-action") as HTMLElement;

  // First click: add to focus
  actionButton.click();
  expect(mockPlugin.settings.focusItems.length).toBe(1);

  await view.render(); // Re-render to update state

  // Second click: remove from focus
  actionButton.click();
  expect(mockPlugin.settings.focusItems.length).toBe(0);
});
```

**Step 3: Run all sphere view tests**

Run: `npm test -- sphere-view.test.ts`
Expected: All tests PASS

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS, coverage >= 80%

**Step 5: Commit**

```bash
git add tests/sphere-view.test.ts
git commit -m "test: update sphere view tests for always-on focus toggle"
```

---

## Task 6: Final Verification

**Files:**

- All modified files

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run full test suite with coverage**

Run: `npm run test:coverage`
Expected: All tests pass, coverage >= 80%

**Step 3: Manual testing checklist**

1. Open sphere view (work, personal, etc.)
2. Verify no planning mode toggle button appears
3. Click an action → verify it appears in focus view
4. Verify action has subtle background color in sphere view
5. Click same action again → verify it's removed from focus
6. Verify background color disappears
7. Verify actions are visually more compact than before
8. Test in both light and dark themes
9. Verify hover states work correctly

**Step 4: Final commit if any fixes needed**

If manual testing revealed issues:

```bash
git add <files>
git commit -m "fix: address issues found in manual testing"
```

**Step 5: Verification complete**

Manual verification passed. Implementation complete.

---

## Notes

- **CSS Customization:** The `var(--interactive-accent)` with opacity may look different in various Obsidian themes. If Ben wants a specific color, we can hard-code RGB values instead.
- **Performance:** Full re-render on each click is simple and should be fast enough. If performance becomes an issue, could optimize to only update specific DOM elements.
- **Focus Validation:** Existing `FocusValidator` handles cases where actions move in source files. No changes needed there.
