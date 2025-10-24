# Inbox Action Buttons Design

**Date**: 2025-10-24
**Status**: Approved

## Summary

Replace the dropdown selector for "How to Process" in the inbox modal with grouped pill buttons for more direct, visual interaction.

## Problem

The current dropdown selector (lines 341-367 in `inbox-modal-views.ts`) requires clicking to reveal options, making the processing choices less discoverable and requiring more interaction steps.

## Solution

Replace dropdown with grouped pill buttons arranged horizontally, organized into three logical categories:

### Button Groups

**Projects** (3 buttons)
- 📁 Create Project
- ➕ Add to Project
- 📄 Reference

**Actions** (2 buttons)
- 📋 Next Actions
- 💭 Someday

**Other** (2 buttons)
- 👤 Person
- 🗑️ Trash

### Visual Layout

```
Projects                    Actions              Other
[📁 Create] [➕ Add] [📄 Ref]   [📋 Next] [💭 Someday]   [👤 Person] [🗑️ Trash]
```

## Design Specifications

### Layout Structure

**Container**: Horizontal flex container
- `display: flex`
- `flex-direction: row`
- `gap: 32px` (between groups)

**Each Group**: Vertical flex container
- `display: flex`
- `flex-direction: column`
- `gap: 8px` (between header and buttons)

**Button Row**: Horizontal flex container
- `display: flex`
- `flex-direction: row`
- `gap: 8px` (between buttons)

### Typography & Spacing

**Group Headers**:
- Font size: 12-13px
- Font weight: medium (500-600)
- Color: `var(--text-muted)`
- Margin bottom: included in group gap (8px)
- Text transform: none (natural case)

**Buttons**:
- Font size: 14px
- Padding: 8px vertical, 12-16px horizontal
- Border radius: 16-20px (pill shape)
- Gap within group: 8px

### Button States

**Unselected**:
- Background: transparent
- Text color: `var(--text-normal)`
- Border: 1px solid `var(--background-modifier-border)` (optional)

**Selected** (single selection - radio behaviour):
- Background: `var(--interactive-accent)`
- Text color: white or `var(--text-on-accent)`
- Border: none

**Hover**:
- Background: `var(--background-modifier-hover)` (unselected)
- Slight opacity change: 0.9 (selected)
- Cursor: pointer

**Transition**: `background-color 0.2s ease`

### Behaviour

- **Single selection**: Only one button can be active across all groups (radio button behaviour)
- **Initial state**: Default to "Next Actions" (matches current dropdown default at line 363)
- **Click handling**: Update `item.selectedAction` and trigger re-render
- **Responsive**: All groups remain on one horizontal line; on very narrow screens, buttons within groups may need to wrap

## Implementation Notes

### Files to Modify

**Primary file**: `src/inbox-modal-views.ts`
- Lines 323-367: Replace `renderEditableItemContent()` dropdown section

### CSS Considerations

- Reuse existing sphere button styles (lines 1124-1153) as reference
- Add new classes: `flow-gtd-action-groups`, `flow-gtd-action-group`, `flow-gtd-action-group-header`
- Button class: reuse or create similar to `flow-gtd-sphere-button`

### Action Mapping

Current dropdown values → New button labels:
- `create-project` → "📁 Create" (Projects group)
- `add-to-project` → "➕ Add" (Projects group)
- `reference` → "📄 Reference" (Projects group)
- `next-actions-file` → "📋 Next" (Actions group)
- `someday-file` → "💭 Someday" (Actions group)
- `person` → "👤 Person" (Other group)
- `trash` → "🗑️ Trash" (Other group)

### Testing Considerations

- Verify single-selection behaviour works correctly
- Ensure selected action persists through re-renders
- Test with all 7 action types to ensure downstream logic works
- Verify responsive behaviour on narrow viewports
- Check keyboard navigation and accessibility

## Benefits

1. **Discoverability**: All options visible at once without clicking
2. **Speed**: One click instead of two (click dropdown, then option)
3. **Visual grouping**: Logical organization makes choices clearer
4. **Consistency**: Matches existing sphere selector UI pattern
5. **Modern UX**: Pill buttons feel more contemporary than dropdowns

## Alternatives Considered

**Icons only with tooltips**: Too minimal, requires hover to understand options

**Dropdown per group**: Adds interaction steps, defeats purpose of replacing dropdown

**Multi-row layout**: Takes more vertical space, less elegant than single-row design

**Horizontal scroll**: Works but less discoverable than fixed visible buttons
