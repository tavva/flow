# Context Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GTD context tag filtering (`#context/X`) to all four views (Sphere, Focus, WaitingFor, Someday).

**Architecture:** Extract `#context/X` tags from action lines at scan time, store on item data structures, and add multi-select toggle filter UI to each view following the existing sphere filter pattern.

**Tech Stack:** TypeScript, Obsidian API, Jest

---

## Task 1: Context tag extraction utility

**Files:**
- Create: `src/context-tags.ts`
- Test: `tests/context-tags.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/context-tags.test.ts
// ABOUTME: Tests for context tag extraction from action line text.
// ABOUTME: Validates parsing of #context/X tags from various line formats.

import { extractContexts } from "../src/context-tags";

describe("extractContexts", () => {
  it("extracts a single context tag", () => {
    expect(extractContexts("Call dentist #context/phone")).toEqual(["phone"]);
  });

  it("extracts multiple context tags", () => {
    expect(extractContexts("Check email #context/computer #context/office")).toEqual([
      "computer",
      "office",
    ]);
  });

  it("returns empty array when no context tags", () => {
    expect(extractContexts("Buy milk and eggs")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(extractContexts("Task #Context/Phone")).toEqual(["phone"]);
  });

  it("ignores sphere tags", () => {
    expect(extractContexts("Task #sphere/work #context/phone")).toEqual(["phone"]);
  });

  it("handles context tag at start of text", () => {
    expect(extractContexts("#context/home clean kitchen")).toEqual(["home"]);
  });

  it("handles hyphenated context names", () => {
    expect(extractContexts("Task #context/at-computer")).toEqual(["at-computer"]);
  });

  it("deduplicates repeated contexts", () => {
    expect(extractContexts("Task #context/phone #context/phone")).toEqual(["phone"]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- context-tags`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/context-tags.ts
// ABOUTME: Extracts GTD context tags (#context/X) from action line text.
// ABOUTME: Used by scanners and views for context-based filtering.

const CONTEXT_TAG_PATTERN = /#context\/([^\s]+)/gi;

