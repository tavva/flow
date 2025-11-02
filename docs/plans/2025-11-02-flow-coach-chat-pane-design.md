# Flow Coach Chat Pane Design

**Date:** 2025-11-02
**Status:** Approved for implementation

## Overview

Replace the standalone CLI with an in-Obsidian chat pane for GTD coaching conversations. Users get a persistent chat interface with conversation history, protocol integration, inline tool approvals, and structured project/action cards.

## Design Decisions

### 1. Interface Type: Chat Pane

**Decision:** Dedicated sidebar view (like Focus or Waiting For) with message history and text input.

**Rationale:** Provides natural conversational interface whilst staying within Obsidian workflow. Users can keep the coach open whilst working on tasks.

### 2. Standalone CLI Fate: Complete Removal

**Decision:** Remove all CLI code, build system, and documentation entirely.

**Rationale:** Maintaining two interfaces creates duplication. The in-Obsidian experience is superior - direct file access, no vault path arguments, integrated with existing views.

### 3. Sphere Selection: Multi-Sphere by Default

**Decision:** Coach has access to all spheres at once. Review protocols can filter to specific sphere(s) via frontmatter.

**Rationale:** Most coaching conversations naturally span multiple spheres. Protocol filtering provides flexibility when needed (e.g., "work weekly review").

### 4. Protocol Triggering: Hybrid Approach

**Decision:** Auto-suggest time-matched protocols on view open + in-chat invocation via typed commands.

**Rationale:** Combines discoverability (banner suggestion) with power-user efficiency (type "run friday review"). Users not blocked if they dismiss banner.

### 5. Tool Approvals: Inline Blocks

**Decision:** Tool calls render as interactive blocks directly in chat with Approve/Reject buttons.

**Rationale:** Keeps context visible. User sees suggestion, approves/rejects, and result all in the same location. No modal interruption.

### 6. Conversation Persistence: Full History

**Decision:** All conversations saved in plugin data, restored across Obsidian sessions.

**Rationale:** Coaching conversations have context that's valuable to preserve. Users can return to previous discussions, reference past advice.

### 7. Conversation Management: Dropdown Selector

**Decision:** Dropdown at top of chat pane showing "New conversation" + list of recent conversations.

**Rationale:** Mirrors familiar pattern (Claude web interface). Simple, discoverable, doesn't clutter UI with sidebar list.

### 8. System Prompt: Build Once Per Conversation

**Decision:** System prompt built at conversation start, not rebuilt on each message.

**Rationale:** Token efficiency. AI sees its own tool executions in conversation history, so knows about changes it made. Staleness from manual edits acceptable - user can start new conversation.

### 9. Project/Action Cards: Display Tools

**Decision:** AI uses special `show_project_card` and `show_action_card` tools to render structured cards inline.

**Rationale:** Explicit control by AI. Read-only tools auto-execute (no approval needed). Makes project reviews much clearer than text descriptions.

### 10. Protocol Banner: Show All Matches

**Decision:** When multiple protocols match current time, show all with individual Start buttons.

**Rationale:** User should see all available options, not just first match. Uncommon to have >4-5 matches, so banner won't be unwieldy.

## Architecture

### Component Structure

```
FlowCoachView (src/flow-coach-view.ts)
├── Header: Title + Conversation Dropdown
├── Protocol Banner (src/coach-protocol-banner.ts)
│   └── Time-matched protocol suggestions
├── Message List (scrollable)
│   ├── Coach Messages (markdown rendered)
│   ├── User Messages (plain text)
│   ├── Display Cards (project/action cards)
│   └── Tool Approval Blocks (interactive)
└── Input Area
    ├── Multiline textarea
    └── Send button + Reset button
```

### Data Flow

1. **View opens** → Load active conversation from CoachState
2. **Scan protocols** → Match against current time
3. **Show banner** → If matches and conversation empty
4. **User types** → Message added to conversation
5. **Send message** → Build system prompt, call LLM
6. **LLM responds** → Render message + cards + tool approvals
7. **User approves tools** → Execute, show results
8. **Auto-save** → Conversation persisted after each exchange

### Key Types

```typescript
interface CoachConversation {
  id: string; // UUID
  title: string; // Auto-generated from first message
  messages: ChatMessage[];
  createdAt: number;
  lastUpdatedAt: number;
}

interface CoachState {
  conversations: CoachConversation[];
  activeConversationId: string | null;
}

interface DisplayCard {
  type: "project" | "action";
  data: ProjectCardData | ActionCardData;
}

interface ProjectCardData {
  title: string;
  description: string;
  priority: number;
  status: string;
  nextActionsCount: number;
  file: string;
}

interface ActionCardData {
  text: string;
  file: string;
  lineNumber: number;
  status: "incomplete" | "waiting" | "complete";
}

interface ToolApprovalBlock {
  toolCall: ToolCall;
  status: "pending" | "approved" | "rejected" | "error";
  result?: string;
  error?: string;
}
```

