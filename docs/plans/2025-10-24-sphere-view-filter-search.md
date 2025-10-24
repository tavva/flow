# Sphere View Filter Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add filter-as-you-type search to sphere view for finding actions and projects by name.

**Architecture:** Simple filter-on-render approach - add search state to SphereView component, filter data before rendering, sticky header with search input and keyboard shortcuts (Cmd/Ctrl+F, Escape).

**Tech Stack:** TypeScript, Obsidian API, Jest for testing

---

## Task 1: Add CSS Styles for Search UI

**Files:**
- Modify: `styles.css` (add new styles at end)

**Step 1: Add CSS for sticky header and search input**

Add to end of `styles.css`:

```css
/* Sphere View Filter Search */
.flow-gtd-sphere-sticky-header {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 10;
  padding: 12px 0;
  border-bottom: 1px solid var(--background-modifier-border);
  margin-bottom: 16px;
}

.flow-gtd-sphere-title {
  margin: 0 0 12px 0;
  font-size: 1.5em;
  font-weight: 600;
}

.flow-gtd-sphere-search-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flow-gtd-sphere-search-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 14px;
}

.flow-gtd-sphere-search-input::placeholder {
  color: var(--text-muted);
}

.flow-gtd-sphere-search-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.flow-gtd-sphere-search-clear {
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.flow-gtd-sphere-search-clear:hover {
  opacity: 1;
  color: var(--text-normal);
}

.flow-gtd-sphere-empty-search {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}
```

**Step 2: Commit CSS changes**

```bash
cd ~/.config/superpowers/worktrees/flow/sphere-view-filter
git add styles.css
git commit -m "feat: add CSS styles for sphere view filter search"
```

---

## Task 2: Add Filter Logic to SphereView

**Files:**
- Modify: `src/sphere-view.ts:28-33` (add searchQuery state)
- Modify: `src/sphere-view.ts:150-161` (update renderContent to use filtered data)

**Step 1: Write failing test for filterData method**

Create test file: `tests/sphere-view-filter.test.ts`

```typescript
import { FlowProject } from "../src/types";

describe("SphereView filtering", () => {
  describe("filterData", () => {
    it("should return all data when query is empty", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Test Project",
              nextActions: ["Action 1", "Action 2"],
              tags: ["project/work"],
              status: "live" as const,
              file: "test.md",
            },
            priority: 1,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: ["General action"],
      };

      // Access private method via any cast for testing
      const view = createMockSphereView();
      const result = (view as any).filterData(data, "");

      expect(result).toEqual(data);
    });

    it("should filter projects by action text (case-insensitive)", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Project One",
              nextActions: ["Call dentist", "Email client"],
              tags: ["project/work"],
              status: "live" as const,
              file: "one.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Project Two",
              nextActions: ["Review code", "Write tests"],
              tags: ["project/work"],
              status: "live" as const,
              file: "two.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "DENTIST");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Project One");
      expect(result.projects[0].project.nextActions).toEqual(["Call dentist"]);
    });

    it("should filter projects by project name", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Marketing Campaign",
              nextActions: ["Create landing page"],
              tags: ["project/work"],
              status: "live" as const,
              file: "marketing.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Engineering Sprint",
              nextActions: ["Fix bug"],
              tags: ["project/work"],
              status: "live" as const,
              file: "engineering.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "marketing");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Marketing Campaign");
    });

    it("should filter general actions", () => {
      const data = {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: ["Buy groceries", "Call dentist", "Review email"],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "dentist");

      expect(result.generalNextActions).toEqual(["Call dentist"]);
    });

    it("should not filter projectsNeedingNextActions", () => {
      const needsActions = [
        {
          project: {
            title: "Empty Project",
            nextActions: [],
            tags: ["project/work"],
            status: "live" as const,
            file: "empty.md",
          },
          priority: 1,
          depth: 0,
        },
      ];

      const data = {
        projects: [],
        projectsNeedingNextActions: needsActions,
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "something");

      expect(result.projectsNeedingNextActions).toEqual(needsActions);
    });
  });
});

// Helper to create mock SphereView for testing
function createMockSphereView() {
  const mockLeaf = {} as any;
  const mockSettings = {
    nextActionsFilePath: "Next actions.md",
    hotlist: [],
  } as any;
  const mockSaveSettings = jest.fn();

  // Import SphereView and create instance
  const { SphereView } = require("../src/sphere-view");
  return new SphereView(mockLeaf, "work", mockSettings, mockSaveSettings);
}
```

**Step 2: Run test to verify it fails**

```bash
cd ~/.config/superpowers/worktrees/flow/sphere-view-filter
npm test -- sphere-view-filter.test
```

Expected: FAIL - `filterData` method doesn't exist

