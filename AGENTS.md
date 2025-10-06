# Repository Guidelines

## Project Structure & Module Organization
Flow GTD Coach is an Obsidian plugin built in TypeScript. Core logic lives in `src/`, split into service classes like `flow-scanner.ts` (discovers Flow projects), `inbox-scanner.ts` (collects inbox items), and `gtd-processor.ts` (calls Anthropic). Shared types live in `src/types.ts` with validation and error helpers nearby. `main.ts` wires these modules into the plugin lifecycle; `styles.css` handles modal styling. Automated prompts and evaluation scenarios sit in `prompts/` and `evaluation/`. Jest specs mirror their targets inside `tests/`, using `__mocks__/obsidian.ts` to stub the host API.

## Build, Test, and Development Commands
- `npm run dev` — runs `esbuild.config.mjs` in watch mode, rebuilding the bundle.
- `npm run build` — type-checks with `tsc` then emits the production bundle.
- `npm test` / `npm run test:watch` / `npm run test:coverage` — execute Jest suites with 80% coverage thresholds from `jest.config.js`.
- `npm run evaluate` — executes scripted AI evaluations from `evaluation/run-evaluation.ts` (needs Anthropic access).
- `npm run version` — bumps manifest metadata and stages `manifest.json` plus `versions.json`.

## Coding Style & Naming Conventions
Write new code in TypeScript, keeping modules cohesive by responsibility. Match the existing indentation (tabs in most files; stay consistent within the file you touch). Favor PascalCase for classes (`GTDProcessor`), camelCase for functions and variables, and UPPER_SNAKE_CASE for exported constants. Keep public APIs typed explicitly and lean on `types.ts` for shared contracts. Run `npm run build` before submitting to catch type regressions early.

## Testing Guidelines
Place unit tests in `tests/` mirroring the source filename (`flow-scanner.test.ts`, etc.). Use Jest + ts-jest utilities and update mocks in `tests/__mocks__` when Obsidian APIs change. Ensure new behaviour is covered and that coverage stays above 80% branches/lines/functions/statements. When adding async flows, assert both success and failure paths; `validation.test.ts` illustrates the expected style.

## Commit & Pull Request Guidelines
Write imperative, concise commit subjects (e.g., “Add inbox batching”). Group related changes; avoid committing built bundles. Pull requests should include a scope summary, manual test notes, relevant screenshots for UI changes, and linked issue references (`Fixes #123`) when applicable. Re-run build and tests before requesting review to keep the plugin shippable.

## Configuration & Security Tips
Never hard-code Anthropic API keys. Use the plugin settings tab to store keys locally and call out new configuration knobs in review. Document fresh defaults in `README.md` or the settings UI so agents and maintainers stay aligned.
