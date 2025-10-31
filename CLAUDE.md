# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that implements a GTD (Getting Things Done) coach for Flow-based vaults. The plugin uses AI to intelligently process inbox items into well-formed projects and quality next actions according to GTD principles.

**Key Capabilities:**

- AI-powered analysis of inbox items using Claude Sonnet 4 or OpenAI-compatible models
- Context-aware processing with knowledge of existing Flow projects and person notes
- Automatic creation and updating of Flow project files
- GTD-compliant next action generation
- Project and person suggestion based on existing vault contents
- Multiple LLM provider support (Anthropic, OpenAI-compatible/OpenRouter)
- Waiting For list management with `[w]` checkbox status
- Global view aggregating waiting-for items across all projects
- Keyboard-driven task status cycling ([ ] → [w] → [x])
- Focus for curating a focused set of next actions from across the vault
- Planning mode in sphere view for selecting actions to add to focus
- Validation and resolution when source files change

## Common Commands

### Development

```bash
# Development mode with auto-rebuild on file changes
npm run dev

# Type-check and build for production
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report (requires 80% coverage across all metrics)
npm run test:coverage
```

### Formatting

```bash
# Format all code with Prettier
npm run format

# Check if code is formatted without modifying
npm run format:check
```

### Evaluation Framework

```bash
# Run the GTD quality evaluation suite (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=your-key
npm run evaluate
```

The evaluation framework tests the AI processor against 15 curated test cases and generates detailed quality metrics. Results are saved to `evaluation/results/`. See `evaluation/README.md` for details.

### GTD Coach CLI

```bash
# Build the CLI (required first time or after changes)
npm run build:cli

# Interactive GTD coaching for a specific sphere
npm run cli -- --vault /path/to/vault --sphere work

# Or run directly
./dist/cli.mjs --vault /path/to/vault --sphere work
```

The CLI uses Ink (React for terminals) for multiline text input:

- Enter submits input
- Shift+Enter inserts newlines
- Pasted content preserves formatting

The CLI includes automatic retry logic for network errors with exponential backoff and user feedback.

**Output Formatting:**

- CLI output automatically wraps to terminal width using `wrap-ansi`
- Width detection uses `process.stdout.columns` (fallback: 80 columns)
- ANSI colours are preserved during wrapping

**Documentation:**

- `docs/gtd-coach-cli.md` - User guide and features
- `docs/cli-ink-usage.md` - Ink-specific usage details
- `docs/cli-architecture.md` - Build system and MockApp architecture (for developers)

**CLI Tools:**

The CLI provides the LLM with 4 tools to modify the vault (`src/cli-tools.ts`):

- `move_to_focus` - Add a next action to the focus for immediate attention
- `update_next_action` - Rename or improve the wording of an existing action
- `create_project` - Create a new Flow project with GTD-compliant structure
- `update_project` - Update an existing project's description or add next actions

The CLI requires user approval before executing any tool calls that modify the vault.

**Custom Review Routines:**

The CLI supports time-triggered custom review routines:

- **Review files location**: `{vault}/.flow/reviews/*.md`
- **Format**: Markdown with optional YAML frontmatter
- **Triggers**: Day of week + time period (morning/afternoon/evening)
- **Spheres**: Optional sphere filtering for multi-sphere reviews
- **Auto-suggestion**: Matching reviews are suggested on CLI startup with numbered selection
- **Manual invocation**: Request reviews anytime with patterns like "run friday review" or "start weekly review"
- **Protocol selection**: Number (1, 2), name ("friday"), or partial match at startup
- **Step-by-step**: AI follows protocol content and waits for acknowledgment between sections

**Selection Patterns:**

- Startup: Type number, name, or "no"
- During conversation: "run X review", "start X review", "begin X review", "X review"

**Testing**: See `docs/manual-testing-custom-reviews.md` for test scenarios and example protocols

**Protocol scanning** (`protocol-scanner.ts`):

- Finds all `.md` files in reviews directory
- Parses YAML frontmatter for triggers and spheres
- Extracts protocol name from first H1 heading (fallback to filename)
- Gracefully handles invalid YAML or missing frontmatter

