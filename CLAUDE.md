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
- Hotlist for curating a focused set of next actions from across the vault
- Planning mode in sphere view for selecting actions to add to hotlist
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
# Interactive GTD coaching for a specific sphere
npx tsx src/cli.ts --vault /path/to/vault --sphere work
```

See `docs/gtd-coach-cli.md` for full CLI documentation.

## Architecture

### Core Processing Flow

1. **Flow Scanner** (`src/flow-scanner.ts`) - Scans the Obsidian vault for Flow projects (files with `project/*` tags in frontmatter)
2. **Person Scanner** (`src/person-scanner.ts`) - Scans the vault for person notes (files with `person` tag)
3. **Inbox Scanner** (`src/inbox-scanner.ts`) - Scans designated inbox folders for files to process
4. **GTD Processor** (`src/gtd-processor.ts`) - Uses AI to analyze inbox items with context from existing projects and people
5. **LLM Factory** (`src/llm-factory.ts`) - Factory pattern for creating language model clients (Anthropic/OpenAI-compatible)
6. **Language Model Clients** (`src/anthropic-client.ts`, `src/openai-compatible-client.ts`) - Provider-specific AI integrations
7. **File Writer** (`src/file-writer.ts`) - Creates new project files or updates existing ones with proper Flow frontmatter
8. **Inbox Processing Controller** (`src/inbox-processing-controller.ts`) - Orchestrates the processing workflow
9. **Inbox Modal** (`src/inbox-modal.ts`) - Main UI component for the inbox processing workflow
10. **Settings Tab** (`src/settings-tab.ts`) - Configuration interface for API keys and project defaults
11. **Validation** (`src/validation.ts`) - Input validation and error handling
12. **Errors** (`src/errors.ts`) - Custom error types and handling

### Waiting For Support

The plugin supports GTD "Waiting For" items using `[w]` checkbox status:

- **Scanner** (`src/waiting-for-scanner.ts`) - Finds all `[w]` items across vault
- **View** (`src/waiting-for-view.ts`) - Aggregates waiting-for items in dedicated pane
- **Status Cycler** (`src/task-status-cycler.ts`) - Cycles checkbox status: [ ] → [w] → [x]
- **AI Integration** - Processor recognizes waiting-for scenarios during inbox processing

### Hotlist Support

The plugin supports creating a curated "hotlist" of next actions to work on:

- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions in files by searching for checkbox patterns
- **HotlistValidator** (`src/hotlist-validator.ts`) - Validates and resolves hotlist items when files change, searches for moved lines
- **HotlistView** (`src/hotlist-view.ts`) - Displays hotlist in right sidebar with actions grouped by project/sphere
- **SphereView Planning Mode** - Toggle planning mode to click actions and add/remove from hotlist
- **Commands** - "Open Hotlist" command (`open-hotlist`) and ribbon icon with `list-checks` icon
- **Hotlist Item Actions** - Mark complete, convert to waiting-for, or remove from hotlist
- **File Navigation** - Click action text to open source file at correct line in split pane

**Workflow:**

1. Open a sphere view (work, personal, etc.)
2. Click "Planning Mode" button to enter planning mode
3. Click next actions from projects or general actions to add them to the hotlist
4. Selected actions show visual indicator (checkmark)
5. Exit planning mode when done selecting
6. Open hotlist view to see curated list of actions
7. Work through hotlist, marking complete or converting to waiting-for

**Storage:**

Hotlist items are stored in plugin settings as `HotlistItem[]` with:

- `file`: Source file path
- `lineNumber`: Last known line number
- `lineContent`: Full line content for exact matching
- `text`: Display text (action without checkbox)
- `sphere`: Which sphere the action belongs to
- `isGeneral`: Whether from Next Actions file vs project file
- `addedAt`: Timestamp for ordering

### Sub-Projects Support

The plugin supports hierarchical project relationships where projects can have sub-projects:

- **Project Hierarchy** (`src/project-hierarchy.ts`) - Builds hierarchical tree structures from flat project lists
  - `buildProjectHierarchy()` - Creates tree from projects, detects cycles, calculates depths
  - `flattenHierarchy()` - Depth-first traversal for rendering with indentation
  - `extractParentPath()` - Converts wikilink `[[Parent]]` to file path
  - `getProjectDisplayName()` - Returns display name with parent context
- **Parent-Project Frontmatter** - Sub-projects reference parents using `parent-project: "[[Parent Name]]"` in frontmatter
- **Arbitrary Nesting** - Sub-projects can have their own sub-projects (unlimited depth)
- **Hierarchy Views** - Sphere view shows indented hierarchy (24px per level), hotlist shows parent context
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

- `flow-scanner.test.ts` - Vault scanning and project parsing
- `gtd-processor.test.ts` - AI processing logic
- `file-writer.test.ts` - File creation and updates
- `validation.test.ts` - Input validation
- `inbox-scanner.test.ts` - Inbox folder scanning functionality
- `hotlist-validator.test.ts` - Hotlist item validation and line finding
- `hotlist-view.test.ts` - Hotlist view rendering and interactions
- `hotlist-integration.test.ts` - End-to-end hotlist workflows
- `action-line-finder.test.ts` - Action line number detection
- `sphere-view.test.ts` - Sphere view and planning mode
- `waiting-for-scanner.test.ts` - Waiting-for item scanning
- `waiting-for-view.test.ts` - Waiting-for view rendering
- `project-hierarchy.test.ts` - Project hierarchy building, cycle detection, and display utilities

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

- `process-inbox`: Opens the inbox processing modal
- `quick-capture`: Same as process-inbox (alias for discoverability)
- `process-inbox-folders`: Opens the modal with inbox folder scanning enabled
- `cycle-task-status`: Cycles checkbox status on current line
- `open-waiting-for-view`: Opens the Waiting For view
- `open-hotlist`: Opens the Hotlist view in right sidebar

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
