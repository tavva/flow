# Focus Manual Reordering Design

**Date:** 2025-10-26
**Status:** Approved

## Overview

This design adds the ability for users to manually prioritise items in the focus by pinning them to a dedicated "Pinned" section at the top. Pinned items can be reordered via drag-and-drop to control their display sequence. The rest of the focus maintains its existing project/sphere grouping structure.

## Problem Statement

The current focus displays items grouped by project and sphere, sorted alphabetically. Users cannot prioritise specific actions they want to work on first. If a high-priority action belongs to a project that appears late alphabetically, users must scroll past other items to find it.

## Design Goals

1. **Allow manual prioritisation** - Users can mark specific items as high priority
2. **Preserve existing grouping** - Unpinned items maintain their useful project/sphere organisation
3. **Simple interaction** - Pin/unpin buttons and intuitive drag-and-drop reordering
4. **Minimal complexity** - Simple data model with single source of truth

## Approach: Hybrid Pinned Section

We explored four approaches:

- Disable grouping entirely (flat custom-ordered list)
- Allow reordering within groups only
- **Hybrid: Pinned section + grouped unpinned items** ← Selected
- Two-level: Reorder both groups and items within groups

The hybrid approach was chosen because it:

- Solves the priority problem (pin important items to top)
- Maintains the useful grouping for unpinned items
- Keeps complexity low (only pinned items need ordering)
- Provides clear visual separation between prioritised and regular items

## Data Model Changes

### FocusItem Interface

```typescript
export interface FocusItem {
  file: string;
  lineNumber: number;
  lineContent: string;
  text: string;
  sphere: string;
  isGeneral: boolean;
  addedAt: number;
  isPinned?: boolean; // NEW: indicates item is in pinned section
}
```

### Settings Storage Structure

The `settings.focus` array becomes an ordered list where:

- **Pinned items** appear at the front in their desired display order
- **Unpinned items** follow (their array position is irrelevant for rendering)

**Key principle:** Array index determines pinned item order. When dragging item A above item B in the pinned section, we reorder the array so A's index < B's index.

**Example:**

```typescript
settings.focus = [
  { text: "High priority task", isPinned: true, ... },      // Position 0
  { text: "Second priority", isPinned: true, ... },         // Position 1
  { text: "Some project action", isPinned: false, ... },    // Position 2+
  { text: "Another action", isPinned: false, ... },         // Position 3+
  // ... more unpinned items in any order
]
```

### Migration Strategy

Existing focus items without the `isPinned` property default to `false` (backward compatibility). No migration script required.

## Rendering Logic

### View Rendering Flow

```typescript
private renderGroupedItems(container: HTMLElement, items: FocusItem[]) {
  // Split items into pinned and unpinned
  const pinnedItems = items.filter(item => item.isPinned);
  const unpinnedItems = items.filter(item => !item.isPinned);

  // Render pinned section (if any pinned items exist)
  if (pinnedItems.length > 0) {
    const pinnedSection = container.createDiv({ cls: "flow-gtd-focus-section" });
    pinnedSection.createEl("h3", {
      text: "Pinned",
      cls: "flow-gtd-focus-section-title",
    });

    // Render as flat list - pinnedItems are already in desired order from array
    const pinnedList = pinnedSection.createEl("ul", {
      cls: "flow-gtd-focus-items flow-gtd-focus-pinned-items"
    });
    pinnedItems.forEach(item => {
      this.renderPinnedItem(pinnedList, item);
    });
  }

  // Render unpinned items with existing grouping logic
  const grouped = this.groupItems(unpinnedItems);
  // ... existing code for Project Actions and General Actions sections
}
```

### Pinned Item Layout

Each pinned item displays:

```
[Drag Handle] [📌] Action text [✓] [⏸] [🗑️] [Unpin]
```

Where:

- **Drag Handle** (⋮⋮ or grip-vertical icon) - Appears on hover, enables drag-and-drop
- **📌 Pin Icon** - Visual indicator of pinned status
- **Action Text** - Clickable to open source file
- **Action Buttons** - Complete, waiting-for, remove (existing functionality)
- **Unpin Button** - Removes from pinned section

### Unpinned Item Updates

Unpinned items (in Project Actions and General Actions sections) get a new pin button:

```
[Clock Icon?] Action text [📌] [✓] [⏸] [🗑️]
```

The pin button appears before the existing action buttons.

## Drag-and-Drop Implementation

### Technology Choice

Use native HTML5 Drag-and-Drop API (consistent with Obsidian patterns):

- `draggable="true"` attribute on pinned items
- Standard drag events: `dragstart`, `dragover`, `drop`, `dragend`
- Visual feedback via CSS classes during drag operations

### Event Handlers

```typescript
private renderPinnedItem(container: HTMLElement, item: FocusItem) {
  const itemEl = container.createEl("li", {
    cls: "flow-gtd-focus-item flow-gtd-focus-pinned-item",
    attr: { draggable: "true" }
  });

  // Event listeners
  itemEl.addEventListener("dragstart", (e) => this.onDragStart(e, item));
  itemEl.addEventListener("dragover", (e) => this.onDragOver(e));
  itemEl.addEventListener("drop", (e) => this.onDrop(e, item));
  itemEl.addEventListener("dragend", (e) => this.onDragEnd(e));

  // ... render drag handle, pin icon, text, buttons
}
```

### Drag State Tracking

```typescript
private draggedItem: FocusItem | null = null;
```

Stored in view instance during drag operation.

### Reordering Logic

```typescript
private async onDrop(e: DragEvent, dropTarget: FocusItem) {
  e.preventDefault();
  if (!this.draggedItem || this.draggedItem === dropTarget) return;

  // Find indices in settings.focus
  const draggedIndex = this.settings.focus.findIndex(i =>
    i.file === this.draggedItem.file &&
    i.lineNumber === this.draggedItem.lineNumber &&
    i.addedAt === this.draggedItem.addedAt
  );
  const targetIndex = this.settings.focus.findIndex(i =>
    i.file === dropTarget.file &&
    i.lineNumber === dropTarget.lineNumber &&
    i.addedAt === dropTarget.addedAt
  );

  // Remove dragged item and insert at target position
  const [item] = this.settings.focus.splice(draggedIndex, 1);
  this.settings.focus.splice(targetIndex, 0, item);

  await this.saveSettings();
  await this.onOpen(); // Re-render
}
```

### Visual Feedback

- **Drag Handle**: Hidden by default, visible on item hover
- **Dragging State**: Item being dragged appears dimmed/semi-transparent
- **Drop Target**: Border/highlight appears where item will be inserted
- **Cursor**: Changes to `grab` on hover, `grabbing` during drag

## Pin/Unpin Interactions

### Pinning an Item

```typescript
private async pinItem(item: FocusItem): Promise<void> {
  // Find item in settings.focus
  const index = this.settings.focus.findIndex(i =>
    i.file === item.file &&
    i.lineNumber === item.lineNumber &&
    i.addedAt === item.addedAt
  );

  if (index === -1) return;

  // Set isPinned flag
  this.settings.focus[index].isPinned = true;

  // Move to end of pinned section
  const pinnedCount = this.settings.focus.filter(i => i.isPinned).length;
  const [pinnedItem] = this.settings.focus.splice(index, 1);
  this.settings.focus.splice(pinnedCount - 1, 0, pinnedItem);

  await this.saveSettings();
  await this.onOpen(); // Re-render
}
```

When an item is pinned:

1. Set `isPinned = true`
2. Move item to end of pinned section in array
3. Save settings and re-render

### Unpinning an Item

