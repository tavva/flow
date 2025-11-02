# Flow Coach Chat Pane - Implementation Handoff

**Date:** 2025-11-02
**Branch:** `feature/flow-coach-chat-pane`
**Worktree:** `/Users/ben/repos/flow/.worktrees/flow-coach-chat-pane`
**Status:** 8 of 11 tasks complete (73% done)

## Context

This document provides a handoff for completing the Flow Coach chat pane implementation. The work is being done in a git worktree using subagent-driven development with code review after each task.

**Design Document:** `docs/plans/2025-11-02-flow-coach-chat-pane-design.md`
**Implementation Plan:** `docs/plans/2025-11-02-flow-coach-chat-pane.md`

---

## What's Been Completed (Tasks 1-8)

### ✅ Task 1: Add Core Types
- Added `CoachConversation`, `CoachState`, `DisplayCard`, `ToolApprovalBlock` types
- Files: `src/types.ts`, `tests/types.test.ts`
- Commit: `27d38f3`

### ✅ Task 2: Coach State Management
- Implemented `CoachStateManager` with conversation lifecycle methods
- Files: `src/coach-state.ts`, `tests/coach-state.test.ts`
- Commit: `ef15d11`
- Dependencies added: `uuid@13.0.0`, `@types/uuid@10.0.0`

### ✅ Task 3: Rename CLI Tools to Coach Tools
- Renamed `cli-tools.ts` → `coach-tools.ts` (git history preserved)
- Added display tools: `show_project_card`, `show_action_card`
- Updated all imports
- Files: `src/coach-tools.ts`, `tests/coach-tools.test.ts`, `tests/cli-tools-execution.test.ts`
- Commit: `c77cc23`

### ✅ Task 4: Coach Message Renderer
- Implemented message, card, and tool approval rendering
- Markdown support via `marked` library
- Files: `src/coach-message-renderer.ts`, `tests/coach-message-renderer.test.ts`
- Commit: `83549d6`

### ✅ Task 5: Coach Protocol Banner
- Implemented protocol suggestion banner UI
- Single/multiple protocol layouts
- Files: `src/coach-protocol-banner.ts`, `tests/coach-protocol-banner.test.ts`
- Commit: `87fa368`

### ✅ Task 6: FlowCoachView Part 1 (Basic Structure)
- Implemented header, dropdown, input area
- Placeholder methods for conversation management
- Files: `src/flow-coach-view.ts`, `tests/flow-coach-view.test.ts`
- Commit: `72bdd25`

### ✅ Task 7: FlowCoachView Part 2 (Conversation Management)
- Implemented conversation creation, switching, protocol banner, message rendering
- Files: `src/flow-coach-view.ts`, `tests/flow-coach-view.test.ts`
- Commit: `51654a1`

### ✅ Task 8: Integration with main.ts
- Registered FlowCoachView, added command, state persistence
- Fixed Task 7 issues (async/await, UI refresh)
- Files: `main.ts`, `src/flow-coach-view.ts`, `tests/main.test.ts`, `tests/__mocks__/obsidian.ts`
- Commit: `e1a41db`

**Current Test Status:** 651 tests passing, all 56 test suites passing

---

## What Remains (Tasks 9-11)

### Task 9: Remove All CLI Files

**Description:** Delete all CLI-related code, tests, documentation, and dependencies.

**Files to Delete:**
```bash
# Source files
src/cli.tsx
src/cli-entry.mts
src/obsidian-compat.ts
src/cli-approval.ts
src/components/InboxApp.tsx

# Build configuration
esbuild.cli.mjs

# Documentation
docs/gtd-coach-cli.md
docs/cli-architecture.md
docs/cli-ink-usage.md
docs/manual-testing-custom-reviews.md

# Tests
tests/cli.test.ts
tests/cli-approval.test.ts
tests/cli-opening-message.test.ts
tests/cli-protocol-integration.test.ts
tests/cli-repl-tools.test.ts
tests/cli-system-prompt.test.ts
tests/components/InboxApp.test.tsx
```

**Package.json Changes:**
```json
// Remove from "scripts":
"build:cli": "node esbuild.cli.mjs",
"cli": "node dist/cli.mjs"

// Remove from "dependencies":
"ink": "^5.2.1",
"react": "^18.3.1",
"wrap-ansi": "^9.0.0"

// Remove from "devDependencies":
"@types/react": "^18.3.11"
```

**Steps:**
1. Use `git rm` for all files to preserve history
2. Update `package.json` to remove CLI scripts and dependencies
3. Run `npm install` to update lockfile
4. Run `npm test` to verify no regressions (should have ~620 tests remaining)
5. Commit with message: `refactor: remove CLI code, tests, docs, and dependencies`

