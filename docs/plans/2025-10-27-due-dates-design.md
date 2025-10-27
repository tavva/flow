# Due Date Support Design

**Date:** 2025-10-27
**Status:** Approved

## Overview

Add due date support to all processing action types (next actions, projects, someday, waiting-for, person notes) in the inbox processing workflow. Due dates are optional and use the same format as existing reminder dates (`📅 YYYY-MM-DD`). The UI uses a collapsible section with dynamic labels based on action type to minimize visual clutter.

## Goals

- Enable optional due dates for all action types during inbox processing
- Maintain minimal UI footprint (most items won't have dates)
- Use semantic, context-aware labels (due date vs reminder date vs follow-up date)
- Maintain consistency with existing reminder date format
- Improve waiting-for icon semantics (🤝 handshake instead of clock emojis)

## Design Decisions

### Approach: Single Field with Action-Specific UI Labels

We chose a single `dueDate` field with dynamic UI labels over multiple date fields or a unified generic label because:

- **Simple data model** - One optional field covers all use cases
- **Clear user intent** - Labels adapt to tell users what the date means in context
- **Minimal code complexity** - No complex conditional logic for multiple fields
- **Future flexibility** - Easy to adjust labels or add new action types

### Icon Change: Clock → Handshake for Waiting-For

Changed waiting-for indicator from ⏰/🕐 (clock) to 🤝 (handshake) because:

- **Semantic clarity** - Handshake represents "waiting for someone else" better than time/clock
- **No confusion** - Calendar emoji (📅) is clearly distinct from handshake
- **GTD alignment** - Waiting-for is about delegation/dependency, not just time

## Data Model

### EditableItem Interface Changes

```typescript
export interface EditableItem {
  // ... existing fields ...
  dueDate?: string; // Renamed from reminderDate - optional date in YYYY-MM-DD format
}
```

**Migration:**
- Rename `reminderDate` → `dueDate` throughout codebase
- No changes to validation logic
- Reuse existing `validateReminderDate()` function

### File Output Format

All action types use consistent format: `text 📅 YYYY-MM-DD #sphere/tag`

**Examples by action type:**

```markdown
# Next Actions file
- [ ] Call dentist for appointment 📅 2025-11-15 #sphere/personal
- [w] Wait for Sarah's feedback 📅 2025-11-01 #sphere/work

# Someday file
- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal

# Project file
## Next actions
- [ ] Draft proposal outline 📅 2025-11-05
- [w] Review with stakeholders 📅 2025-11-10

# Person note
## Actions
- [ ] Follow up about meeting 📅 2025-11-02
```

**Format rules:**
- Space before emoji for readability
- Date appears after action text, before sphere tag
- Optional - only added if `dueDate` exists
- Same validation as existing reminder dates (YYYY-MM-DD, valid calendar date)

## UI Design

### Collapsible Date Section

**Location:** After main action controls (edit/waiting/done toggles) in inbox processing modal

**Behavior:**
- Hidden by default (collapsed)
- Click to expand and show HTML5 date picker
- Clear button (×) appears when date is set
- Persists across "Refine with AI" requests
- Updates label when user changes action type

**Visual design:**
- Chevron icon (▶/▼) for collapsed/expanded state
- Subtle styling - doesn't dominate interface
- Consistent with existing someday date picker UI
- Inline validation error display

### Dynamic Labels by Action Type

```typescript
const dateLabels = {
  'next-action': 'Set due date (optional)',
  'project': 'Set target date (optional)',
  'someday': 'Set reminder date (optional)',
  'person': 'Set follow-up date (optional)',
  'reference': null, // No date support
  'waiting-for': 'Set follow-up date (optional)'
};
```

**Rationale:**
- Labels communicate semantic meaning in context
- "Optional" signals this isn't required
- Different contexts need different mental models (due vs reminder vs follow-up)

## Implementation Changes

### Files Requiring Updates

**Data model:**
- `src/inbox-types.ts` - Rename `reminderDate` → `dueDate`
- `src/inbox-item-persistence.ts` - Update persistence logic

**File writing:**
- `src/file-writer.ts` - Update all action writing functions to include `dueDate`
  - `writeToNextActionsFile()`
  - `writeToSomedayFile()`
  - `createProjectFile()`
  - `updateProjectFile()`
  - Writing to person notes

**UI:**
- `src/inbox-modal-views.ts` - Add collapsible date section with dynamic labels
- `src/inbox-modal-state.ts` - Track collapsed/expanded state

**Icon changes:**
- `src/inbox-modal-views.ts` - Toggle button: ⏰ → 🤝
- `src/sphere-view.ts` - Action display: 🕐 → 🤝
- `src/focus-view.ts` - Waiting indicator: 🕐 → 🤝 (two locations)

**Documentation:**
- `CLAUDE.md` - Update waiting-for icon documentation
- `CLAUDE.md` - Add due date feature documentation

### Validation

Reuse existing `validateReminderDate()` from `src/validation.ts`:
- Format: YYYY-MM-DD
- Valid calendar date
- Empty string is valid (optional field)

No changes needed to validation logic.

## Testing Strategy

### Unit Tests

**Data model:**
- `tests/inbox-types.test.ts` - Type definitions include `dueDate`
- `tests/validation.test.ts` - Already covers date validation (no changes)
- `tests/inbox-item-persistence.test.ts` - Persistence includes `dueDate`

**File writing:**
- `tests/file-writer.test.ts` - Add due date tests for:
  - Next actions (regular and waiting-for)
  - Someday items (rename `reminderDate` tests to `dueDate`)
  - Project next actions
  - Person notes
  - Verify format: `text 📅 YYYY-MM-DD #sphere/tag`

**UI:**
- `tests/inbox-modal-views.test.ts` - Collapsible section rendering
- Dynamic label based on action type
- Date input validation and error display

### Integration Tests

- `tests/inbox-processing-controller.test.ts` - End-to-end with due dates
- Date persists through AI refinement
- Date written to correct file format

### Icon Change Tests

Update all tests expecting clock emojis to expect handshake:
- `tests/sphere-view.test.ts` - "display clock emoji" → "display handshake emoji"
- `tests/focus-view.test.ts` - Waiting-for indicator tests
- `tests/inbox-modal-views.test.ts` - Toggle button tests

### Coverage Requirements

Maintain 80% coverage threshold across all metrics.

## Future Enhancements (Out of Scope)

- Date parsing from natural language ("next Friday", "in 2 weeks")
- AI suggestion of due dates based on inbox item content
- Due date filtering/sorting in sphere and focus views
- Overdue item highlighting
- Recurring due dates

## Success Criteria

- ✅ All action types support optional due dates
- ✅ UI is unobtrusive (collapsed by default)
- ✅ Labels clearly communicate semantic meaning
- ✅ Consistent format across all file outputs
- ✅ Waiting-for icon changed to handshake throughout
- ✅ All tests pass with 80% coverage
- ✅ No breaking changes to existing functionality
