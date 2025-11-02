# Remove AI Refinement from Processing View

**Date:** 2025-11-02
**Status:** Design Complete

## Overview

Remove the AI refinement functionality from the inbox processing view while keeping the manual categorization workflow intact. This simplifies the codebase by removing optional AI features that layer on top of the core manual processing flow.

## Background

The processing view currently supports:
- Manual categorization of inbox items (core functionality)
- Optional AI refinement to improve text and suggestions (being removed)
- Vault scanning for context (keeping)

AI settings and functionality remain for other features (project review, CLI).

## Goals

1. Remove all AI refinement UI elements from processing view
2. Remove AI refinement backend methods and state
3. Simplify types by removing AI-related fields
4. Reduce code complexity while preserving manual workflow
5. Maintain all vault scanning and context features

## Non-Goals

- Removing AI from other features (project review, CLI remain unchanged)
- Changing the manual categorization workflow
- Removing AI settings from settings tab

## Design

### Type Changes (inbox-types.ts)

**Remove from EditableItem:**
- `isAIProcessed: boolean` - no longer needed
- `result?: GTDProcessingResult` - no AI results to store
- `isProcessing?: boolean` - no loading states for AI
- `hasAIRequest?: boolean` - no AI request tracking

**Remove interface:**
- `ProcessingOutcome` - only used for bulk AI refinement results

**Keep all other fields:**
- Manual selection fields (selectedAction, selectedProject, etc.)
- Editing fields (editedName, editedNames, etc.)
- UI state (isDateSectionExpanded)
- Feature flags (addToFocus, isSubProject, etc.)

### State Changes (inbox-modal-state.ts)

**Remove methods:**
- `refineAllWithAI()` - bulk AI refinement
- `refineIndividualItem(item)` - single item AI refinement

**Remove fields:**
- `isBulkRefining` (if exists) - bulk refinement state

**Keep:**
- All manual processing methods
- Vault scanning and context loading
- Item persistence and state management

### Controller Changes (inbox-processing-controller.ts)

**Remove methods:**
- `refineItem(item, projects, persons)` - single item refinement
- `refineItems(items, projects, persons)` - bulk refinement

**Keep:**
- `processManualChoice()` - manual categorization
- File writing methods
- Vault interaction methods
- All non-AI processing logic

### UI Changes (inbox-modal-views.ts)

**Remove from header:**
- "Refine all (N)" button and container
- AI-enabled conditional description text
- Bulk refinement progress display

**Simplify header description to:**
"Review your inbox items, edit them manually, then save them to your vault."

**Remove from individual items:**
- Sparkles "refine" icon buttons
- Loading spinner animations during AI processing
- Completion checkmark icons for refined items
- Different styling for refined vs unrefined items
- "AI Suggestion" boxes for project recommendations
- All `isProcessing` button disable logic
- All `isAIProcessed` conditional rendering

**Unified item display:**
All items show the same UI regardless of processing state:
- Original text in standard box (no "refined" vs "unrefined" styling)
- Category selection dropdown
- Manual input forms based on category
- Save button (no processing state)

**Remove settings checks:**
- No `settingsSnapshot.aiEnabled` checks in processing view
- UI is the same whether AI is enabled or not globally

### Implementation Approach

**Order of changes:**
1. Update types (inbox-types.ts) - remove AI fields
2. Update state (inbox-modal-state.ts) - remove AI methods
3. Update controller (inbox-processing-controller.ts) - remove AI processing
4. Update UI (inbox-modal-views.ts) - remove AI elements
5. Update tests - remove AI refinement test cases
6. Manual testing - verify workflow works end-to-end

**Testing strategy:**
- Unit tests: Update to remove AI refinement scenarios
- Integration: Verify manual processing still works
- Manual: Process real inbox items through full workflow
- Verify: No AI calls made, no errors, files written correctly

## Benefits

**Code simplification:**
- Fewer types and fields to maintain
- Simpler state management
- Fewer conditional branches in UI
- Clearer separation of concerns

**Reduced complexity:**
- No AI loading states
- No refined vs unrefined display logic
- No bulk processing orchestration
- Uniform item display

**Maintained functionality:**
- Manual categorization unchanged
- Vault scanning intact
- File writing unchanged
- All context features preserved

## Risks and Mitigations

**Risk:** Accidentally break manual workflow
**Mitigation:** Comprehensive testing, only remove AI-specific code

**Risk:** Users expect AI features
**Mitigation:** AI still available in CLI and project review

**Risk:** Tests might fail
**Mitigation:** Update tests to remove AI expectations

## Success Criteria

1. Processing view works without any AI calls
2. Manual categorization workflow unchanged
3. All tests pass with AI refinement removed
4. Code is simpler with fewer conditional branches
5. No AI UI elements visible in processing view
6. Vault scanning and context still works