**Step 3: Add searchQuery state and filterData method to SphereView**

In `src/sphere-view.ts`, after line 33 (after `private saveSettings`), add:

```typescript
  private searchQuery: string = "";
```

Then add the `filterData` method before the `renderContent` method (around line 149):

```typescript
  private filterData(data: SphereViewData, query: string): SphereViewData {
    // Empty query = no filtering
    if (!query.trim()) {
      return data;
    }

    const lowerQuery = query.toLowerCase();
    const matches = (text: string) => text.toLowerCase().includes(lowerQuery);

    // Filter projects: include if name matches OR has matching actions
    const filteredProjects = data.projects
      .map((summary) => {
        const filteredActions =
          summary.project.nextActions?.filter((action) => matches(action)) || [];

        const includeProject =
          matches(summary.project.title) || filteredActions.length > 0;

        if (!includeProject) return null;

        return {
          ...summary,
          project: {
            ...summary.project,
            nextActions: filteredActions,
          },
        };
      })
      .filter((p): p is SphereProjectSummary => p !== null);

    // Filter general actions
    const filteredGeneralActions = data.generalNextActions.filter((action) =>
      matches(action)
    );

    return {
      projects: filteredProjects,
      projectsNeedingNextActions: data.projectsNeedingNextActions, // Not filtered
      generalNextActions: filteredGeneralActions,
      generalNextActionsNotice: data.generalNextActionsNotice,
    };
  }
```

**Step 4: Run test to verify it passes**

```bash
npm test -- sphere-view-filter.test
```

Expected: PASS - all filterData tests pass

**Step 5: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view-filter.test.ts
git commit -m "feat: add filterData method to SphereView"
```

---

## Task 3: Add Search Header UI

**Files:**
- Modify: `src/sphere-view.ts:150-161` (update renderContent)

**Step 1: Write test for search header rendering**

Add to `tests/sphere-view-filter.test.ts`:

```typescript
describe("Search UI rendering", () => {
  it("should render sticky header with sphere name and search input", () => {
    const { SphereView } = require("../src/sphere-view");
    const mockLeaf = { containerEl: { children: [null, document.createElement("div")] } } as any;
    const mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
      },
    } as any;
    mockLeaf.app = mockApp;

    const mockSettings = {
      nextActionsFilePath: "Next actions.md",
      hotlist: [],
    } as any;
    const mockSaveSettings = jest.fn();

    const view = new SphereView(mockLeaf, "work", mockSettings, mockSaveSettings);
    view.app = mockApp;

    const container = document.createElement("div");
    const data = {
      projects: [],
      projectsNeedingNextActions: [],
      generalNextActions: [],
    };

    (view as any).renderContent(container, data);

    const header = container.querySelector(".flow-gtd-sphere-sticky-header");
    expect(header).toBeTruthy();

    const title = container.querySelector(".flow-gtd-sphere-title");
    expect(title?.textContent).toBe("Work");

    const searchInput = container.querySelector(".flow-gtd-sphere-search-input") as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(searchInput.placeholder).toBe("Filter actions and projects...");
  });

  it("should show clear button only when query is non-empty", () => {
    const { SphereView } = require("../src/sphere-view");
    const mockLeaf = { containerEl: { children: [null, document.createElement("div")] } } as any;
    const mockApp = { vault: { getAbstractFileByPath: jest.fn(), read: jest.fn() } } as any;
    mockLeaf.app = mockApp;

    const view = new SphereView(mockLeaf, "work", {} as any, jest.fn());
    view.app = mockApp;

    const container = document.createElement("div");
    (view as any).renderContent(container, { projects: [], projectsNeedingNextActions: [], generalNextActions: [] });

    const clearButton = container.querySelector(".flow-gtd-sphere-search-clear") as HTMLElement;
    expect(clearButton.style.display).toBe("none");

    // Set query and re-render
    (view as any).searchQuery = "test";
    container.innerHTML = "";
    (view as any).renderContent(container, { projects: [], projectsNeedingNextActions: [], generalNextActions: [] });

    const clearButtonVisible = container.querySelector(".flow-gtd-sphere-search-clear") as HTMLElement;
    expect(clearButtonVisible.style.display).not.toBe("none");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- sphere-view-filter.test
```

Expected: FAIL - search header elements not found

**Step 3: Add renderSearchHeader method**

In `src/sphere-view.ts`, add method before `renderContent`:

```typescript
  private renderSearchHeader(container: HTMLElement): HTMLInputElement {
    const header = container.createDiv({ cls: "flow-gtd-sphere-sticky-header" });

    // Sphere title
    const titleEl = header.createEl("h2", { cls: "flow-gtd-sphere-title" });
    titleEl.setText(this.getDisplaySphereName());

    // Search container
    const searchContainer = header.createDiv({ cls: "flow-gtd-sphere-search-container" });

    // Search input
    const searchInput = searchContainer.createEl("input", {
      cls: "flow-gtd-sphere-search-input",
      type: "text",
      placeholder: "Filter actions and projects...",
    });
    searchInput.value = this.searchQuery;

    // Clear button
    const clearButton = searchContainer.createEl("span", {
      cls: "flow-gtd-sphere-search-clear",
      text: "✕",
    });
    clearButton.style.display = this.searchQuery ? "" : "none";

    // Input event handler
    searchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      clearButton.style.display = this.searchQuery ? "" : "none";
      this.refresh();
    });

    // Clear button handler
    clearButton.addEventListener("click", () => {
      this.searchQuery = "";
      searchInput.value = "";
      clearButton.style.display = "none";
      searchInput.focus();
      this.refresh();
    });

    return searchInput;
  }

  private async refresh(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    const data = await this.loadSphereData();
    this.renderContent(container, data);
  }