export function extractContexts(text: string): string[] {
  const contexts: string[] = [];
  let match;

  while ((match = CONTEXT_TAG_PATTERN.exec(text)) !== null) {
    const context = match[1].toLowerCase();
    if (!contexts.includes(context)) {
      contexts.push(context);
    }
  }

  // Reset lastIndex since we're using a global regex
  CONTEXT_TAG_PATTERN.lastIndex = 0;

  return contexts;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- context-tags`
Expected: PASS

**Step 5: Commit**

```bash
git add src/context-tags.ts tests/context-tags.test.ts
git commit -m "Add context tag extraction utility"
```

---

## Task 2: Add contexts to WaitingForItem

**Files:**
- Modify: `src/waiting-for-scanner.ts` (WaitingForItem interface + extractContexts calls)
- Modify: `tests/waiting-for-scanner.test.ts`

**Step 1: Write failing tests**

Add to `tests/waiting-for-scanner.test.ts`:

```typescript
test("should extract context tags from waiting-for items", async () => {
  const mockFile = Object.create(TFile.prototype);
  mockFile.path = "Projects/Project A.md";
  mockFile.basename = "Project A";

  mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
  mockVault.getAbstractFileByPath.mockImplementation((path) => {
    if (path === "Projects/Project A.md") return mockFile;
    return null;
  });
  mockVault.read.mockResolvedValue(
    "---\ntags: project/work\n---\n\n## Next actions\n\n- [w] Chase invoice from supplier #context/phone\n"
  );

  mockMetadataCache.getFileCache.mockReturnValue({
    frontmatter: { tags: ["project/work"] },
    listItems: [{ position: { start: { line: 6 } } }],
  } as any);

  const items = await scanner.scanWaitingForItems();

  expect(items).toHaveLength(1);
  expect(items[0].contexts).toEqual(["phone"]);
});

test("should return empty contexts array when no context tags", async () => {
  const mockFile = Object.create(TFile.prototype);
  mockFile.path = "Projects/Project A.md";
  mockFile.basename = "Project A";

  mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
  mockVault.getAbstractFileByPath.mockImplementation((path) => {
    if (path === "Projects/Project A.md") return mockFile;
    return null;
  });
  mockVault.read.mockResolvedValue(
    "---\ntags: project/work\n---\n\n## Next actions\n\n- [w] Plain waiting item\n"
  );

  mockMetadataCache.getFileCache.mockReturnValue({
    frontmatter: { tags: ["project/work"] },
    listItems: [{ position: { start: { line: 6 } } }],
  } as any);

  const items = await scanner.scanWaitingForItems();

  expect(items).toHaveLength(1);
  expect(items[0].contexts).toEqual([]);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- waiting-for-scanner`
Expected: FAIL — `contexts` property missing from items

**Step 3: Implement**

In `src/waiting-for-scanner.ts`:

1. Add import: `import { extractContexts } from "./context-tags";`
2. Add `contexts: string[]` to `WaitingForItem` interface
3. In `scanWithDataview` method, add `contexts: extractContexts(lineContent)` to the pushed item (around line 100-107)
4. In `scanFile` method, add `contexts: extractContexts(line)` to the pushed item (around line 144-151)

**Step 4: Run tests to verify they pass**

Run: `npm test -- waiting-for-scanner`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: Some tests may fail if they assert on WaitingForItem shape without `contexts`. Fix any failing tests by adding `contexts: []` to expected items.

**Step 6: Commit**

```bash
git add src/waiting-for-scanner.ts tests/waiting-for-scanner.test.ts
git commit -m "Add context tag extraction to WaitingForScanner"
```

---

## Task 3: Add contexts to SomedayItem

**Files:**
- Modify: `src/someday-scanner.ts` (SomedayItem interface + extractContexts calls)
- Create: `tests/someday-scanner.test.ts` (there is no existing test file)

**Step 1: Write failing tests**

Create `tests/someday-scanner.test.ts` with tests for context extraction from someday items. Follow the pattern from `tests/waiting-for-scanner.test.ts` — mock App, Vault, MetadataCache, create a SomedayScanner, verify `contexts` field is populated.

Key test cases:
- Item with context tag → `contexts: ["phone"]`
- Item without context tag → `contexts: []`
- Item with multiple context tags → `contexts: ["phone", "computer"]`

**Step 2: Run tests to verify they fail**

Run: `npm test -- someday-scanner`
Expected: FAIL

**Step 3: Implement**

In `src/someday-scanner.ts`:

1. Add import: `import { extractContexts } from "./context-tags";`
2. Add `contexts: string[]` to `SomedayItem` interface
3. In `scanSomedayFile` method, add `contexts: extractContexts(line)` to the pushed item (around line 90-97)

**Step 4: Run tests to verify they pass**

Run: `npm test -- someday-scanner`
Expected: PASS

**Step 5: Run full test suite to check for breakage**

Run: `npm test`

**Step 6: Commit**

```bash
git add src/someday-scanner.ts tests/someday-scanner.test.ts
git commit -m "Add context tag extraction to SomedayScanner"
```

---

## Task 4: Add contexts to FocusItem and persistence

**Files:**
- Modify: `src/types/domain.ts` (FocusItem interface)
- Modify: `src/focus-persistence.ts` (default `contexts` to `[]` on load)
- Modify: `tests/focus-persistence.test.ts`

**Step 1: Write failing tests**

Add to `tests/focus-persistence.test.ts`:

```typescript
it("defaults contexts to empty array when loading items without contexts field", async () => {
  const itemWithoutContexts = {
    file: "Projects/Test.md",
    lineNumber: 10,
    lineContent: "- [ ] Task 1",
    text: "Task 1",
    sphere: "work",
    isGeneral: false,
    addedAt: 1700000000000,
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  mockVault.read.mockResolvedValue(JSON.stringify(itemWithoutContexts));

  const result = await loadFocusItems(mockVault);

  expect(result).toHaveLength(1);
  expect(result[0].contexts).toEqual([]);
});

it("preserves contexts when loading items with contexts field", async () => {
  const itemWithContexts = {
    file: "Projects/Test.md",
    lineNumber: 10,
    lineContent: "- [ ] Call dentist #context/phone",
    text: "Call dentist #context/phone",
    sphere: "work",
    isGeneral: false,
    addedAt: 1700000000000,
    contexts: ["phone"],
  };

  const mockFile = new TFile();
  mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
  mockVault.read.mockResolvedValue(JSON.stringify(itemWithContexts));

  const result = await loadFocusItems(mockVault);

  expect(result).toHaveLength(1);
  expect(result[0].contexts).toEqual(["phone"]);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- focus-persistence`
Expected: FAIL — `contexts` property missing

**Step 3: Implement**

In `src/types/domain.ts`, add to FocusItem interface:
```typescript
contexts?: string[]; // GTD context tags (#context/X) from the action line
```

In `src/focus-persistence.ts`, in the `parseJsonlFormat` function, after parsing each item add a default:
```typescript
// After JSON.parse(trimmed) in parseJsonlFormat:
const item: FocusItem = JSON.parse(trimmed);
if (!item.contexts) {
  item.contexts = [];
}
items.push(item);
```

Do the same in `parseLegacyFormat` — iterate items and default `contexts` to `[]`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- focus-persistence`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: PASS (FocusItem has optional `contexts` so existing code won't break)

**Step 6: Commit**

```bash
git add src/types/domain.ts src/focus-persistence.ts tests/focus-persistence.test.ts
git commit -m "Add contexts field to FocusItem with backwards-compatible persistence"
```

---

## Task 5: Populate contexts when adding to focus from SphereView

**Files:**
- Modify: `src/sphere-view.ts` (addToFocus method)

**Step 1: Write the change**

In `src/sphere-view.ts`, in the `addToFocus` method (around line 817-847):

1. Add import: `import { extractContexts } from "./context-tags";`
2. When constructing the FocusItem, add: `contexts: extractContexts(lineContent)`

The `addToFocus` method already has `lineContent` as a parameter, so extraction is straightforward.

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/sphere-view.ts
git commit -m "Populate context tags when adding actions to focus"
```

---

## Task 6: Context filter UI for WaitingForView

**Files:**
- Modify: `src/waiting-for-view.ts`

This task follows the existing sphere filter pattern in the same file.

**Step 1: Add state**

Add to the class:
```typescript
private selectedContexts: string[] = [];
```

**Step 2: Persist state**

Update `getState()` to include `selectedContexts`.
Update `setState()` to restore `selectedContexts`.

**Step 3: Add context discovery**

Add method to discover unique contexts from items:
```typescript
private discoverContexts(items: WaitingForItem[]): string[] {
  const contexts = new Set<string>();
  for (const item of items) {
    for (const context of item.contexts) {
      contexts.add(context);
    }
  }
  return Array.from(contexts).sort();
}
```

**Step 4: Add context filter rendering**

Add `renderContextFilter(container, items)` method — follows same pattern as `renderSphereFilter` but uses discovered contexts from items rather than `settings.spheres`. CSS class: `flow-gtd-context-buttons` for the container, `flow-gtd-context-button` for each button.

**Step 5: Add context filtering logic**

Add `filterItemsByContext(items)` method:
- If no contexts selected (`selectedContexts.length === 0`), return all items
- Otherwise, return items where at least one context matches selectedContexts
- Items with no contexts are hidden when any context filter is active

**Step 6: Wire into renderContent**

In `renderContent`, after `renderSphereFilter(container)`:
1. Call `renderContextFilter(container, items)` (pass unfiltered items so all contexts are discoverable)
2. Chain filtering: `const filteredItems = this.filterItemsByContext(this.filterItemsBySphere(items))`

**Step 7: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 8: Commit**

```bash
git add src/waiting-for-view.ts
git commit -m "Add context tag filter to WaitingForView"
```

---

## Task 7: Context filter UI for SomedayView

**Files:**
- Modify: `src/someday-view.ts`

Same pattern as Task 6 but for SomedayView. Note: SomedayView has both items and projects. Context tags only exist on items (per design), so the context filter only applies to the items section. Projects section remains filtered by sphere only.

**Step 1-6: Follow same pattern as Task 6**

Key difference: `filterItemsByContext` applies to `SomedayItem[]` only, not to `SomedayProject[]`.

In `renderContent`:
```typescript
const filteredItems = this.filterItemsByContext(this.filterItemsBySphere(data.items));
const filteredProjects = this.filterProjectsBySphere(data.projects);
```

**Step 7: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 8: Commit**

```bash
git add src/someday-view.ts
git commit -m "Add context tag filter to SomedayView"
```

---

## Task 8: Context filter UI for FocusView

**Files:**
- Modify: `src/focus-view.ts`

FocusView currently has no filter UI. Add context filter buttons.

**Step 1: Add state**

```typescript
private selectedContexts: string[] = [];
```

**Step 2: Persist state**

Add `getState()` / `setState()` — FocusView currently doesn't have these methods. Add them:
```typescript
getState() {
  return { selectedContexts: this.selectedContexts };
}

async setState(state: { selectedContexts?: string[] }, result: any) {
  if (state?.selectedContexts !== undefined) {
    this.selectedContexts = state.selectedContexts;
  }
  await super.setState(state, result);
}
```

**Step 3: Add context discovery**

```typescript
private discoverContexts(items: FocusItem[]): string[] {
  const contexts = new Set<string>();
  for (const item of items) {
    for (const context of item.contexts || []) {
      contexts.add(context);
    }
  }
  return Array.from(contexts).sort();
}
```

**Step 4: Add context filter rendering and filtering**

Same pattern as WaitingForView. Render after the title element. Filter active (non-completed) items before rendering.

**Step 5: Wire into onOpen and performRefresh**

In `onOpen`, after rendering the title, render context filter then filter items before `renderGroupedItems`.

In `performRefresh`, same — render filter, apply filtering.

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/focus-view.ts
git commit -m "Add context tag filter to FocusView"
```

---

## Task 9: Context filter for SphereView

**Files:**
- Modify: `src/sphere-data-loader.ts` (add context filtering to `filterData`)
- Modify: `src/sphere-view.ts` (add context filter UI and state)
- Modify: `tests/sphere-data-loader.test.ts`

This is the most complex view because actions are plain strings, not typed objects. Context tags are embedded in the action text.

**Step 1: Write failing test for context filtering in SphereDataLoader**

Add to `tests/sphere-data-loader.test.ts`:

```typescript
describe("filterData with contexts", () => {
  it("should filter actions by context tag", () => {
    const loader = new SphereDataLoader(mockApp, "work", {
      nextActionsFilePath: "Next actions.md",
      projectTemplateFilePath: "Templates/Project.md",
    } as any);

    const data: SphereViewData = {
      projects: [
        {
          project: {
            title: "Project A",
            file: "a.md",
            tags: ["project/work"],
            nextActions: [
              "Call dentist #context/phone",
              "Buy supplies #context/errands",
              "Write report",
            ],
          },
          priority: 1,
          depth: 0,
        },
      ],
      projectsNeedingNextActions: [],
      generalNextActions: ["Check voicemail #context/phone", "Clean desk"],
    };

    const result = loader.filterDataByContexts(data, ["phone"]);

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].project.nextActions).toEqual(["Call dentist #context/phone"]);
    expect(result.generalNextActions).toEqual(["Check voicemail #context/phone"]);
  });

  it("should exclude projects with no matching actions", () => {
    const loader = new SphereDataLoader(mockApp, "work", {
      nextActionsFilePath: "Next actions.md",
      projectTemplateFilePath: "Templates/Project.md",
    } as any);

    const data: SphereViewData = {
      projects: [
        {
          project: {
            title: "Project A",
            file: "a.md",
            tags: ["project/work"],
            nextActions: ["Write report", "Review doc"],
          },
          priority: 1,
          depth: 0,
        },
      ],
      projectsNeedingNextActions: [],
      generalNextActions: [],
    };

    const result = loader.filterDataByContexts(data, ["phone"]);

    expect(result.projects).toHaveLength(0);
  });

  it("should return all data when no contexts selected", () => {
    const loader = new SphereDataLoader(mockApp, "work", {
      nextActionsFilePath: "Next actions.md",
      projectTemplateFilePath: "Templates/Project.md",
    } as any);

    const data: SphereViewData = {
      projects: [
        {
          project: {
            title: "Project A",
            file: "a.md",
            tags: ["project/work"],
            nextActions: ["Task 1", "Task 2"],
          },
          priority: 1,
          depth: 0,
        },
      ],
      projectsNeedingNextActions: [],
      generalNextActions: ["General task"],
    };

    const result = loader.filterDataByContexts(data, []);

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].project.nextActions).toHaveLength(2);
    expect(result.generalNextActions).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- sphere-data-loader`
Expected: FAIL — `filterDataByContexts` not found

**Step 3: Implement filterDataByContexts in SphereDataLoader**

Add to `src/sphere-data-loader.ts`:

```typescript
import { extractContexts } from "./context-tags";

// Add new method:
filterDataByContexts(data: SphereViewData, selectedContexts: string[]): SphereViewData {
  if (selectedContexts.length === 0) {
    return data;
  }

  const matchesContext = (action: string) => {
    const contexts = extractContexts(action);
    return contexts.some((c) => selectedContexts.includes(c));
  };

  const filteredProjects = data.projects
    .map((summary) => {
      const filteredActions = summary.project.nextActions?.filter(matchesContext) || [];
      if (filteredActions.length === 0) return null;

      return {
        ...summary,
        project: { ...summary.project, nextActions: filteredActions },
      };
    })
    .filter((p): p is SphereProjectSummary => p !== null);

  const filteredGeneralActions = data.generalNextActions.filter(matchesContext);

  return {
    projects: filteredProjects,
    projectsNeedingNextActions: data.projectsNeedingNextActions,
    generalNextActions: filteredGeneralActions,
    generalNextActionsNotice: data.generalNextActionsNotice,
  };
}
```

Also add a method to discover contexts from the data:

```typescript
discoverContexts(data: SphereViewData): string[] {
  const contexts = new Set<string>();

  for (const summary of data.projects) {
    for (const action of summary.project.nextActions || []) {
      for (const context of extractContexts(action)) {
        contexts.add(context);
      }
    }
  }

  for (const action of data.generalNextActions) {
    for (const context of extractContexts(action)) {
      contexts.add(context);
    }
  }

  return Array.from(contexts).sort();
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- sphere-data-loader`
Expected: PASS

**Step 5: Add context filter UI to SphereView**

In `src/sphere-view.ts`:

1. Add `private selectedContexts: string[] = [];`
2. Update `getState()` to include `selectedContexts`
3. Update `setState()` to restore `selectedContexts`
4. Add `renderContextFilter(container, data)` — render toggle buttons for discovered contexts, placed inside the sticky header controls row
5. Add `toggleContextFilter(context)` method
6. In `renderContent` and `refreshContent`, chain context filtering after text filtering:
   ```typescript
   const textFiltered = this.filterData(data, this.searchQuery);
   const filteredData = this.getDataLoader().filterDataByContexts(textFiltered, this.selectedContexts);
   ```

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/sphere-data-loader.ts src/sphere-view.ts tests/sphere-data-loader.test.ts
git commit -m "Add context tag filter to SphereView"
```

---

## Task 10: CSS for context filter buttons

**Files:**
- Modify: `styles.css` (add styles for context filter buttons)

Add CSS for `.flow-gtd-context-buttons` and `.flow-gtd-context-button` classes. Base these on the existing `.flow-gtd-sphere-buttons` and `.flow-gtd-sphere-button` styles but with a distinct visual treatment (e.g., different accent colour or a tag icon prefix) so users can distinguish context filters from sphere filters.

**Commit**

```bash
git add styles.css
git commit -m "Add CSS for context filter buttons"
```

---

## Task 11: Final verification

**Step 1: Run all checks**

```bash
npm run format
npm run build
npm test
```

**Step 2: Manual testing checklist**

- [ ] Add `#context/phone` to an action line in a project file
- [ ] Verify it appears in SphereView with tag visible
- [ ] Verify context filter button appears in SphereView
- [ ] Click filter button, verify filtering works
- [ ] Add action to focus, verify contexts persist
- [ ] Check FocusView shows context filter
- [ ] Check WaitingForView shows context filter for `[w]` items with context tags
- [ ] Check SomedayView shows context filter
- [ ] Verify filter state persists across view reloads

**Step 3: Commit any final fixes and push**
