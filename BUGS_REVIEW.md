# Bugs Review

This document summarizes issues identified in the codebase and the fixes applied. Where appropriate, follow‑ups and verification steps are noted.

## Critical fixes applied

- Tag detection in processing watcher
  - File: `src/main.ts`
  - Issue: `filter` callback didn’t return and condition treated any tag array as truthy, so files with `project/*` tags were not reliably detected.
  - Fix: Normalize frontmatter `tags` to array and use `some(t => t.startsWith('project/'))` (also handles string tags by splitting on whitespace).

- Missing modal open for person reference
  - File: `src/handlers.ts`
  - Issue: `FileSelectorModal` for adding person reference was instantiated but never opened.
  - Fix: Append `.open()` to the modal call.

- Incorrect import path in settings tab
  - File: `src/settings/settingsTab.ts`
  - Issue: Used `import { checkDependencies } from 'src/dependencies.js'` which won’t resolve in bundling.
  - Fix: Use relative path `../dependencies.js`.

- String API misuse and file discovery in suggesters
  - Files: `src/settings/suggesters/FileSuggester.ts`, `src/settings/suggesters/FolderSuggester.ts`
  - Issues:
    - Used `.contains(...)` (not a JS string method).
    - File suggester attempted to enumerate files via `getTFilesFromFolder(plugin, '')`, which throws (empty folder path invalid) and is unnecessary.
  - Fixes:
    - Replace `.contains(...)` with `.includes(...)`.
    - Use `this.plugin.app.vault.getMarkdownFiles()` and filter with `.includes(...)`.

- Task line construction and newline handling
  - File: `src/utils.ts`
  - Issues:
    - Used `.concat(...)` without assignment when building strings; newlines and appended tags were dropped.
    - In the “create section” branch, always appended `appendTagToTask` even if empty.
    - Did not `await` `vault.create()` in `createFoldersAndFile`.
  - Fixes:
    - Build strings via concatenation and assign to variables; add newline explicitly.
    - Only append tag when set; remove unconditional trailing tag in create branch.
    - `await` file creation.

- Svelte typing and missing handler
  - Files: `src/components/ProcessingView.svelte`, `src/components/SphereView.svelte`
  - Issues:
    - `isProcessingComplete` typed as literal `false` instead of boolean default.
    - Template referenced `exitPlanningMode` but function wasn’t defined.
  - Fixes:
    - Declare `export let isProcessingComplete: boolean = false`.
    - Implement `exitPlanningMode()` calling `togglePlanningMode(plugin)`.

## Potential issues (not changed)

- Dataview task line indexing
  - File: `src/tasks.ts`
  - Context: `replaceLineInFile` uses `lines[lineNumber] = newLine`. Dataview’s `STask.line` can be 0‑based; if off‑by‑one behavior appears, adjust to `lines[lineNumber - 1]`.

- Project template tags with multiple spheres
  - Files: `src/templates/Project.ts`, `src/handlers.ts`
  - Context: When selecting multiple spheres, code builds a space‑separated string (e.g. `project/personal project/work`) and injects it under a YAML list item `- {{ sphere }}`. In YAML this becomes a single tag containing spaces, not two tags. Consider emitting multiple list items or using a YAML array (e.g. `tags: [project/personal, project/work]`).

- Person template header level
  - File: `src/templates/Person.ts`
  - Context: Template uses `# Discuss next` while insertion code looks for `"## Discuss next"`. This will cause insertion to create a second section. Align header levels to avoid duplicates.

- Jest + ESM config shape
  - File: `jest.config.ts`
  - Context: Using `module.exports` in a TS ESM project often works with `ts-jest` + `useESM: true`. If config resolution issues occur, prefer `export default`.

- Node types version
  - File: `package.json`
  - Context: `@types/node` is `^16.11.6` whereas the repo requires Node 20. Consider upgrading to avoid type mismatches in newer APIs.

- Optional Component for MarkdownRenderer
  - File: `src/components/ProcessingView.svelte`
  - Context: `MarkdownRenderer.render` is called with an optional component argument; passing a real `Component` improves lifecycle handling. If you see leaks or missing cleanup, construct one and call `load()`.

## Files modified

- `src/main.ts`
- `src/handlers.ts`
- `src/settings/settingsTab.ts`
- `src/settings/suggesters/FileSuggester.ts`
- `src/settings/suggesters/FolderSuggester.ts`
- `src/components/SphereView.svelte`
- `src/components/ProcessingView.svelte`
- `src/utils.ts`

## Verification steps

- Build and type‑check: `npm run build` (tsc then esbuild) should pass.
- Smoke test in Obsidian:
  - Ensure processing reacts to edits in project‑tagged files and Next actions file.
  - Use “Add to person reference” flow; modal should appear.
  - Try suggesters: folder/file inputs accept substring matches.
  - Create actions and confirm appended tag and newline behavior.
  - Planning/Sphere views render; planning exit button toggles mode.

If you’d like, I can run `npm run build` and `npm test` to validate these changes locally.