```typescript
private async unpinItem(item: FocusItem): Promise<void> {
  const index = this.settings.focus.findIndex(i =>
    i.file === item.file &&
    i.lineNumber === item.lineNumber &&
    i.addedAt === item.addedAt
  );

  if (index === -1) return;

  // Clear isPinned flag (item stays in array, position doesn't matter for unpinned)
  this.settings.focus[index].isPinned = false;

  await this.saveSettings();
  await this.onOpen(); // Re-render
}
```

When an item is unpinned:

1. Set `isPinned = false`
2. Item stays in array (position doesn't matter for unpinned items)
3. Save settings and re-render

## Edge Cases

### Planning Mode Integration

When adding items from sphere view planning mode:

- New items are added with `isPinned: false` (unpinned by default)
- Appended to end of `settings.focus` array

### Validation and Refresh

When focus items are validated during refresh:

- Maintain `isPinned` state when updating line numbers
- Preserve array order for pinned items
- Completed items are removed regardless of pin status

### Empty Pinned Section

If all pinned items are unpinned:

- "Pinned" section header disappears automatically
- View shows only Project Actions and General Actions sections

### Single Pinned Item

If only one item is pinned:

- Drag-and-drop still works but has no visible effect
- No special handling required

### Keyboard Users

- Pin/unpin buttons are fully keyboard accessible (standard `<button>` elements)
- Drag-and-drop is mouse-only (acceptable enhancement)
- Keyboard users can still pin/unpin items to control priority

## Styling

### CSS Classes

```css
/* Pinned section styling */
.flow-gtd-focus-pinned-items {
  background: var(--background-primary-alt);
  border-radius: 4px;
  padding: 8px;
}

/* Drag handle - hidden by default, visible on hover */
.flow-gtd-focus-drag-handle {
  opacity: 0.3;
  cursor: grab;
  margin-right: 8px;
  transition: opacity 0.2s;
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

### Accessibility

- Drag handle has `aria-label="Reorder item"`
- Pin/unpin buttons have clear `title` tooltips
- Drag-and-drop provides visual feedback (not screen reader dependent)

## Performance Considerations

- **Re-rendering**: Full view re-render on drop is acceptable (small lists, infrequent operation)
- **Optimization**: Could add targeted DOM updates later if needed
- **Debouncing**: Not required (user-initiated actions, not continuous updates)

## Testing Strategy

### Unit Tests

1. **Data Model**
   - Pin/unpin methods update `isPinned` flag correctly
   - Array reordering logic works for various drag-drop scenarios
   - Item uniqueness matching (file + lineNumber + addedAt)

2. **Rendering**
   - Pinned items render in "Pinned" section in array order
   - Unpinned items maintain existing grouping
   - Empty pinned section doesn't render header
   - Migration: items without `isPinned` default to false

3. **Edge Cases**
   - Planning mode adds items as unpinned
   - Validation preserves pin state
   - Single pinned item doesn't break drag-drop

### Manual Testing

1. Pin/unpin items from different sections
2. Drag-drop reordering within pinned section
3. Visual feedback during drag operations
4. Keyboard navigation of pin/unpin buttons
5. Mix of pinned and unpinned items across projects/spheres

## Implementation Phases

### Phase 1: Data Model and Basic Pinning

- Add `isPinned` property to `FocusItem`
- Implement `pinItem()` and `unpinItem()` methods
- Update rendering to show pinned section
- Add pin/unpin buttons to UI

### Phase 2: Drag-and-Drop

- Add drag handle to pinned items
- Implement drag event handlers
- Add reordering logic
- CSS for drag-drop visual feedback

### Phase 3: Polish and Testing

- Edge case handling
- Accessibility improvements
- Unit tests
- Manual testing and refinement

## Future Enhancements (Out of Scope)

- Bulk pin/unpin operations
- Keyboard shortcuts for reordering
- Pinned item auto-expiry (unpin after N days)
- Different pin levels/colours
- Reorder unpinned projects (requires two-level approach)
