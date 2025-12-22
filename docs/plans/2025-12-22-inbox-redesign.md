# Inbox Redesign

**Date**: 2025-12-22
**Status**: Ready for implementation

## Problem

The current inbox processing UI has several issues:
- Too much visual noise - options overwhelm users
- Can't scan quickly - hard to get an overview of what's in the inbox
- Keyboard flow is awkward for power users
- Looks cluttered (side-effect of visual noise)

## Solution

Replace the accordion-style inline editing with a **two-pane layout** that separates scanning from editing.

## Architecture

### Responsive Layout

**Wide viewport (≥800px):** Horizontal split
- List pane: ~300px fixed width
- Detail pane: remaining width
- Both visible simultaneously

**Narrow viewport (<800px):** Single pane with navigation
- List view is default
- Selecting item transitions to detail view
- Back button returns to list

### List Pane

Simple, scannable list:
- Text only, truncated with ellipsis
- No icons, checkboxes, or drag handles
- Subtle separator between items

States:
- Default: normal text
- Hover: subtle background
- Selected: accent background

Header shows "Inbox (n)" with item count and refresh button.

### Detail Pane

Organised top to bottom by frequency of use:

1. **Original text** (read-only) - full context
2. **Action type selector** - 7 pill buttons in two rows
3. **Conditional section** - varies by action type (see below)
4. **Next actions editor** - editable text, add action button, waiting-for toggle
5. **Sphere selector** - pill buttons, smart default (last used)
6. **Bottom options** - Add to focus, Mark as done checkboxes
7. **More options** (collapsed) - dates, priority, sub-project

Action buttons (Discard, Save) in header area, always visible.

### Conditional Sections by Action Type

| Action | Shows |
|--------|-------|
| Create Project | Project name input. More: priority, sub-project toggle |
| Add to Project | Project search/select |
| Reference | Project search/select. Hides next actions editor |
| Person | Person dropdown |
| Next Actions | Nothing extra |
| Someday | Nothing extra |
| Trash | Hides next actions, sphere, bottom options |

### Keyboard Navigation

**List navigation:**
- `↑↓` - move selection
- `Enter` - open detail pane
- `Esc` - return to list (narrow viewport)

**Detail pane shortcuts:**
- `C/A/N/S/R/P/T` - select action type
- `⌘1-9` - toggle sphere by position
- `⌘J` - toggle "Add to focus"
- `⌘D` - toggle "Mark as done"
- `⌘M` - toggle "More options"
- `⌘Enter` - save and advance to next item
- `⌘Backspace` - discard with confirmation

Single-letter shortcuts only active when not in a text input.

**Auto-advance:** After save/discard, selection moves to next item.

## Visual Design

**Goals:** Clean, minimal, breathable. Consistent with Obsidian.

**Key decisions:**
- No emojis in action buttons (text only)
- Generous spacing (16px standard, 24px between sections)
- Use Obsidian CSS variables throughout
- Subtle dividers, no heavy boxes
- Save button prominent (accent), Discard muted (ghost style)

**Action type pills format:** `N Next` with letter as hint, no emoji.

## State Management Changes

- Remove accordion expand/collapse logic
- Track `selectedItemIndex` instead of `isExpanded` per item
- Add `viewMode: 'list' | 'detail'` for narrow viewport navigation
- Track last-used sphere for smart defaults

## Files to Modify

- `src/inbox-processing-view.ts` - two-pane layout, responsive behaviour
- `src/inbox-modal-views.ts` - split into list and detail rendering
- `src/inbox-modal-state.ts` - selection tracking instead of expansion
- `src/styles.css` - new layout styles, responsive breakpoint

## Testing Considerations

- Test at various viewport widths (600px, 800px, 1200px)
- Verify keyboard navigation in both modes
- Test auto-advance after save/discard
- Verify all action types still work correctly
- Test smart defaults (last-used sphere)
