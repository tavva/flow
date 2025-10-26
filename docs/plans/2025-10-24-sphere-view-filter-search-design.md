# Sphere View Filter Search - Design Document

**Date:** 2025-10-24
**Status:** Approved for implementation

## Overview

Add a filter-as-you-type search feature to the sphere view that allows users to quickly find specific actions or projects by typing a search query. The search will filter both actions and project names in real-time, making it easier to navigate large lists of projects and next actions.

## User Experience

### UI Structure

```
┌─────────────────────────────────┐
│ Work Sphere                     │ ← Sphere name
│ [Search: ___________] [x clear] │ ← Search input (sticky header)
├─────────────────────────────────┤
│ Projects needing next actions   │
│   Project Name                  │
│                                 │
│ Projects (5 shown, 2 hidden)    │ ← Filtered count
│   ▼ Project Name               │
│      □ Matching action...      │
│                                 │
│ General Actions (3 shown)       │
│   □ Matching action...         │
└─────────────────────────────────┘
```

### Search Input Behaviour

- **Position:** Sticky header below sphere name, always visible when scrolling
- **Placeholder text:** "Filter actions and projects..."
- **Clear button:** X icon appears when query is non-empty, clears search and returns focus
- **Keyboard shortcuts:**
  - Cmd/Ctrl+F: Focus search input when sphere view is active
  - Escape: Clear search query
- **Filtering:** Instant filter on every keystroke (no debouncing in v1)
- **Persistence:** Search clears on view refresh (not persisted)

## Search Behaviour

### What Gets Matched

- **Action text:** Matches the text of next actions (case-insensitive substring)
- **Project names:** Matches project titles (case-insensitive substring)
- **Matching logic:** Simple substring matching (no regex complexity)
- **Case sensitivity:** Case-insensitive throughout

### What Gets Filtered

**Projects section:**

- Show projects that have matching actions OR matching project names
- Within each project, show only actions that match the query
- If a sub-project matches, show its parent projects (preserve hierarchy)
- Hide projects entirely if no matches

**General actions section:**

- Show only actions that match the query

**Projects needing actions section:**

- Not filtered (different purpose - always show all)

### Display Behaviour

**Empty states:**

- Empty query → show everything (current behaviour)
- Query with no matches → show "No actions or projects match 'search term'"

**Hierarchy preservation:**

- Keep parent-child project relationships intact
- Show proper indentation (32px per level)
- If sub-project matches, its parents are visible even if they don't match

**Scroll position:**

- Maintain scroll position when results change
- Don't jump to top on every keystroke

**Hotlist interaction:**

- Filtering is purely based on search text (not hotlist status)
- Actions on hotlist are hidden if they don't match the query
- Only visible (filtered) actions are clickable for hotlist operations
- Checkmark indicators work normally on visible items

**Waiting-for items:**

- Searchable by action text (not the 🕐 emoji)
- Clock emoji preserved in display

## Technical Implementation

### Component Changes (SphereView)

**New state:**

```typescript
private searchQuery: string = "";
```

**New methods:**

```typescript
// Filter data based on search query
private filterData(data: SphereViewData, query: string): SphereViewData

// Render sticky header with search input
private renderSearchHeader(container: HTMLElement): HTMLInputElement

// Handle keyboard shortcuts (Cmd/Ctrl+F, Escape)
private setupKeyboardShortcuts(searchInput: HTMLInputElement): void
```

### Filter Algorithm

```typescript
private filterData(data: SphereViewData, query: string): SphereViewData {
  if (!query.trim()) {
    return data; // Empty query = no filtering
  }

  const lowerQuery = query.toLowerCase();

  // Helper: does text match query?
  const matches = (text: string) => text.toLowerCase().includes(lowerQuery);

  // Filter projects
  const filteredProjects = data.projects
    .map(summary => {
      // Filter this project's actions
      const filteredActions = summary.project.nextActions?.filter(action =>
        matches(action)
      ) || [];

      // Include project if: name matches OR has matching actions
      const includeProject = matches(summary.project.title) || filteredActions.length > 0;

      if (!includeProject) return null;

      // Return project with filtered actions
      return {
        ...summary,
        project: {
          ...summary.project,
          nextActions: filteredActions
        }
      };
    })
    .filter(Boolean); // Remove nulls

  // Handle hierarchy: if sub-project matches, include parents
  // (Build from full hierarchy, then filter - preserves relationships)

  // Filter general actions
  const filteredGeneralActions = data.generalNextActions.filter(action =>
    matches(action)
  );

  return {
    projects: filteredProjects,
    projectsNeedingNextActions: data.projectsNeedingNextActions, // Not filtered
    generalNextActions: filteredGeneralActions,
    generalNextActionsNotice: data.generalNextActionsNotice
  };
}
```

### Rendering Flow

```typescript
private renderContent(container: HTMLElement, data: SphereViewData) {
  // 1. Render sphere name + search header (sticky)
  const stickyHeader = this.renderStickyHeader(container);
  const searchInput = this.renderSearchInput(stickyHeader);
  this.setupKeyboardShortcuts(searchInput);

  // 2. Filter data based on current query
  const filteredData = this.filterData(data, this.searchQuery);

  // 3. Render sections with filtered data
  this.renderProjectsNeedingActionsSection(container, filteredData.projectsNeedingNextActions);
  this.renderProjectsSection(container, filteredData.projects);
  this.renderGeneralNextActionsSection(container, filteredData.generalNextActions);
}
```

### CSS Requirements

```css
.flow-gtd-sphere-sticky-header {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 10;
  padding: 8px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.flow-gtd-sphere-search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.flow-gtd-sphere-search-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
}

.flow-gtd-sphere-search-clear {
  cursor: pointer;
  opacity: 0.6;
}

.flow-gtd-sphere-search-clear:hover {
  opacity: 1;
}
```

## Testing Strategy

### Unit Tests

**Test file:** `tests/sphere-view-filter.test.ts`

**Test cases:**

1. Empty query returns unfiltered data
2. Case-insensitive matching works
3. Project name matching filters correctly
4. Action text matching filters correctly
5. Projects with no matches are hidden
6. Sub-project matches preserve parent visibility
7. General actions filter independently
8. Projects needing actions section not filtered
9. Waiting-for items searchable by text (not emoji)
10. Filter state doesn't persist across refreshes

### Manual Testing Checklist

- [ ] Search input appears in sticky header with sphere name
- [ ] Cmd/Ctrl+F focuses search input
- [ ] Escape clears search query
- [ ] Clear button (X) works and returns focus
- [ ] Typing filters results instantly
- [ ] Project name matching works
- [ ] Action text matching works
- [ ] Hierarchy preserved when filtering
- [ ] Scroll position maintained during filtering
- [ ] Empty state shows appropriate message
- [ ] Hotlist operations work on filtered items
- [ ] Search clears on view refresh
- [ ] Waiting-for items (🕐) searchable

## Future Enhancements (Out of Scope for V1)

- Debouncing for very large vaults (if performance issues arise)
- Highlight matching text in results
- Regular expression support
- Filter by tags or other metadata
- Save/persist common search queries
- Search history

## Implementation Approach

**Strategy:** Simple filter-on-render (Approach 1 from brainstorming)

**Rationale:**

- Simplest implementation
- Works with existing hierarchy building logic
- Can optimize later if performance issues arise
- Easy to add text highlighting in future

**Performance considerations:**

- Re-filtering on every keystroke is acceptable for typical vault sizes
- Virtual scrolling or search indexing can be added later if needed