**Protocol matching** (`protocol-matcher.ts`):

- Matches protocols against current day/time
- Time periods: morning (5am-12pm), afternoon (12pm-6pm), evening (6pm-5am)
- Evening period correctly handles midnight crossing
- Protocols without triggers are never auto-suggested but can be manually invoked

## Architecture

### Core Processing Flow

1. **Flow Scanner** (`src/flow-scanner.ts`) - Scans the Obsidian vault for Flow projects (files with `project/*` tags in frontmatter)
2. **Person Scanner** (`src/person-scanner.ts`) - Scans the vault for person notes (files with `person` tag)
3. **Inbox Scanner** (`src/inbox-scanner.ts`) - Scans designated inbox folders for files to process
4. **GTD Context Scanner** (`src/gtd-context-scanner.ts`) - Scans for inbox items, next actions, and someday items across the vault
5. **GTD Processor** (`src/gtd-processor.ts`) - Uses AI to analyze inbox items with context from existing projects and people
6. **LLM Factory** (`src/llm-factory.ts`) - Factory pattern for creating language model clients (Anthropic/OpenAI-compatible)
7. **Language Model Clients** (`src/anthropic-client.ts`, `src/openai-compatible-client.ts`) - Provider-specific AI integrations
8. **File Writer** (`src/file-writer.ts`) - Creates new project files or updates existing ones with proper Flow frontmatter
9. **Inbox Processing Controller** (`src/inbox-processing-controller.ts`) - Orchestrates the processing workflow
10. **Inbox Processing View** (`src/inbox-processing-view.ts`) - Main UI component for the inbox processing workflow
11. **Settings Tab** (`src/settings-tab.ts`) - Configuration interface for API keys and project defaults
12. **Validation** (`src/validation.ts`) - Input validation and error handling
13. **Errors** (`src/errors.ts`) - Custom error types and handling
14. **Network Retry** (`src/network-retry.ts`) - Automatic retry logic for network errors with exponential backoff
15. **Protocol Scanner** (`src/protocol-scanner.ts`) - Scans for review protocol files in vault
16. **Protocol Matcher** (`src/protocol-matcher.ts`) - Matches protocols to current day/time

### Utility Components

Supporting utilities for core functionality:

- **Project Filters** (`src/project-filters.ts`) - Filtering logic for templates and project status
- **Project Hierarchy** (`src/project-hierarchy.ts`) - Builds hierarchical tree structures from flat project lists
- **Deletion Offset Manager** (`src/deletion-offset-manager.ts`) - Tracks line deletions to adjust line numbers when processing multiple inbox items
- **Confirmation Modal** (`src/confirmation-modal.ts`) - Consistent UI for yes/no confirmation dialogs
- **Inbox Modal State** (`src/inbox-modal-state.ts`) - State management for inbox processing UI
- **Inbox Modal Utils** (`src/inbox-modal-utils.ts`) - Utility functions for inbox modal
- **Inbox Modal Views** (`src/inbox-modal-views.ts`) - View components for inbox modal
- **Inbox Types** (`src/inbox-types.ts`) - Type definitions for inbox processing
- **Inbox Item Persistence** (`src/inbox-item-persistence.ts`) - Persists inbox items across sessions
- **Project Title Prompt** (`src/project-title-prompt.ts`) - Generates prompts for project title suggestions

### Inbox Note Archiving and Source Links

When processing note-type inbox items (whole notes from the "Flow Inbox Folder"), the plugin archives the source note instead of deleting it, and adds a link back to the archived note for traceability:

- **Archive Folder** - Processed notes are moved to a configurable "Processed Inbox Folder Notes" folder (default: `Processed Inbox Folder Notes`)
- **Source Links** - Actions and projects created from archived notes include a wikilink back to the source: `([[note-name|source]])`
- **Link Placement** - Source links appear inline with the action text or in the project description
- **Line Items Unchanged** - Line-by-line processing from "Flow Inbox Files" folder still deletes the processed line (no archiving)

**Example outputs with source links:**

