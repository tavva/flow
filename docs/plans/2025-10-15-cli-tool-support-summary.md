# CLI Tool Support - Implementation Plan Summary

**Date:** 15 October 2025  
**Feature:** Enable CLI GTD coach to suggest and apply modifications with user approval

---

## Overview

This implementation adds tool calling capabilities to the CLI GTD coach, allowing it to suggest and apply improvements to projects and next actions. The user reviews and approves each suggestion before it's applied to vault files.

## Task Breakdown

All tasks follow TDD approach: write test → verify failure → implement → verify pass → commit.

### Task 1: Add Tool Types to Language Model Interface

**File:** `docs/plans/2025-10-15-cli-tool-support-task-1.md`

Add TypeScript interfaces for tool support to `src/language-model.ts`:

- `ToolDefinition` - schema for tool parameters
- `ToolCall` - LLM's request to call a tool
- `ToolResult` - execution result to return to LLM
- `ToolCallResponse` - LLM response with optional tool calls
- Optional `sendMessageWithTools()` method on `LanguageModelClient`

**Dependencies:** None  
**Estimated time:** 15-20 minutes

---

### Task 2: Create CLI Approval Handler

**File:** `docs/plans/2025-10-15-cli-tool-support-task-2.md`

Create `src/cli-approval.ts` with approval UI:

- `presentToolCallsForApproval()` - main function
- Inline mode for single tool (y/n/skip)
- Batch mode for multiple tools (numbered selection)
- Parse "all", "none", "1,3,5" inputs
- Format each tool type for display

**Dependencies:** Task 1  
**Estimated time:** 30-40 minutes

---

### Task 3: Create Tool Definitions and Executor

**File:** `docs/plans/2025-10-15-cli-tool-support-task-3.md`

Create `src/cli-tools.ts` with:

- `CLI_TOOLS` array defining 4 tools
- `ToolExecutor` class routing to appropriate methods
- Stub implementations (real logic in Task 4)

Tools:

1. `move_to_hotlist` - Add action to hotlist
2. `update_next_action` - Rename/improve action
3. `add_next_action_to_project` - Add new action
4. `update_project_status` - Change project status

**Dependencies:** Task 1  
**Estimated time:** 30-40 minutes

---

### Task 4: Implement Tool Execution Logic

**File:** `docs/plans/2025-10-15-cli-tool-support-task-4.md`

Fill in ToolExecutor method implementations:

- `moveToHotlist()` - Find action, extract sphere, add to settings
- `updateNextAction()` - Find and replace action text in file
- `addNextActionToProject()` - Use FileWriter to add action
- `updateProjectStatus()` - Update frontmatter via processFrontMatter

**Dependencies:** Task 3  
**Estimated time:** 45-60 minutes

---

### Task 5: Add Tool Support to Anthropic Client

**File:** `docs/plans/2025-10-15-cli-tool-support-task-5.md`

Implement `sendMessageWithTools()` in `src/anthropic-client.ts`:

- Convert tools to Anthropic format
- Parse `tool_use` content blocks from response
- Combine multiple text blocks
- Handle system messages correctly

**Dependencies:** Task 1  
**Estimated time:** 30-40 minutes

---

### Task 6: Add Tool Support to OpenAI Compatible Client

**File:** `docs/plans/2025-10-15-cli-tool-support-task-6.md`

Implement `sendMessageWithTools()` in `src/openai-compatible-client.ts`:

- Convert tools to OpenAI function format
- Parse `tool_calls` from response message
- Handle string and array content formats
- Network error handling

**Dependencies:** Task 1  
**Estimated time:** 30-40 minutes

---

### Task 7: Update System Prompt for Tool Usage

**File:** `docs/plans/2025-10-15-cli-tool-support-task-7.md`

Update `buildSystemPrompt()` in `src/cli.ts`:

- Remove "read-only" language
- List 4 tool capabilities
- Mention user approval required
- Instruct LLM to use tools when appropriate

