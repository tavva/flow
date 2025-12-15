# Contributing to Flow

## Development Setup

```bash
git clone https://github.com/tavva/flow.git
cd flow
npm install
npm run dev          # Development mode with auto-rebuild
```

To test in Obsidian, symlink or copy the built files to your vault's `.obsidian/plugins/flow/` directory. It's advisable to use the [Hot-Reload plugin](https://github.com/pjeby/hot-reload) to automatically reload the plugin when you make changes.

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
```

### Before Submitting

Always run:

1. `npm run format` — ensure code is properly formatted
2. `npm run build` — verify type checking passes
3. `npm test` — confirm all tests pass

## Architecture

See [AGENTS.md](AGENTS.md) for detailed architecture documentation.

### Core Processing Flow

1. **Flow Scanner** (`src/flow-scanner.ts`) — Scans vault for projects (files with `project/*` tags)
2. **Person Scanner** (`src/person-scanner.ts`) — Scans for person notes (files with `person` tag)
3. **Inbox Scanner** (`src/inbox-scanner.ts`) — Scans inbox folders for items to process
4. **GTD Processor** (`src/gtd-processor.ts`) — AI analysis with context from existing projects/people
5. **LLM Factory** (`src/llm-factory.ts`) — Factory for Anthropic/OpenAI-compatible clients
6. **File Writer** (`src/file-writer.ts`) — Creates/updates project files with Flow frontmatter

### Key Views

- **SphereView** — Projects/actions for a life area, with planning mode
- **FocusView** — Curated action list with pinning and reordering
- **WaitingForView** — Aggregated `[w]` items across vault
- **SomedayView** — Someday/maybe items

### Project Structure

```
src/
├── types.ts                    # TypeScript interfaces
├── flow-scanner.ts             # Vault scanner for Flow projects
├── person-scanner.ts           # Person notes scanner
├── inbox-scanner.ts            # Inbox folder scanner
├── gtd-processor.ts            # AI-powered GTD analysis
├── llm-factory.ts              # LLM provider factory
├── anthropic-client.ts         # Anthropic API client
├── openai-compatible-client.ts # OpenAI-compatible API client
├── file-writer.ts              # Project file creation/updates
├── inbox-modal.ts              # Main processing UI
├── settings-tab.ts             # Settings interface
├── focus-view.ts               # Focus view
├── sphere-view.ts              # Sphere view with planning mode
└── ...
tests/                          # Test files mirror src/
main.ts                         # Plugin entry point
```

## Testing

- Jest with ts-jest preset
- Mock Obsidian API via `tests/__mocks__/obsidian.ts`
- 80% coverage threshold for branches, functions, lines, statements

Run specific tests:

```bash
npm test -- flow-scanner.test          # Specific file
npm test -- --testNamePattern="scan"   # Pattern match
```

## Code Standards

### File Headers

All source files start with two ABOUTME lines:

```typescript
// ABOUTME: File purpose line 1
// ABOUTME: File purpose line 2
```

### Naming

- PascalCase for classes
- camelCase for functions and variables
- UPPER_SNAKE_CASE for exported constants

### Formatting

Uses Prettier with 2-space indentation, 100-character line width. Run `npm run format` before committing.

### Security

Never commit API keys or secrets. Store API keys via the plugin settings tab.

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the full test suite
5. Submit a PR with a clear description

## Reporting Issues

- [GitHub Issues](https://github.com/tavva/flow/issues) for bugs
- [GitHub Discussions](https://github.com/tavva/flow/discussions) for feature requests