```markdown
# Next Actions file

- [ ] Call Dr. Smith's office ([[meeting-notes-2025-10-27|source]]) #sphere/personal

# Project file

---

## tags: project/work

# Website Redesign

Original inbox item: redesign website ([[project-brief|source]])

## Next actions

- [ ] Meet with designer
```

**Implementation:**

- `inbox-scanner.ts:92-125` - Archives note items instead of deleting, returns wikilink
- `inbox-processing-controller.ts:154-164` - Captures source link before persisting
- `file-writer.ts` - Appends source links to actions and project descriptions
- `inbox-item-persistence.ts` - Passes source links through to file writer

### Waiting For Support

The plugin supports GTD "Waiting For" items using `[w]` checkbox status:

- **Scanner** (`src/waiting-for-scanner.ts`) - Finds all `[w]` items across vault
- **View** (`src/waiting-for-view.ts`) - Aggregates waiting-for items in dedicated pane
- **Status Cycler** (`src/task-status-cycler.ts`) - Cycles checkbox status: [ ] → [w] → [x]
- **Visual Indicator** - Waiting-for items show 🤝 handshake emoji in sphere and focus views
- **AI Integration** - Processor recognizes waiting-for scenarios during inbox processing

### Someday/Maybe with Dates

The plugin supports adding optional dates to items in the Someday/Maybe file:

- **Editable Items** - When processing items to the Someday/Maybe file, you can edit the item text and add/remove multiple items
- **Date Picker UI** - A collapsible date picker allows setting dates for items
- **Format** - Dates are stored in YYYY-MM-DD format with a 📅 emoji (e.g., `- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal`)
- **Integration** - Works with the Reminders plugin for Obsidian to surface items at the appropriate time
- **Validation** - The `validateReminderDate()` function ensures dates are valid and properly formatted
- **Optional** - Dates are optional; items can be added to Someday/Maybe without a date
- **Multiple Items** - You can add multiple items to the Someday/Maybe file in one operation

**Example Someday/Maybe entries:**

```markdown
- [ ] Write a book 📅 2026-06-01 #sphere/personal
- [ ] Learn Spanish #sphere/personal
- [ ] Organize team retreat 📅 2026-03-15 #sphere/work
```

### Due Date Support

The plugin supports optional due dates for all processing action types:

- **All Action Types** - Next actions, projects, someday items, waiting-for items, and person notes all support dates
- **Context-Aware Labels** - UI labels adapt based on action type (due date, reminder date, follow-up date, target date)
- **Consistent Format** - All dates use 📅 YYYY-MM-DD format for compatibility with Reminders plugin
- **Minimal UI** - Collapsible date section hidden by default to avoid clutter
- **Optional** - Dates are never required; only add when meaningful
- **Manual Entry** - No AI suggestions for dates; user sets them explicitly during review

**Date semantic meaning by action type:**

- **Next actions**: Due date (when action must be completed)
- **Projects**: Target date (desired completion timeline)
- **Someday items**: Reminder date (when to review the item)
- **Waiting-for items**: Follow-up date (when to check back)
- **Person notes**: Follow-up date (when to reach out)

**Example entries with dates:**

```markdown
# Next Actions file

- [ ] Call dentist for appointment 📅 2025-11-15 #sphere/personal
- [w] Wait for Sarah's feedback 📅 2025-11-01 #sphere/work

# Project file

## Next actions

- [ ] Draft proposal outline 📅 2025-11-05
```

### Focus Support

The plugin supports creating a curated "focus" of next actions to work on:

- **Manual Reordering** - Pin items to a "Pinned" section at the top and reorder via drag-and-drop
- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files by searching for checkbox patterns
- **FocusValidator** (`src/focus-validator.ts`) - Validates and resolves focus items when files change, searches for moved lines
- **FocusView** (`src/focus-view.ts`) - Displays focus in right sidebar with actions grouped by project/sphere
- **FocusEditorMenu** (`src/focus-editor-menu.ts`) - Right-click context menu for adding/removing actions from focus
- **FocusAutoClear** (`src/focus-auto-clear.ts`) - Automatic clearing and archiving of focus items at a configured time each day
- **SphereView Planning Mode** - Toggle planning mode to click actions and add/remove from focus
- **Commands** - "Open Focus" command (`open-focus`) and ribbon icon with `list-checks` icon
- **Focus Item Actions** - Mark complete, convert to waiting-for, pin/unpin, or remove from focus
- **File Navigation** - Click action text to open source file at correct line in split pane