```

**Step 4: Update renderContent to use search header**

Replace the `renderContent` method (around line 150):

```typescript
  private renderContent(container: HTMLElement, data: SphereViewData) {
    // Render sticky header with search
    const searchInput = this.renderSearchHeader(container);

    // Filter data based on search query
    const filteredData = this.filterData(data, this.searchQuery);

    // Render filtered sections
    this.renderProjectsNeedingActionsSection(container, filteredData.projectsNeedingNextActions);
    this.renderProjectsSection(container, filteredData.projects);
    this.renderGeneralNextActionsSection(
      container,
      filteredData.generalNextActions,
      filteredData.generalNextActionsNotice
    );

    // Show empty state if query exists but no results
    if (this.searchQuery.trim() &&
        filteredData.projects.length === 0 &&
        filteredData.generalNextActions.length === 0) {
      const emptyEl = container.createDiv({ cls: "flow-gtd-sphere-empty-search" });
      emptyEl.setText(`No actions or projects match '${this.searchQuery}'`);
    }
  }
```

Also remove the old title rendering from renderContent (the `titleEl` lines were moved to renderSearchHeader).

**Step 5: Run test to verify it passes**

```bash
npm test -- sphere-view-filter.test
```

Expected: PASS - search header renders correctly

**Step 6: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view-filter.test.ts
git commit -m "feat: add search header UI to sphere view"
```

---

## Task 4: Add Keyboard Shortcuts

**Files:**
- Modify: `src/sphere-view.ts` (add keyboard shortcut handling)

**Step 1: Write test for keyboard shortcuts**

Add to `tests/sphere-view-filter.test.ts`:

```typescript
describe("Keyboard shortcuts", () => {
  it("should focus search input on Cmd/Ctrl+F", () => {
    const { SphereView } = require("../src/sphere-view");
    const mockLeaf = { containerEl: { children: [null, document.createElement("div")] } } as any;
    const mockApp = { vault: { getAbstractFileByPath: jest.fn(), read: jest.fn() } } as any;
    mockLeaf.app = mockApp;

    const view = new SphereView(mockLeaf, "work", {} as any, jest.fn());
    view.app = mockApp;

    const container = document.createElement("div");
    (view as any).renderContent(container, { projects: [], projectsNeedingNextActions: [], generalNextActions: [] });

    const searchInput = container.querySelector(".flow-gtd-sphere-search-input") as HTMLInputElement;

    // Simulate Cmd+F (Mac) or Ctrl+F (Windows/Linux)
    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true, // Cmd on Mac
      bubbles: true,
    });

    container.dispatchEvent(event);
    expect(document.activeElement).toBe(searchInput);
  });

  it("should clear search on Escape", () => {
    const { SphereView } = require("../src/sphere-view");
    const mockLeaf = { containerEl: { children: [null, document.createElement("div")] } } as any;
    const mockApp = { vault: { getAbstractFileByPath: jest.fn(), read: jest.fn() } } as any;
    mockLeaf.app = mockApp;

    const view = new SphereView(mockLeaf, "work", {} as any, jest.fn());
    view.app = mockApp;
    (view as any).searchQuery = "test query";

    const container = document.createElement("div");
    (view as any).renderContent(container, { projects: [], projectsNeedingNextActions: [], generalNextActions: [] });

    const searchInput = container.querySelector(".flow-gtd-sphere-search-input") as HTMLInputElement;

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    searchInput.dispatchEvent(event);
    expect((view as any).searchQuery).toBe("");
    expect(searchInput.value).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- sphere-view-filter.test
```

Expected: FAIL - keyboard shortcuts not working

**Step 3: Add keyboard shortcut handling**

In `src/sphere-view.ts`, add method after `renderSearchHeader`:

```typescript
  private setupKeyboardShortcuts(container: HTMLElement, searchInput: HTMLInputElement): void {
    // Cmd/Ctrl+F to focus search
    const handleContainerKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInput.focus();
      }
    };

    container.addEventListener("keydown", handleContainerKeydown);

    // Escape to clear search
    const handleInputKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.searchQuery = "";
        searchInput.value = "";
        const clearButton = container.querySelector(".flow-gtd-sphere-search-clear") as HTMLElement;
        if (clearButton) {
          clearButton.style.display = "none";
        }
        this.refresh();
      }
    };

    searchInput.addEventListener("keydown", handleInputKeydown);
  }
```

**Step 4: Update renderContent to setup keyboard shortcuts**

In `renderContent`, after rendering the search header, add:

```typescript
  private renderContent(container: HTMLElement, data: SphereViewData) {
    // Render sticky header with search
    const searchInput = this.renderSearchHeader(container);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts(container, searchInput);

    // ... rest of method
  }
```

**Step 5: Run test to verify it passes**

```bash
npm test -- sphere-view-filter.test
```

Expected: PASS - keyboard shortcuts work

**Step 6: Commit**

```bash
git add src/sphere-view.ts tests/sphere-view-filter.test.ts
git commit -m "feat: add keyboard shortcuts (Cmd/Ctrl+F, Escape) for search"
```

---

## Task 5: Verify All Tests Pass

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All 500+ tests pass (including new sphere-view-filter tests)

**Step 2: Run build to check TypeScript compilation**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 3: If any failures, fix them before proceeding**

Address any test failures or build errors. Each fix should be a separate commit.

**Step 4: Final commit if fixes were needed**

```bash
git add .
git commit -m "fix: address test failures and build errors"
```

---

## Task 6: Manual Testing in Obsidian

**Step 1: Build the plugin**

```bash
npm run build
```

**Step 2: Test in vault**

Open Obsidian with the Flow plugin loaded from the worktree directory. Test:

1. Open a sphere view (work, personal, etc.)
2. Verify sticky header shows sphere name and search input
3. Type in search - verify instant filtering
4. Test project name matching
5. Test action text matching
6. Test clear button (X)
7. Test Cmd/Ctrl+F keyboard shortcut
8. Test Escape key to clear
9. Verify empty state message when no results
10. Verify hotlist operations work on filtered results
11. Verify hierarchy preserved when filtering
12. Verify waiting-for items (🕐) searchable

**Step 3: Document any issues found**

Create GitHub issues or fix immediately depending on severity.

---

## Task 7: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (add search feature documentation)

**Step 1: Add search documentation to CLAUDE.md**

In the "Sphere View" section of `CLAUDE.md`, add:

```markdown
### Sphere View Filter Search

The sphere view includes filter-as-you-type search:

- **Search input:** Sticky header below sphere name, filters as you type
- **Matches:** Action text and project names (case-insensitive substring)
- **Keyboard shortcuts:**
  - Cmd/Ctrl+F: Focus search input
  - Escape: Clear search query
- **Behaviour:**
  - Instant filtering on every keystroke
  - Projects shown if name matches OR has matching actions
  - Hierarchy preserved (sub-project matches show parents)
  - Empty state when no matches found
  - Search clears on view refresh
```

**Step 2: Commit documentation**

```bash
git add CLAUDE.md
git commit -m "docs: add sphere view filter search documentation"
```

---

## Completion Checklist

Before marking complete:

- [ ] All new tests pass
- [ ] Full test suite passes (500+ tests)
- [ ] Build succeeds with no TypeScript errors
- [ ] Manual testing completed in Obsidian
- [ ] Documentation updated in CLAUDE.md
- [ ] All commits follow conventional commit format
- [ ] Feature works as designed (sticky header, instant filter, keyboard shortcuts)
- [ ] No console errors or warnings
- [ ] Search clears on view refresh (not persisted)

---

## Notes for Implementer

**TDD Discipline:**
- Write test first, watch it fail, implement minimal code, watch it pass
- One commit per passing test (or logical group)
- Don't skip the "watch it fail" step - ensures test actually validates

**YAGNI:**
- No debouncing in v1 (can add later if needed)
- No text highlighting (future enhancement)
- No regex support (simple substring only)

**DRY:**
- Reuse existing hierarchy building logic
- Reuse existing action rendering logic
- Don't duplicate filtering code

**Testing:**
- Test both the filterData logic and UI rendering
- Use mock data for unit tests
- Manual testing required for keyboard shortcuts and UX

**Skills References:**
- @superpowers:test-driven-development - Follow RED-GREEN-REFACTOR
- @superpowers:verification-before-completion - Run full suite before claiming done
