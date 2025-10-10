# Repository Guidelines

## Project Structure & Module Organization

Flow GTD Coach is an Obsidian plugin written in TypeScript. Core services live in `src/` (e.g., `flow-scanner.ts`, `inbox-scanner.ts`, `gtd-processor.ts`) with shared contracts in `src/types.ts`. UI wiring stays in `src/main.ts`, and modal styles belong in `styles.css`. Jest specs mirror source files under `tests/` with Obsidian shims in `tests/__mocks__/obsidian.ts`.

## Build, Test, and Development Commands

- `npm run dev` — build bundle with esbuild in watch mode; keep it running during active development.
- `npm run build` — perform a type check via `tsc` then emit the production bundle to `dist/`.
- `npm run format` — auto-format all code with Prettier (run before committing).
- `npm run format:check` — verify code formatting without modifying files.
- `npm test` / `npm run test:watch` / `npm run test:coverage` — execute Jest suites; coverage thresholds are enforced at 80% across metrics.
- `npm run evaluate` — launch scripted AI evaluations (requires Anthropic credentials).
- `npm run version` — bump manifest metadata and stage `manifest.json` plus `versions.json` for release.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation (enforced by Prettier). Use PascalCase for classes, camelCase for functions and variables, and UPPER_SNAKE_CASE for exported constants. Keep public APIs explicitly typed, reuse helpers from `src/types.ts`, and add comments only where logic is non-obvious. Run `npm run format` before committing to ensure consistent formatting across the codebase. Avoid introducing Unicode unless already present.

## Testing Guidelines

Tests reside in `tests/` alongside the mirrored file name (e.g., `tests/flow-scanner.test.ts`). Use Jest with ts-jest, and extend the mocks in `tests/__mocks__/obsidian.ts` when Obsidian APIs change. Ensure new behavior covers both success and failure cases, and maintain ≥80% branch, line, function, and statement coverage by running `npm run test:coverage`.

## Commit & Pull Request Guidelines

Write imperative commit subjects such as "Add inbox batching." Group related changes, avoid committing build artifacts, and run `npm run format` and `npm run build` before requesting review. Pull requests should summarize scope, note manual testing, attach UI screenshots when relevant, and link issues using `Fixes #123` syntax.

## Security & Configuration Tips

Never commit Anthropic keys or other secrets. Store API keys via the plugin settings tab. Document new configuration defaults in the settings UI or `README.md` so agents and maintainers stay aligned.
