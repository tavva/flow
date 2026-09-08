# Configurable Focus File Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Focus File setting under Output Files & Folders for issue #64.

**Architecture:** Preserve `flow-focus-data/focus.md` as the default. Pass the configured vault-relative path explicitly to persistence and use it in the sphere change listener. Apply moves the existing file automatically, creates missing folders, and asks before selecting an existing destination. Failed moves retain the old setting.

**Tech Stack:** TypeScript, Obsidian API, Jest.

### Task 1: Configurable persistence

- [x] Add regression cases in `tests/focus-persistence.test.ts` for custom cached and uncached paths, nested folders, vault-root files, blank fallback, and folder conflicts; run them and verify failure.
- [x] Add `focusFilePath` to `src/types/settings.ts`. Give `loadFocusItems` and `saveFocusItems` optional path parameters with the existing default, normalize paths, and create parent directories in order.
- [x] Run `npm test -- --runInBand focus-persistence` and verify passing tests.

### Task 2: Settings and consumers

- [x] Add Focus File next to Someday/Maybe in `src/settings-tab.ts`, with Markdown suggestions and an explicit Apply button.
- [x] Pass `settings.focusFilePath` in `main.ts`, `src/focus-view.ts`, `src/sphere-view.ts`, `src/focus-editor-menu.ts`, `src/inbox-item-persistence.ts`, `src/new-project-modal.ts`, and `src/legacy-focus-migration.ts`.
- [x] Cover custom-path view loading, saving and sphere refresh behavior; update existing persistence assertions for the explicit path argument.
- [x] Document the setting and relocation steps in `README.md`.

### Task 3: Verification

- [x] Run `npm run format`, `npm run build`, and `npm test -- --runInBand`.
- [ ] Native Obsidian verification: unavailable because the referenced automation scripts are not installed. Unit and integration tests cover persistence, path switching, and view refreshes.
- [x] Review the final diff for hardcoded runtime paths and unintended changes. Merge to main and publish a stable release after verification.

## Review findings addressed

Path changes refresh open views after the complete field is applied. Focus operations capture the path before reading; the Focus view rejects saves from an old path and discards stale asynchronous loads and validation results. A deferred-validator regression reproduces and prevents overwriting a newly selected file.

## Automatic relocation

- [x] Move the file with Obsidian FileManager, preserving links, before saving the new path.
- [x] Confirm selection of an existing destination; cancellation leaves both files unchanged.
- [x] Restore the source file if saving the new setting fails.
- [x] Serialize focus reads, writes and moves per vault; redirect pending operations after successful moves.
- [ ] Run final checks, merge main, and publish the new release.
