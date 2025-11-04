# Completed Focus Actions Display Design

**Date:** 2025-11-04
**Status:** Approved

## Overview

Add a "Completed Today" section at the bottom of the focus panel to show actions marked complete since midnight. This provides immediate visual feedback on daily progress without cluttering the main focus list.

## Requirements

- Show completed actions from today (since midnight 00:00)
- Section should be collapsible (collapsed by default)
- Remove completed actions from focus storage at midnight
- Don't archive completed items during auto-clear (already marked complete in source)

## Data Model Changes

### FocusItem Interface Extension

```typescript
export interface FocusItem {
  file: string;
  lineNumber: number;
  lineContent: string;
  text: string;
  sphere: string;
  isGeneral: boolean;
  addedAt: number;
  isPinned?: boolean;
  completedAt?: number;  // NEW: Timestamp when marked complete
}
```

### Item States

- **Active**: `completedAt` is undefined
- **Completed Today**: `completedAt >= today's midnight timestamp`
- **Old Completion**: `completedAt < today's midnight timestamp` (removed during cleanup)

### Cleanup Strategy

Clean old completions at two points:
1. **On view open/refresh**: Filter out items where `completedAt < midnight`
2. **During auto-clear**: Remove all items with `completedAt` (don't archive them)

No background timer needed - cleanup happens naturally during regular operations.

## UI Changes

### Section Ordering

1. Pinned (if any)
2. Project Actions (if any)
3. General Actions (if any)
4. **Completed Today (if any)** ← NEW

### Completed Today Section

- **Header**: "Completed Today (count)"
- **Visibility**: Hidden entirely if no completed items
- **Collapsible**: Can expand/collapse
- **Default State**: Collapsed
- **Persistence**: Store collapse state in settings as `completedTodaySectionCollapsed: boolean`

### Completed Item Rendering

- **Text styling**: Strikethrough
- **Visual indicator**: ✅ checkmark
- **Appearance**: Gray/muted (lower opacity)
- **Context**: Show project/sphere (same as active items)
- **Interaction**: Click text to jump to source file
- **Actions**: No action buttons (item already complete)

## Behaviour Changes

### markItemComplete() Modification

**Current behaviour:**
1. Mark as `[x]` in source file
2. Remove item from focus array
3. Save and re-render

**New behaviour:**
1. Mark as `[x]` in source file
2. Set `item.completedAt = Date.now()` (keep in array)
3. Save and re-render (item moves to "Completed Today" section)

### refresh() Modification

**Add cleanup step before validation:**

```typescript
// Calculate today's midnight
const midnight = new Date();
midnight.setHours(0, 0, 0, 0);
const midnightTimestamp = midnight.getTime();

// Remove old completions
this.focusItems = this.focusItems.filter(
  item => !item.completedAt || item.completedAt >= midnightTimestamp
);

// Continue with existing validation for active items
for (const item of this.focusItems.filter(item => !item.completedAt)) {
  // ... existing validation logic
}
```

**Note**: Skip validation for completed items - they're already done, don't care if moved/deleted.

### Auto-clear Integration (focus-auto-clear.ts)

**Modification:**

```typescript
// Separate active and completed items
const activeItems = focusItems.filter(item => !item.completedAt);
const completedItems = focusItems.filter(item => item.completedAt);

// Archive only active items (existing behaviour)
await archiveActiveItems(activeItems);

// Remove completed items without archiving (already marked complete in source)
await saveFocusItems(vault, activeItems);
```

### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| User unchecks completed item in source | Validation detects checkbox change, item removed from focus |
| Completed item deleted from source | Item stays in "Completed Today" until midnight cleanup (harmless) |
| User marks item complete outside focus view | Item remains in focus as active (not tracked by focus) |
| Midnight rolls over while view is open | Next refresh/open cleans old completions |

## Implementation Files

### Modified Files

1. **src/types.ts**: Add `completedAt?: number` to `FocusItem` interface
2. **src/focus-view.ts**:
   - Add `completedTodaySectionCollapsed` to settings handling
   - Modify `markItemComplete()` to set `completedAt` instead of removing
   - Add cleanup logic to `refresh()` and `onOpen()`
   - Add `renderCompletedTodaySection()` method
   - Filter completed items separately for rendering
3. **src/focus-auto-clear.ts**:
   - Filter out completed items before archiving
4. **src/settings-tab.ts**: Add `completedTodaySectionCollapsed: boolean` default
5. **styles.css**: Add styles for completed section and items

### New Functions

**src/focus-view.ts:**

```typescript
private getMidnightTimestamp(): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

private getCompletedTodayItems(): FocusItem[] {
  const midnight = this.getMidnightTimestamp();
  return this.focusItems.filter(
    item => item.completedAt && item.completedAt >= midnight
  );
}

private renderCompletedTodaySection(container: HTMLElement): void {
  const completedItems = this.getCompletedTodayItems();
  if (completedItems.length === 0) return;

  const section = container.createDiv({ cls: 'flow-gtd-focus-section' });

  // Collapsible header
  const header = section.createEl('h3', {
    cls: 'flow-gtd-focus-section-title flow-gtd-focus-collapsible',
  });

  const toggleIcon = header.createSpan({ cls: 'flow-gtd-focus-collapse-icon' });
  setIcon(toggleIcon, this.settings.completedTodaySectionCollapsed ? 'chevron-right' : 'chevron-down');

  header.createSpan({ text: `Completed Today (${completedItems.length})` });

  header.addEventListener('click', async () => {
    this.settings.completedTodaySectionCollapsed = !this.settings.completedTodaySectionCollapsed;
    await this.saveSettings();
    await this.onOpen(); // Re-render
  });

  // Content (hidden if collapsed)
  if (!this.settings.completedTodaySectionCollapsed) {
    const grouped = this.groupItems(completedItems);
    // Render grouped items with completed styling
    // ... (similar to existing grouping logic)
  }
}

private renderCompletedItem(container: HTMLElement, item: FocusItem): void {
  const itemEl = container.createEl('li', { cls: 'flow-gtd-focus-item flow-gtd-focus-completed' });

  itemEl.createSpan({ text: '✅ ', cls: 'flow-gtd-focus-completed-indicator' });

  const textSpan = itemEl.createSpan({ cls: 'flow-gtd-focus-item-text' });
  textSpan.setText(item.text);
  textSpan.style.cursor = 'pointer';
  textSpan.style.textDecoration = 'line-through';
  textSpan.style.opacity = '0.6';

  textSpan.addEventListener('click', () => {
    this.openFile(item.file, item.lineNumber);
  });
}
```

### CSS Additions

```css
/* Collapsible section header */
.flow-gtd-focus-collapsible {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.flow-gtd-focus-collapse-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
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
}
```

## Testing Strategy

### Unit Tests

**tests/focus-view.test.ts:**
- Test completed items appear in "Completed Today" section
- Test section is collapsible and state persists
- Test section hidden when no completed items
- Test completed items have correct styling/no action buttons
- Test midnight cleanup removes old completions
- Test `markItemComplete()` sets `completedAt` instead of removing
- Test `getCompletedTodayItems()` filters correctly by midnight

**tests/focus-integration.test.ts:**
- Test marking item complete moves it to completed section
- Test completed items persist across view refresh
- Test old completed items removed on next day (mock Date)

**tests/focus-auto-clear.test.ts:**
- Test auto-clear archives active items but removes completed items
- Test completed items don't appear in archive file

### Test Utilities

```typescript
// Helper to create completed item with specific timestamp
function createCompletedItem(hoursAgo: number): FocusItem {
  return {
    ...createMockFocusItem(),
    completedAt: Date.now() - (hoursAgo * 60 * 60 * 1000)
  };
}

// Helper to get midnight timestamp
function getMidnightTimestamp(): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}
```

### Manual Testing Checklist

- [ ] Mark items complete, verify they appear in "Completed Today" section
- [ ] Verify completed items show strikethrough and checkmark
- [ ] Collapse/expand section, verify state persists across reloads
- [ ] Refresh view, verify completed items remain
- [ ] Mock system clock to next day, verify old completions removed
- [ ] Trigger auto-clear, verify completed items not in archive file
- [ ] Click completed item text, verify jumps to source file
- [ ] Verify section hidden when no completed items
- [ ] Verify count in header updates correctly

## Benefits

1. **Immediate feedback**: See what you've accomplished today
2. **Motivation**: Visual progress indicator
3. **Simple recovery**: Click to find completed items if needed
4. **No clutter**: Collapsed by default, auto-removes at midnight
5. **Clean architecture**: Minimal changes, reuses existing patterns
6. **Performance**: No extra file scanning, simple filtering

## Trade-offs

- **Storage overhead**: Completed items stay in storage until midnight (~20 items max = negligible)
- **No history beyond today**: By design - focus is for today, not a log
- **Collapse state in settings**: One more setting field (acceptable)

## Future Enhancements (Not in Scope)

- Option to hide "Completed Today" section entirely (if users find it distracting)
- Configurable cleanup time (instead of hardcoded midnight)
- Archive completed items to separate file (if users want longer history)