**Workflow:**

1. **Via Sphere View (Planning Mode):**
   - Open a sphere view (work, personal, etc.)
   - Click "Planning Mode" button to enter planning mode
   - Click next actions from projects or general actions to add them to the focus
   - Selected actions show visual indicator (checkmark)
   - Exit planning mode when done selecting

2. **Via Context Menu (Direct from Files):**
   - Right-click on any checkbox line in a project or next actions file
   - Select "Add to Focus" or "Remove from Focus" from context menu
   - Sphere is automatically determined from project tags or inline #sphere/X tags

3. **Using the Focus:**
   - Open focus view to see curated list of actions
   - Pin important items to "Pinned" section at top
   - Drag-and-drop to reorder pinned items
   - Work through focus, marking complete or converting to waiting-for
   - Unpin items when priorities change

**Storage:**

Focus items are stored in plugin settings as `FocusItem[]` with:

- `file`: Source file path
- `lineNumber`: Last known line number
- `lineContent`: Full line content for exact matching
- `text`: Display text (action without checkbox)
- `sphere`: Which sphere the action belongs to
- `isGeneral`: Whether from Next Actions file vs project file
- `addedAt`: Timestamp for ordering
- `isPinned`: Whether item is pinned to top section (optional, defaults to false)

**Pinned Item Ordering:**

Pinned items appear at the front of the `focus` array in their display order. Array position determines rendering order for pinned items. Unpinned items follow in the array but are rendered using project/sphere grouping regardless of array position.

### Sub-Projects Support

The plugin supports hierarchical project relationships where projects can have sub-projects:

- **Project Hierarchy** (`src/project-hierarchy.ts`) - Builds hierarchical tree structures from flat project lists
  - `buildProjectHierarchy()` - Creates tree from projects, detects cycles, calculates depths
  - `flattenHierarchy()` - Depth-first traversal for rendering with indentation
  - `extractParentPath()` - Converts wikilink `[[Parent]]` to file path
  - `getProjectDisplayName()` - Returns display name with parent context
- **Parent-Project Frontmatter** - Sub-projects reference parents using `parent-project: "[[Parent Name]]"` in frontmatter
- **Arbitrary Nesting** - Sub-projects can have their own sub-projects (unlimited depth)
- **Hierarchy Views** - Sphere view shows indented hierarchy (24px per level), focus shows parent context
- **Inbox Modal** - AI can suggest creating projects as sub-projects; UI provides checkbox toggle and parent selector
- **Action Aggregation** - Parent projects aggregate next actions from all descendants recursively

**Important Implementation Detail:** When building hierarchies with filtering (e.g., by sphere), always build hierarchy from ALL projects first, then filter. This preserves parent-child relationships even when parent is in different sphere or status:

```typescript
// ✅ CORRECT
const hierarchy = buildProjectHierarchy(allProjects);
const flattenedHierarchy = flattenHierarchy(hierarchy);
const filtered = flattenedHierarchy.filter(/* sphere filter */);

// ❌ WRONG - breaks relationships
const filtered = allProjects.filter(/* sphere filter */);
const hierarchy = buildProjectHierarchy(filtered);
```

### Project Review Support

The plugin includes AI-powered project review to help maintain a healthy GTD system:

- **ProjectReviewer** (`src/project-reviewer.ts`) - Uses AI to review all projects in a sphere and suggest improvements
- **ReviewModal** (`src/review-modal.ts`) - UI for selecting sphere and displaying review results
- **SystemAnalyzer** (`src/system-analyzer.ts`) - Analyzes GTD system state to detect issues like stalled projects and large inboxes
- **Command** - "Review projects" command (`flow-review-projects`) opens the review modal

**Review Capabilities:**