**Plan Reference:** Lines 1775-1831 in implementation plan

---

### Task 10: Update CLAUDE.md

**Description:** Update project documentation to reflect CLI removal and coach pane addition.

**Changes Required:**

1. **Remove CLI documentation sections:**
   - "GTD Coach CLI" section under Common Commands (lines 45-150)
   - CLI tools paragraph in Architecture section
   - Reference to `cli-tools.ts` → update to `coach-tools.ts`
   - CLI test files from Test Files section

2. **Add Flow Coach documentation:**

Add new section under "Architecture":

```markdown
### Flow Coach Chat Pane

The plugin provides an in-Obsidian chat interface for GTD coaching conversations:

- **FlowCoachView** (`src/flow-coach-view.ts`) - Chat pane view with conversation history
- **CoachState** (`src/coach-state.ts`) - Conversation persistence and management
- **CoachMessageRenderer** (`src/coach-message-renderer.ts`) - Message, card, and approval rendering
- **CoachTools** (`src/coach-tools.ts`) - LLM tools for vault modifications and display cards
- **CoachProtocolBanner** (`src/coach-protocol-banner.ts`) - Protocol suggestion UI

**Features:**
- Persistent conversation history across sessions
- Multi-sphere access with protocol filtering
- Inline tool approvals for suggested changes
- Structured project/action cards
- Protocol auto-suggestions based on time
- Markdown message rendering

**Commands:**
- `open-flow-coach` - Opens Flow Coach view in right sidebar
```

3. **Update test files list:**
   - Remove: All CLI test files
   - Update: `cli-tools.test.ts` → `coach-tools.test.ts`
   - Add: `coach-state.test.ts`, `coach-message-renderer.test.ts`, `coach-protocol-banner.test.ts`, `flow-coach-view.test.ts`

4. **Update commands list:**
   - Add `open-flow-coach` to commands section

**Steps:**
1. Remove CLI-specific sections from CLAUDE.md
2. Add Flow Coach architecture documentation
3. Update test file listings
4. Update command listings
5. Run `npm test` to verify no issues
6. Commit with message: `docs: update CLAUDE.md to reflect CLI removal and coach pane addition`

**Plan Reference:** Lines 1835-1883 in implementation plan

---

### Task 11: Add CSS Styling

**Description:** Add CSS styling for the Flow Coach view.

**Files to Create/Modify:**

1. **Create `styles/coach.css`** with all coach view styles (see full CSS in plan lines 1897-2183)

2. **Modify `styles.css`** to import:
```css
@import 'coach.css';
```

**Key CSS Classes:**
- `.flow-coach-view` - Main container
- `.coach-header` - Header with title and dropdown
- `.coach-protocol-banner` - Protocol suggestion banner
- `.coach-messages` - Messages area
- `.coach-message-user` / `.coach-message-assistant` - Message bubbles
- `.coach-card` / `.coach-card-project` / `.coach-card-action` - Display cards
- `.coach-tool-block` - Tool approval blocks
- `.coach-input-area` - Input section

**Steps:**
1. Create `styles/coach.css` with complete CSS (copy from plan)
2. Add `@import 'coach.css';` to `styles.css`
3. Test in Obsidian by opening the coach view
4. Adjust colors/spacing if needed for consistency with theme
5. Commit with message: `style: add CSS styling for flow coach view`

**Plan Reference:** Lines 1887-2191 in implementation plan

---

## Outstanding Issues / Questions

### From Task 8 Code Review

**Settings Migration Approval Needed:**

The settings storage format has changed from flat structure to nested:

```typescript
// Old format (pre-Task 8)
{
  anthropicApiKey: "...",
  spheres: [...],
  // ... all settings at top level
}

// New format (Task 8)
{
  settings: { /* all previous settings */ },
  coachState: { /* new coach state */ }
}
```

The backwards compatibility logic in `main.ts` (lines 190-199) handles reading old data:
```typescript
this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || data);
```

This is a **one-way migration**. Once a user upgrades and saves, they cannot downgrade without data loss.

**Question for Ben:** Is this migration strategy acceptable for the beta plugin? Should we add a version marker or additional documentation?

**Location:** `main.ts:190-206`

---

## How to Continue

### Option 1: Continue with subagent-driven-development skill

In a new Claude Code session:

```
I'm continuing the Flow Coach chat pane implementation from the handoff document at:
docs/plans/2025-11-02-implementation-handoff.md

We're in the worktree at: /Users/ben/repos/flow/.worktrees/flow-coach-chat-pane

Tasks 1-8 are complete (651 tests passing). I need to complete Tasks 9-11:
- Task 9: Remove CLI files
- Task 10: Update CLAUDE.md
- Task 11: Add CSS styling

Please use superpowers:subagent-driven-development to execute these remaining tasks.
```

