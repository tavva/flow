# Focus Archive Links Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add wikilinks to archived focus items linking back to source files.

**Architecture:** Modify `archiveClearedTasks()` formatting logic to generate wikilinks from file paths. Project items format as `- [[path]] text`, general actions format as `- [[Next actions|text]]`.

**Tech Stack:** TypeScript, Jest

---

## Task 1: Update existing test to expect wikilinks

**Files:**

- Modify: `tests/focus-auto-clear.test.ts:232-280`

**Step 1: Update test to expect new wikilink format**

In the test "strips checkbox markers from archived items", change the expectations to verify wikilinks are present:

```typescript
const createdContent = mockVault.create.mock.calls[0][1];

// Should contain wikilinks to source files
expect(createdContent).toContain("- [[Projects/Test]] Do something important");
expect(createdContent).toContain("- [[Projects/Test]] Already completed");
expect(createdContent).toContain("- [[Next actions|Waiting for response]]");

// Should NOT contain checkbox markers
expect(createdContent).not.toContain("- [ ]");
expect(createdContent).not.toContain("- [x]");
expect(createdContent).not.toContain("- [w]");
```

**Step 2: Run test to verify it fails**

Run: `npm test -- focus-auto-clear.test.ts`
Expected: FAIL - archived content doesn't match expected wikilink format

**Step 3: Commit**

```bash
git add tests/focus-auto-clear.test.ts
git commit -m "test: update archive test to expect wikilinks"
```

---

## Task 2: Implement wikilink formatting

**Files:**

- Modify: `src/focus-auto-clear.ts:80-91`

**Step 1: Replace formatting logic with wikilink generation**

Replace the map function at lines 85-90:

```typescript
tasksContent =
  items
    .map((item) => {
      const wikilinkPath = item.file.replace(/\.md$/, "");

      if (item.isGeneral) {
        return `- [[Next actions|${item.text}]]`;
      } else {
        return `- [[${wikilinkPath}]] ${item.text}`;
      }
    })
    .join("\n") + "\n\n";
```

**Step 2: Run test to verify it passes**

Run: `npm test -- focus-auto-clear.test.ts`
Expected: PASS - all tests green

**Step 3: Run full test suite**

Run: `npm test`
Expected: All 551 tests pass

**Step 4: Commit**

```bash
git add src/focus-auto-clear.ts
git commit -m "feat: add wikilinks to archived focus items"
```

---

## Task 3: Add comprehensive test for general vs project formatting

**Files:**

- Modify: `tests/focus-auto-clear.test.ts` (add after line 280)

**Step 1: Write failing test for mixed general and project items**

Add new test case:

```typescript
it("formats general actions with display text and projects with file links", async () => {
  const items: FocusItem[] = [
    {
      file: "Projects/Work Project.md",
      lineNumber: 15,
      lineContent: "- [ ] Review design document",
      text: "Review design document",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    },
    {
      file: "Next actions.md",
      lineNumber: 8,
      lineContent: "- [ ] Call dentist",
      text: "Call dentist",
      sphere: "personal",
      isGeneral: true,
      addedAt: Date.now(),
    },
    {
      file: "Projects/Health/Annual Checkup.md",
      lineNumber: 20,
      lineContent: "- [ ] Schedule appointment",
      text: "Schedule appointment",
      sphere: "personal",
      isGeneral: false,
      addedAt: Date.now(),
    },
  ];

  const archiveFilePath = "Archive.md";
  const clearTime = new Date("2025-10-27T03:00:00");
  mockVault.getAbstractFileByPath.mockReturnValue(null);

  await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

  const createdContent = mockVault.create.mock.calls[0][1];

  // Project items should have file link before text
  expect(createdContent).toContain("- [[Projects/Work Project]] Review design document");
  expect(createdContent).toContain("- [[Projects/Health/Annual Checkup]] Schedule appointment");

  // General actions should use display text format
  expect(createdContent).toContain("- [[Next actions|Call dentist]]");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- focus-auto-clear.test.ts -t "formats general actions"`
Expected: PASS - implementation already handles this

**Step 3: Commit**

```bash
git add tests/focus-auto-clear.test.ts
git commit -m "test: add comprehensive test for general vs project formatting"
```

---

## Task 4: Add edge case test for files without .md extension

**Files:**

- Modify: `tests/focus-auto-clear.test.ts` (add after previous test)

**Step 1: Write test for edge case**

Add new test case:

```typescript
it("handles files without .md extension gracefully", async () => {
  const items: FocusItem[] = [
    {
      file: "Projects/README",
      lineNumber: 5,
      lineContent: "- [ ] Update documentation",
      text: "Update documentation",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    },
  ];

  const archiveFilePath = "Archive.md";
  const clearTime = new Date("2025-10-27T03:00:00");
  mockVault.getAbstractFileByPath.mockReturnValue(null);

  await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

  const createdContent = mockVault.create.mock.calls[0][1];

  // Should create wikilink even without .md extension
  expect(createdContent).toContain("- [[Projects/README]] Update documentation");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- focus-auto-clear.test.ts -t "handles files without"`
Expected: PASS - `.replace(/\.md$/, "")` handles this correctly (no match = no change)

**Step 3: Run full test suite to ensure no regressions**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/focus-auto-clear.test.ts
git commit -m "test: verify handling of files without .md extension"
```

---

## Task 5: Verify integration and finalize

**Step 1: Run full test suite with coverage**

Run: `npm run test:coverage`
Expected: All tests pass, coverage thresholds met (≥80%)

**Step 2: Build the plugin**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Create final commit if any changes needed**

If any fixes were required during verification:

```bash
git add .
git commit -m "fix: address verification issues"
```

---

## Completion Checklist

- [ ] All tests pass (551 tests)
- [ ] Test coverage maintained (≥80%)
- [ ] Build succeeds
- [ ] Commits follow conventional commit format
- [ ] All changes committed to feature branch
- [ ] Ready for code review
