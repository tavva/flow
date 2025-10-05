# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that implements a GTD (Getting Things Done) coach for Flow-based vaults. The plugin uses Claude AI to intelligently process inbox items into well-formed projects and quality next actions according to GTD principles.

**Key Capabilities:**
- AI-powered analysis of inbox items using Claude Sonnet 4
- Context-aware processing with knowledge of existing Flow projects
- Automatic creation and updating of Flow project files
- GTD-compliant next action generation
- Project suggestion based on existing vault contents

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

### Evaluation Framework
```bash
# Run the GTD quality evaluation suite (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=your-key
npm run evaluate
```

The evaluation framework tests the AI processor against 15 curated test cases and generates detailed quality metrics. Results are saved to `evaluation/results/`. See `evaluation/README.md` for details.

## Architecture

### Core Processing Flow

1. **Flow Scanner** (`src/flow-scanner.ts`) - Scans the Obsidian vault for Flow projects (files with `project/*` tags in frontmatter)
2. **GTD Processor** (`src/gtd-processor.ts`) - Uses Claude AI to analyze inbox items with context from existing projects
3. **File Writer** (`src/file-writer.ts`) - Creates new project files or updates existing ones with proper Flow frontmatter
4. **Inbox Modal** (`src/inbox-modal.ts`) - Main UI component for the inbox processing workflow

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

## Future next actions
- [ ] Actions dependent on other things completing first
```

**Important:**
- Projects are identified by `project/*` tags in frontmatter
- All next actions MUST be Markdown checkboxes (`- [ ]`)
- Next actions section contains immediately actionable items
- Future next actions contains items blocked by dependencies

### GTD Categories

The processor categorizes items into:
- **next-action**: Single completable actions (enhanced for specificity)
- **project**: Multi-step outcomes (requires outcome + next action + future actions)
- **reference**: Information to store (not actionable)
- **someday**: Future aspirations (not currently committed)

### API Integration

The plugin uses Anthropic's SDK with:
- Model: `claude-sonnet-4-20250514`
- `dangerouslyAllowBrowser: true` (safe - Obsidian plugins run in Electron)
- British English for all AI responses
- Structured JSON output from Claude

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

### UI Components
- Ribbon icon: 'inbox' icon for quick access
- Settings tab: API key and default project settings
- Modal: Multi-step inbox processing workflow

## Dependencies

### Production
- `@anthropic-ai/sdk`: Claude AI integration

### Development
- `obsidian`: Obsidian API types
- `esbuild`: Fast bundler
- `typescript`: Type checking
- `jest` + `ts-jest`: Testing framework

## Prompt Engineering

The main AI prompt is in `src/gtd-processor.ts` `buildProcessingPrompt()`. It:
- Uses British English
- Provides clear category definitions
- Includes examples
- Requests structured JSON output
- Passes existing project context for suggestions
- Enforces GTD quality standards

When modifying prompts, ALWAYS run the evaluation suite afterward to measure impact on quality metrics.