**Dependencies:** None (can run in parallel)  
**Estimated time:** 10-15 minutes

---

### Task 8: Integrate Tool Calling into REPL

**File:** `docs/plans/2025-10-15-cli-tool-support-task-8.md`

Update `runREPL()` in `src/cli.ts`:

- Add App and PluginSettings parameters
- Detect if client supports tools
- Call `sendMessageWithTools()` when available
- Implement `handleToolCalls()` function
- Show approval UI, execute tools, display results

**Dependencies:** Tasks 2, 3, 4, 5, 6, 7  
**Estimated time:** 60-75 minutes

---

## Execution Order

### Phase 1: Parallel Foundation (Tasks 1-3, 7)

Can be executed in parallel by different developers:

- Task 1: Type definitions
- Task 2: Approval handler
- Task 3: Tool definitions/executor skeleton
- Task 7: System prompt

### Phase 2: Implementation (Tasks 4-6)

Can be executed in parallel:

- Task 4: Tool execution logic
- Task 5: Anthropic client
- Task 6: OpenAI client

### Phase 3: Integration (Task 8)

Requires all previous tasks:

- Task 8: Wire everything together in REPL

## Total Estimated Time

- **Sequential execution:** 4-5 hours
- **Parallel execution (3 developers):** 2-2.5 hours
- **Manual testing:** 30 minutes
- **Documentation updates:** 15 minutes

**Total: 2.5-3 hours (parallel) or 5-6 hours (sequential)**

## Testing Strategy

Each task includes:

- Unit tests for new components
- Integration tests where applicable
- Regression testing via `npm test`
- Coverage threshold: ≥80%

## Success Criteria

- [x] CLI can suggest 4 types of modifications
- [x] User can approve/reject suggestions inline or batch
- [x] Changes persist correctly to vault files
- [x] Graceful degradation if tool support unavailable
- [x] Test coverage ≥80% for new code
- [x] No regressions in existing functionality
- [x] Network retry works for tool calls
- [x] Error handling for file operations

## Known Limitations (Future Work)

1. **Multi-turn tool conversations:** Currently doesn't send tool results back to LLM for follow-up response. LLM can't see execution results or adjust based on errors.

2. **Tool result format:** Need to implement provider-specific message history format for tool results (Anthropic uses `tool_result` blocks, OpenAI uses `role: "tool"` messages).

3. **Additional tools:** Only 4 tools in MVP. Future expansion can add: `create_project`, `move_action_to_project`, `update_project_priority`, `delete_next_action`, etc.

4. **Hotlist persistence:** Tool execution modifies settings.hotlist but saveSettings() needs to be called. May need callback or different persistence strategy for CLI context.

## Files Created/Modified

### New Files (8)

- `src/cli-tools.ts`
- `src/cli-approval.ts`
- `tests/language-model.test.ts`
- `tests/cli-approval.test.ts`
- `tests/cli-tools.test.ts`
- `tests/cli-tools-execution.test.ts`
- `tests/anthropic-client-tools.test.ts`
- `tests/openai-client-tools.test.ts`
- `tests/cli-system-prompt.test.ts`
- `tests/cli-repl-tools.test.ts`

### Modified Files (4)

- `src/language-model.ts` - Add tool types
- `src/anthropic-client.ts` - Add sendMessageWithTools
- `src/openai-compatible-client.ts` - Add sendMessageWithTools
- `src/cli.ts` - Update prompt, integrate tool calling

## Rollout Plan

1. **Development branch:** Implement all tasks
2. **Testing:** Run full test suite + manual testing
3. **Code review:** Review all changes
4. **Staging:** Test with real vault on non-production data
5. **Release:** Merge to main, bump version
6. **Documentation:** Update README with tool usage examples

## Rollback Plan

If issues discovered after release:

1. Revert commits for Task 8 (disables tool calling in REPL)
2. System reverts to read-only mode
3. All other code remains (foundation for future retry)