## UI Layout

```
┌─────────────────────────────────────┐
│ Flow Coach            [Dropdown ▼]  │ ← Header
├─────────────────────────────────────┤
│ 📅 Reviews available:               │ ← Protocol banner
│ • Weekly Review [Start]             │
│ • Friday Review [Start]             │
│ [Dismiss All]                       │
├─────────────────────────────────────┤
│                                     │
│ Coach: I've scanned your system...  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🎯 Website Redesign      [↗]    │ │ ← Project card
│ │ Priority: 1 • Status: live      │ │
│ │ 3 next actions                  │ │
│ │                                 │ │
│ │ Complete overhaul of site       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ You: Can you help prioritise?      │
│                                     │
│ Coach: Based on your priorities...  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⭐ Move to Focus                │ │ ← Tool approval
│ │ Add "Design mockups" to focus   │ │
│ │ [Approve] [Reject]              │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Type a message...                   │ ← Input area
│                                     │
│                        [Send] [↻]   │
└─────────────────────────────────────┘
```

## Implementation Files

### New Files

1. **`src/flow-coach-view.ts`** - Main view class (extends ItemView)
2. **`src/coach-state.ts`** - Conversation persistence and management
3. **`src/coach-message-renderer.ts`** - Message/card/approval rendering
4. **`src/coach-tools.ts`** - Renamed from cli-tools.ts, adds display tools
5. **`src/coach-protocol-banner.ts`** - Protocol suggestion UI component

### Modified Files

1. **`main.ts`** - Register coach view, add command, load/save state
2. **`src/types.ts`** - Add coach-specific types

### Removed Files

- `src/cli.tsx`
- `src/cli-entry.mts`
- `src/obsidian-compat.ts`
- `src/cli-approval.ts`
- `src/components/InboxApp.tsx` (if only used by CLI)
- `esbuild.cli.mjs`
- `docs/gtd-coach-cli.md`
- `docs/cli-architecture.md`
- `docs/cli-ink-usage.md`
- `docs/manual-testing-custom-reviews.md` (CLI-specific)

### Testing Files

**Remove:**

- `tests/cli.test.ts`
- `tests/cli-approval.test.ts`
- `tests/cli-opening-message.test.ts`
- `tests/cli-protocol-integration.test.ts`
- `tests/cli-repl-tools.test.ts`
- `tests/cli-system-prompt.test.ts`

**Update:**

- `tests/cli-tools.test.ts` → Rename to `tests/coach-tools.test.ts`
- `tests/cli-tools-execution.test.ts` → Update imports

**Add:**

- `tests/flow-coach-view.test.ts`
- `tests/coach-state.test.ts`
- `tests/coach-message-renderer.test.ts`

## Tool Architecture

### Existing Action Tools (require approval)

- `move_to_focus` - Add action to focus
- `update_next_action` - Improve action wording
- `create_project` - Create new project
- `update_project` - Update project description/actions

### New Display Tools (auto-execute, no approval)

- `show_project_card` - Render structured project card
- `show_action_card` - Render structured action card

### Tool Execution Flow

1. **LLM responds** with text + tool calls
2. **Display tools execute immediately** → Cards render inline
3. **Action tools show approval blocks** → User clicks Approve/Reject
4. **Tools execute** → Results shown in blocks
5. **Conversation continues** → Tool results visible to LLM

## Protocol Integration

### Auto-Suggestion

1. View opens → Scan protocols with `scanReviewProtocols()`
2. Match against time with `matchProtocolsForTime()`
3. If matches found AND conversation is new → Show banner
4. Banner lists all matched protocols with individual Start buttons
5. Clicking Start → Inject protocol into system prompt, begin protocol
6. Dismiss All → Hide banner for this conversation (stored in state)

### In-Chat Invocation

- Reuse `detectProtocolInvocation()` from CLI
- Patterns: "run weekly review", "start friday review", etc.
- Matches against protocol names/filenames
- Injects protocol content as system message
- AI begins following protocol step-by-step

### Sphere Filtering

- Protocol frontmatter can specify `spheres: [work, personal]`
- When protocol active, system prompt filters projects to those spheres
- No sphere specification → includes all spheres (default)

## Conversation Management

### Creating Conversations

- View opens with no active conversation → Create new
- "New conversation" in dropdown → Create new
- Reset button (↻) → Create new
- Auto-generated title from first user message (truncated to ~50 chars)

