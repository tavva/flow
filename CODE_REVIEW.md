# Code Review & Improvements

## Critical Bugs
- src/utils.ts
  - addLineToFile: use `content += '\n'` at end (current `.concat` no-op).
  - addToFileSection: build `taskLine` with `let`; append tag and `\n` via reassignment; guard against empty tag.
- src/handlers.ts
  - addToPersonReference: missing `.open()` on `FileSelectorModal`.
- src/main.ts
  - setupTaskWatcher: fix tag check to `.some((t: string) => t.startsWith('project/'))`.
- src/settings/suggesters/*
  - Replace `.contains` with `.includes` on strings.
- src/tasks.ts
  - `replaceLineInFile`: verify 0/1-based indexing; likely `lines[lineNumber - 1]`.
- src/components/ProcessingView.svelte
  - `export let isProcessingComplete = false` (boolean), not a literal type.

## Stability & UX
- manifest.json: add `"main": "main.js"` (and optional `"css": "styles.css"`).
- src/utils.ts: `checkBranch()` uses `setInterval` without cleanup; keep handle and clear in `onunload`.
- src/settings/suggesters/FileSuggester.ts: avoid `getTFilesFromFolder(plugin, '')`; use `plugin.app.vault.getMarkdownFiles()` for whole-vault.
- src/components/PlanningView.svelte: replace 1s polling with existing `planned-tasks-updated` event.

## Code Quality
- src/views/sphere.ts: use `plugin.settings.nextActionsFilePath` instead of hard-coded `'Next actions'`.
- src/utils.ts addToFileSection: find header line by parsing lines, insert after header newline; avoid brittle `indexOf(sectionName)+len+1`.
- src/utils.ts createFoldersAndFile: `await plugin.app.vault.create(...)` to avoid race conditions.
- Remove stray `console.log` or gate behind a `DEBUG` flag.

## Config & Build
- tsconfig.json: since build uses `tsc -noEmit`, remove `declaration`/`outDir` to avoid confusion; confirm path alias `main.js` necessity.
- Prettier defined in both `.prettierrc` and `package.json`; consolidate to one.
- Add scripts: `"lint": "eslint \"src/**/*.{ts,svelte}\""`, `"typecheck": "tsc -noEmit"`.

## Performance
- Dataview renders: throttle `renderTaskList` calls; avoid repeated DOM queries inside loops; consider requestAnimationFrame batching.
- Debounce vault watchers further when safe.

## Testing
- Add unit tests for:
  - Template parsers: `parseProjectTemplate`, `parsePersonTemplate`.
  - `addToFileSection` insertion (header present/missing).
  - `Tasks.replaceLineInFile` index correctness.
  - `listProjects` sorting/prioritization.
- Use fixtures under `tests/DefaultTestVault`; mock vault/dataview minimally.

## Documentation
- Extend AGENTS.md/README with Obsidian dev workflow (e.g., symlink/build outputs into `.obsidian/plugins/flow`).
- Note externalized modules (`obsidian`, `electron`, codemirror libs) must exist at runtime.
