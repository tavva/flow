This file provides guidance to Claude Code and other agents when working with code in this repository.

## Project Overview

Flow is an Obsidian plugin implementing GTD (Getting Things Done). It provides manual inbox processing, project management with hierarchical spheres, focus lists, waiting-for tracking, and someday/maybe items. LLM integration (via OpenRouter) is used for cover image generation.

## Commands

```bash
npm run dev          # Development mode with auto-rebuild
npm run build        # Type-check and production build
npm test             # Run all tests
npm test -- name     # Run specific test file (e.g., npm test -- flow-scanner)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report (80% threshold)
npm run format       # Format with Prettier
npm run format:check # Check formatting without modifying
npm run release      # Interactive production release workflow
npm run release:beta # Interactive beta release workflow
```

### Completion Checklist

Before declaring any task complete, always run:

1. `npm run format` — ensure code is properly formatted
2. `npm run build` — verify type checking passes
3. `npm test` — confirm all tests pass

## Architecture

### Scanners

- **Flow Scanner** (`src/flow-scanner.ts`) - Scans vault for projects (files with `project/*` tags in frontmatter)
- **Person Scanner** (`src/person-scanner.ts`) - Scans for person notes (files with `person` tag)
- **Inbox Scanner** (`src/inbox-scanner.ts`) - Scans inbox folders for items to process
- **Waiting For Scanner** (`src/waiting-for-scanner.ts`) - Scans for `[w]` items across vault
- **Someday Scanner** (`src/someday-scanner.ts`) - Scans for someday/maybe items
- **GTD Context Scanner** (`src/gtd-context-scanner.ts`) - Scans vault for comprehensive GTD system state

### Inbox Processing

Inbox processing is manual and UI-driven (no AI involvement):

- **InboxProcessingView** (`src/inbox-processing-view.ts`) - Full Obsidian tab view for processing
- **InboxProcessingController** (`src/inbox-processing-controller.ts`) - Coordinates the processing workflow
- **InboxItemPersistence** (`src/inbox-item-persistence.ts`) - Saves processed items to vault
- **File Writer** (`src/file-writer.ts`) - Creates/updates project files with Flow frontmatter

Supporting UI: `src/inbox-modal-state.ts`, `src/inbox-modal-utils.ts`, `src/inbox-modal-views.ts`, `src/inbox-types.ts`

### Project Management

- **Project Hierarchy** (`src/project-hierarchy.ts`) - Builds/manages hierarchical project relationships
- **Project Filters** (`src/project-filters.ts`) - Filtering utilities (live projects, templates)
- **Sphere Data Loader** (`src/sphere-data-loader.ts`) - Loads and filters sphere data
- **System Analyzer** (`src/system-analyzer.ts`) - Detects GTD system issues (stalled projects, large inboxes)

### Key Domain Concepts

- **Spheres**: Life areas (work, personal) for organising projects
- **Projects**: Multi-step outcomes with YAML frontmatter (`project/*` tags, priority, status)
- **Sub-projects**: Hierarchical projects via `parent-project: "[[Parent]]"` in frontmatter
- **Focus**: Curated set of next actions to work on, stored in `flow-focus-data/focus.md`
- **Waiting For**: Items awaiting others, marked with `[w]` checkbox status
- **Someday/Maybe**: Future aspirations not currently committed

### Project Hierarchy Pattern

When building hierarchies with filtering (e.g., by sphere), always build hierarchy from ALL projects first, then filter. This preserves parent-child relationships even when parent is in different sphere:

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

```markdown
---
creation-date: 2025-10-05T18:59:00
priority: 2
tags: project/personal
status: live
parent-project: "[[Parent Project]]" # optional
---

# Project Title

Project description and context.

## Next actions

- [ ] GTD-quality actions ready to do now
- [w] Items waiting on others
```

### Views and UI

- **SphereView** (`src/sphere-view.ts`) - Projects/actions for a life area, with planning mode
- **FocusView** (`src/focus-view.ts`) - Curated action list with pinning and reordering
- **WaitingForView** (`src/waiting-for-view.ts`) - Aggregated `[w]` items across vault
- **SomedayView** (`src/someday-view.ts`) - Someday/maybe items
- **InboxProcessingView** (`src/inbox-processing-view.ts`) - Inbox processing interface
- **RefreshingView** (`src/refreshing-view.ts`) - Base class for auto-refreshing views

### Focus System

- Items stored in `flow-focus-data/focus.md` as JSONL (one JSON object per line, sync-friendly)
- **FocusPersistence** (`src/focus-persistence.ts`) - Reads/writes focus items in JSONL format
- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions
- **FocusValidator** (`src/focus-validator.ts`) - Validates items when source files change
- **FocusAutoClear** (`src/focus-auto-clear.ts`) - Automatic daily clearing at configured time
- **WaitingForValidator** (`src/waiting-for-validator.ts`) - Validates/resolves waiting-for items

### Task Status Cycling

Checkbox status cycles: `[ ]` → `[w]` → `[x]` via `task-status-cycler.ts`

## Testing

- Jest with ts-jest preset, 80% coverage threshold
- Mock Obsidian API via `tests/__mocks__/obsidian.ts`
- Test API keys: Use `generateDeterministicFakeApiKey()` from `tests/test-utils.ts` to avoid security scanner false positives

## Code Standards

### Naming Conventions

- PascalCase for classes
- camelCase for functions and variables
- UPPER_SNAKE_CASE for exported constants

### Commit Style

- Write imperative commit subjects (e.g., "Add inbox batching")
- Link issues using `Fixes #123` syntax

### Security

Never commit API keys or other secrets. Store API keys via the plugin settings tab.

### ABOUTME Comments

All source files start with two ABOUTME lines:

```typescript
// ABOUTME: File purpose line 1
// ABOUTME: File purpose line 2
```

### GTD Quality

**Next actions must:**

- Start with action verb, be specific, completable in one sitting
- Include context (who, where, what specifically)
- Be 15-150 characters, avoid vague terms

**Project outcomes must:**

- Be stated as completed outcomes (past tense ideal)
- Be clear, measurable, define "done"

### LLM Integration

LLM is used only for cover image generation, not for inbox processing:

- **LLM Factory** (`src/llm-factory.ts`) - Creates LLM clients
- **Cover Image Generator** (`src/cover-image-generator.ts`) - Generates project cover images via OpenRouter
- Provider: OpenAI-compatible (OpenRouter)