The AI reviewer can suggest:

- **Project improvements** - Better descriptions, clearer outcomes, more specific next actions
- **Project merges** - Combining related or overlapping projects
- **Status changes** - Moving projects to "someday" or marking as "complete"
- **Next action improvements** - Making actions more specific and actionable

The system analyzer detects:

- Stalled projects (no next actions)
- Inbox overflow (configurable threshold)
- Projects that may need attention

### Sphere Views

The plugin provides dedicated views for each configured sphere (work, personal, etc.):

- **SphereView** (`src/sphere-view.ts`) - Custom Obsidian view showing all projects and next actions for a sphere
- Each sphere gets a dedicated command to open its view
- Shows project hierarchy with indentation
- Aggregates next actions from all projects in the sphere
- Includes planning mode for adding actions to focus
- Filter-as-you-type search for projects and actions

### Sphere View Filter Search

The sphere view includes filter-as-you-type search:

- **Search input:** Sticky header below sphere name, filters as you type
- **Matches:** Action text and project names (case-insensitive substring)
- **Keyboard shortcuts:**
  - Escape: Clear search query
- **Behaviour:**
  - Instant filtering on every keystroke
  - Projects shown if name matches OR has matching actions
  - Hierarchy preserved (sub-project matches show parents)
  - Empty state when no matches found
  - Search clears on view refresh

### Flow Project Structure

Flow projects are Markdown files with specific frontmatter and sections:

```markdown
---
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
---

# Project Title

Project description and context.

## Next actions

- [ ] GTD-quality actions ready to do now
```

**Sub-project example:**

```markdown
---
creation-date: 2025-10-15 14:30
priority: 2
tags: project/work
status: live
parent-project: "[[Engineering AI Strategy]]"
---

# Ship initial AI-first experiment

First hands-on exploration of AI capabilities in production.

## Next actions

- [ ] Define success metrics for experiment
- [ ] Choose initial use case to test
```

**Important:**

- Projects are identified by `project/*` tags in frontmatter
- All next actions MUST be Markdown checkboxes (`- [ ]`)
- Next actions section contains immediately actionable items
- Sub-projects use `parent-project: "[[Parent Name]]"` wikilink format in frontmatter

### GTD Categories

The processor categorizes items into:

- **next-action**: Single completable actions (enhanced for specificity)
- **project**: Multi-step outcomes (requires outcome + clear next actions)
- **reference**: Information to store (not actionable)
- **someday**: Future aspirations (not currently committed)
- **person**: People-related items to be added to person notes

### API Integration

The plugin supports multiple LLM providers through a factory pattern:

**Anthropic Integration:**

- Model: `claude-sonnet-4-20250514` (default)
- `dangerouslyAllowBrowser: true` (safe - Obsidian plugins run in Electron)
- British English for all AI responses
- Structured JSON output from Claude

**OpenAI-Compatible Integration:**

- Default endpoint: OpenRouter (`https://openrouter.ai/api/v1`)
- Default model: `openrouter/anthropic/claude-3.5-sonnet`
- Supports any OpenAI-compatible API (OpenRouter, local providers, etc.)
- Same British English and structured JSON requirements

## Testing

### Unit Tests

- Located in `tests/` directory
- Use Jest with ts-jest preset
- Mock Obsidian API via `tests/__mocks__/obsidian.ts`
- Coverage thresholds: 80% for branches, functions, lines, statements

### Test Files

Core functionality tests:

- `flow-scanner.test.ts` - Vault scanning and project parsing
- `gtd-processor.test.ts` - AI processing logic
- `gtd-context-scanner.test.ts` - GTD context scanning (inbox, actions, someday)
- `file-writer.test.ts` - File creation and updates
- `validation.test.ts` - Input validation
- `inbox-scanner.test.ts` - Inbox folder scanning functionality
- `inbox-processing-controller.test.ts` - Inbox processing workflow orchestration
- `inbox-processing-view.test.ts` - Inbox processing view UI
- `inbox-modal-state.test.ts` - Inbox modal state management
- `inbox-item-persistence.test.ts` - Inbox item persistence across sessions
- `person-scanner.test.ts` - Person note scanning

