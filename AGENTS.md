This file provides guidance to Claude Code and other agents when working with code in this repository.

## Project Overview

Flow is an Obsidian plugin implementing GTD (Getting Things Done) with AI-powered inbox processing. It uses Claude or OpenAI-compatible models to categorise inbox items into projects, next actions, reference material, someday/maybe items, and person notes.

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
npm run evaluate     # Run AI evaluations (requires Anthropic credentials)
npm run version      # Bump manifest metadata for release
```

### Completion Checklist

Before declaring any task complete, always run:

1. `npm run format` — ensure code is properly formatted
2. `npm run build` — verify type checking passes
3. `npm test` — confirm all tests pass

## Architecture

### Core Processing Flow

1. **Flow Scanner** (`src/flow-scanner.ts`) - Scans vault for projects (files with `project/*` tags in frontmatter)
2. **Person Scanner** (`src/person-scanner.ts`) - Scans for person notes (files with `person` tag)
3. **Inbox Scanner** (`src/inbox-scanner.ts`) - Scans inbox folders for items to process
4. **GTD Processor** (`src/gtd-processor.ts`) - AI analysis with context from existing projects/people
5. **LLM Factory** (`src/llm-factory.ts`) - Factory for Anthropic/OpenAI-compatible clients
6. **File Writer** (`src/file-writer.ts`) - Creates/updates project files with Flow frontmatter

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
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
parent-project: "[[Parent Project]]"  # optional
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
- **FlowCoachView** (`src/flow-coach-view.ts`) - Chat interface for GTD coaching

### Focus System

- Items stored in `flow-focus-data/focus.md` as JSON with: file, lineNumber, lineContent, text, sphere, isPinned, completedAt
- **ActionLineFinder** (`src/action-line-finder.ts`) - Finds exact line numbers for actions
- **FocusValidator** (`src/focus-validator.ts`) - Validates items when source files change
- **FocusAutoClear** (`src/focus-auto-clear.ts`) - Automatic daily clearing at configured time

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

- Default provider: OpenAI-compatible (OpenRouter)
- Fallback: Anthropic Claude
- British English for all AI responses
- Structured JSON output from Claude