### Option 2: Manual execution

You can also execute the remaining tasks manually:

1. **Task 9:** Use the file deletion list and package.json changes above
2. **Task 10:** Make the CLAUDE.md changes outlined
3. **Task 11:** Copy the CSS from the implementation plan

Then use `superpowers:finishing-a-development-branch` to complete the work.

---

## Test Expectations

After Task 9 (CLI removal):
- Expected tests: ~620 (down from 651 after removing ~31 CLI tests)
- All suites should still pass

After Task 10 (CLAUDE.md update):
- No test changes expected
- Documentation should be updated

After Task 11 (CSS):
- No test changes expected
- Manual testing in Obsidian required

---

## Final Steps (After Tasks 9-11)

Once all tasks are complete:

1. **Run final verification:**
   ```bash
   npm test          # All tests should pass
   npm run build     # Should build without errors
   ```

2. **Use finishing-a-development-branch skill:**
   - Reviews entire implementation
   - Validates all requirements met
   - Presents options (merge, PR, cleanup)

3. **Create pull request or merge:**
   - Title: "Replace CLI with Flow Coach chat pane"
   - Include summary of changes
   - Reference design document

---

## Key Files Reference

**Implementation:**
- `src/types.ts` - Core types
- `src/coach-state.ts` - State management
- `src/coach-tools.ts` - Coach tools (renamed from cli-tools)
- `src/coach-message-renderer.ts` - Message rendering
- `src/coach-protocol-banner.ts` - Protocol banner
- `src/flow-coach-view.ts` - Main view
- `main.ts` - Plugin integration

**Tests:**
- `tests/coach-state.test.ts`
- `tests/coach-tools.test.ts`
- `tests/coach-message-renderer.test.ts`
- `tests/coach-protocol-banner.test.ts`
- `tests/flow-coach-view.test.ts`
- `tests/main.test.ts`

**Documentation:**
- `docs/plans/2025-11-02-flow-coach-chat-pane-design.md` - Design doc
- `docs/plans/2025-11-02-flow-coach-chat-pane.md` - Implementation plan
- `CLAUDE.md` - To be updated in Task 10

**Styling:**
- `styles/coach.css` - To be created in Task 11
- `styles.css` - To be updated in Task 11

---

## Git Status

**Branch:** `feature/flow-coach-chat-pane`
**Latest Commit:** `e1a41db feat: integrate flow coach view with main plugin`
**Commits Since Start:** 9 commits
**Working Directory:** Clean (all changes committed)

**Recent Commits:**
```
e1a41db feat: integrate flow coach view with main plugin
51654a1 feat: add conversation management to flow coach view
72bdd25 feat: add flow coach view basic structure with header and input
87fa368 feat: add protocol suggestion banner component
83549d6 feat: add coach message renderer with markdown, cards, and tool approvals
c77cc23 refactor: rename CLI tools to coach tools and add display tools
ef15d11 feat: add coach state management with conversation lifecycle
27d38f3 feat: add coach conversation and card types
171be51 Add Flow Coach chat pane design document
```

---

## Dependencies

**Added:**
- `uuid@13.0.0` - For conversation IDs
- `@types/uuid@10.0.0` - TypeScript types

**To Remove (Task 9):**
- `ink@5.2.1` - React for terminals (CLI only)
- `react@18.3.1` - React (CLI only)
- `wrap-ansi@9.0.0` - ANSI wrapping (CLI only)
- `@types/react@18.3.11` - React types (CLI only)

**Existing (Used):**
- `marked` - Markdown rendering (already in project)
- All other existing dependencies unchanged

---

## Notes for Next Session

1. **Context:** This is a worktree at `.worktrees/flow-coach-chat-pane` off the main repo
2. **Skills:** We've been using `superpowers:subagent-driven-development` with code review between tasks
3. **Approach:** TDD for all tasks - write failing tests first
4. **Standards:** Follow all rules in CLAUDE.md and Ben's global instructions
5. **Question:** The settings migration question should be answered before final merge
6. **Manual Testing:** After Task 11, the view should be manually tested in Obsidian

---

## Success Criteria

Implementation is complete when:
- [ ] All CLI files removed (Task 9)
- [ ] CLAUDE.md updated (Task 10)
- [ ] CSS styling added (Task 11)
- [ ] All tests passing (~620 tests)
- [ ] Builds without errors
- [ ] View opens in Obsidian and renders correctly
- [ ] Conversations persist across sessions
- [ ] Protocol banners appear as expected
- [ ] Tool approvals work
- [ ] Settings migration question answered

---

**End of Handoff Document**
