# Repository Guidelines

## Project Structure & Modules
- `src/` – TypeScript plugin code and Svelte UI.
  - `components/` (Svelte, PascalCase), `views/`, `modals/`, `settings/`, `styles/` (SCSS), `templates/`, `typings/`.
  - Entrypoint: `src/main.ts`. Styles root: `src/styles.scss`.
- `tests/` – Jest tests and fixtures (e.g., `tests/DefaultTestVault`).
- `docs/` – User-facing documentation.
- Build outputs bundle to the repo root (e.g., `main.js`). Plugin manifest: `manifest.json`.

## Build, Test, and Dev Commands
- `npm run dev` – Start esbuild in watch mode for local development.
- `npm run build` – Type-checks with `tsc` then creates a production bundle.
- `npm run typecheck` – Type-check only, no emit.
- `npm test` – Runs Jest with `ts-jest` (ESM enabled).
- `npm run verify` – Runs type-check/build then tests (definition of done).
- `npm run format` – Formats TS/JS/JSON/Svelte via Prettier.
Note: Node 20 is required (`.mise.toml`).

## Coding Style & Naming
- Indentation: 4 spaces (`.editorconfig`); Markdown/JSON/YAML use 2.
- Prettier: no semicolons, single quotes, Svelte plugin. Run `npm run format`.
- ESLint: TypeScript rules enabled; unused vars flagged; TS comments allowed.
- Naming: TypeScript files `camelCase` (e.g., `utils.ts`), Svelte `PascalCase` (e.g., `PlanningView.svelte`), SCSS `kebab-case`.

## Testing Guidelines
- Framework: Jest + `ts-jest` in Node environment.
- Locations: `**/tests/**/*.test.ts` or colocated `*.test.ts` (see `jest.config.ts`).
- Aim for meaningful unit tests around utilities and view logic. Include minimal vault fixtures under `tests/` when needed.
- Run locally with `npm test`.

## Test-Driven Development (TDD)
- Default to TDD for all features and fixes. Write a failing test first, then implement the smallest change to make it pass, and finally refactor.
- Where to put tests:
  - Unit tests live under `tests/` or as colocated `*.test.ts` next to the code.
  - Prefer testing pure logic (utilities, view-model/state, parsing). For Svelte UI, extract logic into testable modules when possible. Avoid DOM/JSDOM reliance since Jest runs in Node env.
- Workflow:
  1) Add/adjust a test that expresses the desired behavior (red) → `npm test`
  2) Implement the minimal code to satisfy the test (green) → `npm test`
  3) Refactor safely → `npm run typecheck` and `npm test`
  4) Before marking done, run `npm run verify` (type-check/build + tests) and `npm run format`
- Bug fixes: first reproduce with a failing test; only then apply the fix.
- Mocks/stubs:
  - Externalized modules (e.g., `obsidian`, `electron`) should be mocked. Add light stubs under `tests/__mocks__/` or use `jest.mock` as needed.
  - For filesystem-like behavior, prefer minimal fixtures under `tests/` (e.g., `tests/DefaultTestVault`).
- PR expectations: every new behavior or bug fix includes appropriate tests authored prior to implementation wherever feasible.

## Definition of Done (Agent + Devs)
- Every feature or bugfix must pass both:
  - Type-check/build: `npm run build` (or `npm run typecheck` during iteration)
  - Tests: `npm test`
- TDD: new or changed behavior is covered by tests authored before implementation wherever feasible
- Do not mark a task complete until both pass locally.
- CI enforces this on pushes and PRs (see `.github/workflows/ci.yaml`).

## Commit & Pull Request Guidelines
- Commits: short, imperative mood; include scope when helpful.
  - Examples: `Fix processing view sort`, `Add focus area suggester`.
- PRs: clear description, linked issues, screenshots/GIFs for UI changes, test plan, and notes on docs updates.
- Ensure `npm run build`, `npm test`, and `npm run format` pass before requesting review.

## Security & Configuration
- Environment: `dotenv` loads `.env` from the Obsidian plugin folder during development; do not commit secrets.
- Externalized modules (`obsidian`, `electron`, etc.) are not bundled; ensure runtime availability when testing inside Obsidian.