Focus tests:

- `focus-validator.test.ts` - Focus item validation and line finding
- `focus-view.test.ts` - Focus view rendering and interactions
- `focus-integration.test.ts` - End-to-end focus workflows
- `focus-editor-menu.test.ts` - Context menu checkbox detection and focus operations
- `focus-auto-clear.test.ts` - Automatic focus clearing functionality
- `action-line-finder.test.ts` - Action line number detection

Sphere and project tests:

- `sphere-view.test.ts` - Sphere view and planning mode
- `sphere-view-filter.test.ts` - Sphere view filter search functionality
- `project-hierarchy.test.ts` - Project hierarchy building, cycle detection, and display utilities
- `project-reviewer.test.ts` - AI-powered project review
- `project-filters.test.ts` - Project filtering logic
- `project-title-prompt.test.ts` - Project title generation prompts

Waiting For tests:

- `waiting-for-scanner.test.ts` - Waiting-for item scanning
- `waiting-for-view.test.ts` - Waiting-for view rendering
- `task-status-cycler.test.ts` - Task status cycling ([ ] → [w] → [x])

LLM integration tests:

- `language-model.test.ts` - Language model abstraction
- `anthropic-client-tools.test.ts` - Anthropic client with tool use
- `openai-client-tools.test.ts` - OpenAI-compatible client with tool use
- `network-retry.test.ts` - Network retry logic
- `network-error-handling.test.ts` - Network error handling

CLI tests:

- `cli.test.ts` - CLI tool integration
- `cli-tools.test.ts` - CLI tool implementations
- `cli-tools-execution.test.ts` - CLI tool execution
- `cli-repl-tools.test.ts` - CLI REPL tool handling
- `cli-approval.test.ts` - CLI approval workflows
- `cli-opening-message.test.ts` - CLI opening message generation
- `cli-system-prompt.test.ts` - CLI system prompt construction
- `cli-protocol-integration.test.ts` - CLI protocol scanning and selection
- `protocol-scanner.test.ts` - Review protocol file scanning
- `protocol-matcher.test.ts` - Time-based protocol matching

Other tests:

- `system-analyzer.test.ts` - GTD system analysis
- `deletion-offset-manager.test.ts` - Line deletion offset tracking
- `types.test.ts` - TypeScript type definitions
- `main.test.ts` - Plugin main entry point
- `release-beta.test.ts` - Beta release script

**Note:** Test coverage may vary - check `tests/` directory for current test files.

### Running Single Tests

```bash
# Run a specific test file
npm test -- flow-scanner.test

# Run tests matching a pattern
npm test -- --testNamePattern="should scan vault"
```

## Build System

Uses esbuild for fast compilation:

- Entry point: `main.ts`
- Output: `main.js` (bundled)
- Development: `esbuild.config.mjs` runs in watch mode
- Production: Includes minification and type checking

## Code Formatting

The project uses Prettier for consistent code formatting:

- **Configuration**: `.prettierrc.json` defines formatting rules
- **EditorConfig**: `.editorconfig` ensures editor consistency
- **Style**: 2-space indentation, 100-character line width, semicolons, double quotes
- **Auto-format**: Run `npm run format` before committing
- **CI Check**: GitHub Actions automatically runs `npm run format:check` on all PRs and pushes

## Important Patterns

### Adding a New GTD Category

1. Update `GTDProcessingResult` type in `src/types.ts`
2. Modify prompt in `src/gtd-processor.ts` `buildProcessingPrompt()`
3. Update response parsing in `parseResponse()`
4. Add test cases to `evaluation/test-cases.json`

### Modifying Project Frontmatter

1. Update `FlowProject` interface in `src/types.ts`
2. Modify parsing in `src/flow-scanner.ts` `parseProjectFile()`
3. Update file writing in `src/file-writer.ts` `createProjectFile()`
4. Add validation in `src/validation.ts` if needed

### Changing AI Behavior

