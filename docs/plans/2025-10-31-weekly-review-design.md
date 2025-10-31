# Weekly Review Flow Design

## Overview

The CLI will guide users through a comprehensive GTD weekly review when requested. The AI coach enters review mode through prompt engineering, walking users step-by-step through the standard GTD weekly review process.

## Architecture

The review uses conversational guidance within the existing CLI conversation system. The AI maintains awareness of which review step it's on through conversation history. No new UI components or state machines are needed.

### Core Components

- **System prompt addition** - Teaches the AI how to conduct weekly reviews
- **Existing CLI tools** - Uses move_to_focus, update_next_action, update_project, create_project
- **Existing approval workflow** - All tool calls require user approval before execution
- **GTD context** - Uses existing projects, nextActions, somedayItems, inboxItems from system prompt

### Review Mode Activation

The AI detects weekly review requests through the system prompt. When users ask for help with a weekly review, the AI recognises the intent and begins the structured review workflow.

## Weekly Review Steps

The review follows standard GTD weekly review practice:

### 1. Get Clear - Process Inbox

The AI shows inbox count and previews items. Users process each item using existing inbox processing flow. The goal is inbox to zero.

### 2. Get Current - Review Projects

The AI identifies stalled projects (no next actions). For each stalled project, the AI asks whether it needs actions, should move to someday, or should be archived. The AI suggests improvements to vague project outcomes using the update_project tool.

### 3. Review Next Actions

The AI shows all next actions from the central file. It identifies vague or unclear actions and suggests improvements using the update_next_action tool. The AI asks which actions should move to focus for the week.

### 4. Review Someday/Maybe

The AI shows someday items. It asks whether any are ready to become projects or next actions. The AI identifies items that are no longer relevant.

### 5. Review Waiting-For

The AI shows all waiting-for items across the vault. It identifies items that need follow-up, especially those with past due dates. The AI suggests converting items to next actions when unblocked.

### 6. Get Creative - Set Focus

The AI reviews current focus (clearing if auto-clear didn't run). Based on priorities and the review, it suggests actions to add to focus for the week using the move_to_focus tool.

Each step shows relevant data, then asks "Ready to move to the next step?" or accepts questions before proceeding.

## System Prompt Addition

The system prompt will include this section:

```
Weekly Review Protocol:
When the user asks for help with a weekly review, guide them through these steps:
1. Process inbox to zero
2. Review projects (identify stalled, suggest improvements)
3. Review next actions (improve clarity, suggest focus items)
4. Review someday/maybe (activate items, prune irrelevant)
5. Review waiting-for (identify follow-ups)
6. Set weekly focus

For each step:
- Present relevant data using the context you have
- Highlight issues (stalled projects, vague actions, overdue items)
- Suggest improvements using available tools
- Wait for acknowledgment before proceeding
- Accept questions or requests to skip steps
```

## Tool Usage

The review uses existing CLI tools:

**During project review:**

- update_project - Add next actions to stalled projects, update descriptions, change status
- create_project - Convert someday items to projects

**During next actions review:**

- update_next_action - Improve vague actions
- move_to_focus - Add important actions to weekly focus

**During someday/maybe review:**

- create_project - Activate someday items as projects
- update_project - Add someday items as next actions to existing projects

**During waiting-for review:**

- update_next_action - Convert waiting-for items to active next actions

## Approval Workflow

All tool calls follow the existing CLI approval pattern:

1. AI suggests a change
2. User approves or rejects each suggestion
3. Changes are applied via FileWriter
4. Review continues

## Implementation

The implementation requires only one change:

1. Add the Weekly Review Protocol section to buildSystemPrompt() in src/cli.tsx

No new code, classes, or UI components are needed. The AI handles the entire flow conversationally.