### Switching Conversations

- Dropdown shows recent conversations (most recent first)
- Click to switch → Load messages, rebuild system prompt with fresh vault data
- Active conversation highlighted in dropdown

### Pruning

- Keep last 50 conversations
- Auto-prune on conversation creation
- Oldest conversations deleted first

### Storage

- Saved in plugin data via `saveData()` (separate from settings)
- Auto-save after each message exchange
- Loaded on plugin load

## Error Handling

### Network Errors

- Reuse `withRetry()` with 5 attempts, exponential backoff
- Visual feedback in chat: `[Network error. Retrying in 2.0s... (attempt 2/5)]`
- Chat input disabled during retry
- Can cancel and start new message

### API Errors

- Authentication, rate limit, validation errors
- Show error message in chat (red background)
- Don't retry (not transient)
- Failed message not added to history

### Tool Execution Errors

- Show in tool approval block (red, with error text)
- Status: 'error'
- Other tools can still execute

### State Recovery

- Failed conversation load → Fallback to new conversation
- Show warning message
- Preserve existing conversations (don't delete)

## Message Rendering

### Markdown Support

- Reuse `marked` library
- Support: headings, lists, bold, italic, code blocks, links
- CSS styling (not terminal colors)

### Visual Design

- **User messages:** Right-aligned, light blue background, plain text
- **Coach messages:** Left-aligned, light grey background, markdown rendered
- **Display cards:** Rounded corners, clickable, icon based on type (🎯 project, ☑️ action)
- **Tool approval blocks:** Yellow background when pending, green when approved, grey when rejected, red when error
- **Timestamps:** On hover (not inline)

### Auto-scroll

- Always scroll to bottom when new message arrives
- Unless user manually scrolled up (preserve position)
- "Scroll to bottom" button appears when scrolled up

### Cards as Links

- Project cards: Click to open project file
- Action cards: Click to open file at line number
- Uses Obsidian's `workspace.openLinkText()` API

## System Prompt Construction

### Prompt Building (once per conversation start)

```typescript
function buildCoachSystemPrompt(
  app: App,
  settings: PluginSettings,
  protocol?: ReviewProtocol
): string {
  // Determine sphere filter
  let sphereFilter: string[] | null = null;
  if (protocol?.spheres && protocol.spheres.length > 0) {
    sphereFilter = protocol.spheres;
  }

  // Scan all projects
  const allProjects = await scanProjects();

  // Filter by protocol spheres if specified
  const projects = sphereFilter
    ? allProjects.filter((p) =>
        p.tags.some((tag) => sphereFilter.some((s) => tag === `project/${s}`))
      )
    : allProjects;

  // Scan GTD context (always all spheres)
  const gtdContext = await scanContext();

  // Build prompt (reuse logic from CLI buildSystemPrompt)
  return buildPrompt(projects, gtdContext, protocol);
}
```

### Prompt Content

- Role: GTD coach with access to full system
- Context: Projects (with hierarchy), next actions, someday items, inbox
- Capabilities: Prioritisation, review, methodology advice
- Tools available: Move to focus, update actions, create/update projects, show cards
- Communication style: Data-driven, concise, actionable
- Protocol content (if active): Injected at end of system prompt

### When to Rebuild

- **Once** at conversation start (new conversation only)
- **Not** on subsequent messages (token efficiency)
- **Not** when resuming conversation (uses original system prompt for token efficiency)

**Rationale:** Token efficiency prioritised. AI sees its own tool executions in history. Staleness from manual vault changes acceptable - user can start new conversation if context significantly outdated.

## Command Registration

### New Command

- ID: `open-flow-coach`
- Name: "Open Flow Coach"
- Icon: `message-circle` (or similar chat icon)
- Action: Open coach view in right sidebar (or activate if already open)

### Removed Commands

- All CLI-related commands (none existed - CLI was standalone script)

## Migration Notes

### For Users

- Existing plugin users: No migration needed (CLI was opt-in, separate from plugin)
- CLI users: Switch to in-Obsidian chat pane, no conversation history imported

### Breaking Changes

- Remove CLI entirely - users relying on terminal workflow must switch to Obsidian UI
- CLI-specific flags (--vault, --sphere) no longer exist

### Deprecation Path

- No deprecation period needed - CLI was beta/experimental feature
- Clear communication in release notes

## Open Questions

None - design approved.

## Future Enhancements (out of scope)

- Export conversation as markdown note
- Quick action buttons on cards (Add to Focus, Mark Complete)
- Conversation search/filtering
- Voice input support
- Multi-modal support (screenshot analysis)