1. Edit the prompt in `src/gtd-processor.ts` `buildProcessingPrompt()`
2. Run evaluation suite to measure impact: `npm run evaluate`
3. Compare results in `evaluation/results/` to ensure quality doesn't regress
4. Update test cases in `evaluation/test-cases.json` if expectations change

## Code Quality Standards

### GTD Next Action Quality

Next actions MUST:

- Start with an action verb
- Be specific and completable in one sitting
- Include context (who, where, what specifically)
- Be 15-150 characters long
- Avoid vague terms ("something", "maybe", "stuff")

Examples:

- Good: "Call Dr. Smith's office at 555-0123 to schedule cleaning"
- Bad: "dentist"

### Project Outcomes

Project outcomes MUST:

- Be stated as completed outcomes (past tense ideal)
- Be clear and measurable
- Define "done"

Examples:

- Good: "Website redesign complete and deployed"
- Bad: "Work on website"

## Obsidian Plugin Specifics

### Plugin Entry Point

`main.ts` - Extends Obsidian's `Plugin` class:

- `onload()`: Registers ribbon icon, commands, settings tab
- `onunload()`: Cleanup
- Settings stored via `loadData()`/`saveData()`

### Commands

- `process-inbox`: Opens the inbox processing view
- `quick-capture`: Same as process-inbox (alias for discoverability)
- `cycle-task-status`: Cycles checkbox status on current line ([ ] → [w] → [x])
- `open-waiting-for-view`: Opens the Waiting For view in right sidebar
- `open-focus`: Opens the Focus view in right sidebar
- `flow-review-projects`: Opens the project review modal to get AI suggestions for improvements
- `sphere-view-{sphere}`: Opens a sphere view (dynamically created for each configured sphere)

### UI Components

- Ribbon icon: 'inbox' icon for quick access
- Settings tab: API key and default project settings
- Modal: Multi-step inbox processing workflow

## Dependencies

### Production

- `@anthropic-ai/sdk`: Claude AI integration

### Development

- `obsidian`: Obsidian API types
- `esbuild`: Fast bundler via `esbuild.config.mjs`
- `typescript`: Type checking
- `jest` + `ts-jest`: Testing framework with 80% coverage requirements
- `ts-node`: For running evaluation scripts

## Prompt Engineering

The main AI prompt is in `src/gtd-processor.ts` `buildProcessingPrompt()`. It:

- Uses British English
- Provides clear category definitions
- Includes examples
- Requests structured JSON output
- Passes existing project context for suggestions
- Enforces GTD quality standards

When modifying prompts, ALWAYS run the evaluation suite afterward to measure impact on quality metrics.

## Plugin Settings

The plugin supports several configurable settings accessible via Settings → Flow GTD Coach:

### Core Settings

- **LLM Provider**: Choose between 'anthropic' or 'openai-compatible'
- **Anthropic API Key**: Required when using Anthropic provider
- **Anthropic Model**: Default is `claude-sonnet-4-20250514`
- **OpenAI API Key**: Required when using OpenAI-compatible provider
- **OpenAI Base URL**: Default is `https://openrouter.ai/api/v1`
- **OpenAI Model**: Default is `openrouter/anthropic/claude-3.5-sonnet`
- **Default Priority**: Priority level for new projects (1-3)
- **Default Status**: Status for new projects (e.g., "live", "planning")

### File Paths

- **Inbox Files Folder**: Path for files to be processed (default: "Flow Inbox Files")
- **Inbox Folder**: Path for general inbox items (default: "Flow Inbox Folder")
- **Processed Inbox Folder**: Path where processed inbox notes are archived (default: "Processed Inbox Folder Notes")
- **Next Actions File**: Path to central next actions file (default: "Next actions.md")
- **Someday File**: Path to someday/maybe file (default: "Someday.md")
- **Projects Folder**: Where new project files are created (default: "Projects")

### Spheres

- **Available Spheres**: Life areas for categorizing projects (default: ["personal", "work"])

## Error Handling

The plugin includes comprehensive error handling:

- `src/errors.ts` defines custom error types
- API failures are gracefully handled with user-friendly messages
- Validation errors prevent malformed data from being processed
- Network issues are retried with appropriate timeouts
