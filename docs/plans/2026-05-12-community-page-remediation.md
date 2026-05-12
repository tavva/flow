# Community Page Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the Obsidian community plugin page findings for Flow without cutting a release after every individual change.

**Architecture:** Treat the community page as a public signal that aggregates GitHub metadata, Obsidian release metadata, release assets, and automated static scans. Fix source-of-truth metadata first, then handle scanner findings in focused batches, then publish one release after the batch is verified.

**Tech Stack:** TypeScript, Obsidian plugin API, Jest, esbuild, GitHub Releases, GitHub Actions, Obsidian community plugin metadata.

---

## Findings Summary

Source reviewed: <https://community.obsidian.md/plugins/flow> on 2026-05-12.

The live community page still shows `Current version 1.2.3`, `Last updated 3 months ago`, and `40 releases`, even though the repo is now at `1.3.1`. Treat the current scorecard as stale until the page re-indexes, then re-run the review.

Current public-page findings:

- Health is `79%`, rated `Excellent`.
- Review is rated `Caution`.
- The listing description still includes `(Closed source)`.
- Details panel reports `License: OTHER`.
- Scorecard says `The repository does not have a license`, even though the repo has a `LICENSE` file. GitHub also reports `licenseInfo.key: other`, so license detection is genuinely failing.
- README still has beta-era copy: "we're currently redesigning the inbox processing view" and "available in the beta version".
- Manifest description lacks terminal punctuation.
- The scan reported 559 review issues against the stale release, mostly:
  - direct `element.style.*` usage,
  - `!important` and `:has` CSS,
  - unhandled promises,
  - `document`, `setTimeout`, and `clearTimeout` popout-compatibility findings,
  - `fetch()` instead of Obsidian `requestUrl`,
  - one runtime `atob()` call,
  - broad vault read/write/enumeration capability notices,
  - `any`/error-type/unused-variable lint findings,
  - two missing GitHub artifact attestations for `main.js` and `styles.css`.

Already handled before this plan:

- Dependency vulnerabilities are cleared in `1.3.1`.
- Bundled `obsidian-dataview`, Svelte, and unused Anthropic SDK code were removed from Flow's release bundle.
- GitHub open Dependabot alerts are `0`.

## File Structure

- Modify `README.md`: remove beta-era copy, align privacy/network disclosure, and use "License".
- Modify `manifest.json`: add punctuation to the description.
- Modify `package.json`: align SPDX license with the chosen license text.
- Modify `LICENSE`: replace the current short notice with a GitHub-detectable full license text or add a recognized SPDX-compatible license file.
- Modify `src/cover-image-generator.ts`: replace `fetch`/`atob` with Obsidian-compatible request and decoding helpers.
- Modify `src/network-retry.ts`, `src/refreshing-view.ts`, view/modal files: route timers and document/window access through Obsidian-aware helpers.
- Create `src/obsidian-platform.ts`: central helpers for `activeWindow`, `activeDocument`, and request/timer behavior where needed.
- Modify `styles.css`: replace `:has` and `!important` rules with Flow-scoped classes and higher-specificity selectors.
- Modify UI files with heavy inline styles: `src/inbox-modal-views.ts`, `src/new-project-modal.ts`, `src/focus-view.ts`, `src/sphere-view.ts`, `src/waiting-for-view.ts`, `src/add-to-inbox-modal.ts`, `src/new-person-modal.ts`.
- Modify `.github/workflows/release.yaml` or create a dedicated release workflow: build, upload assets, and create artifact attestations.
- Modify `docs/RELEASING.md`: document the new release and attestation workflow.
- Test files to add/update near each affected module.

## Task 1: Public Metadata And Listing Hygiene

- [x] Check whether <https://community.obsidian.md/plugins/flow> has re-indexed `1.3.1`. If it still shows `1.2.3` after the expected cache window, report it to Obsidian or inspect their ingestion path.
  - 2026-05-12: Page still shows `1.2.3`, `40 releases`, `License: OTHER`, stale README text, and `(Closed source)`. The raw `obsidianmd/obsidian-releases` `community-plugins.json` entry also still contains `(Closed source)`.
- [x] Update `README.md` to remove beta-specific text for the inbox redesign.
- [x] Change "Licence" to "License" in `README.md` to match the community site and GitHub convention.
- [x] Add explicit network disclosure to `README.md`: OpenRouter is contacted only when the user enables AI cover generation and triggers image generation.
- [x] Update `manifest.json` description to end with punctuation.
- [ ] Prepare an `obsidianmd/obsidian-releases` PR removing `(Closed source)` from Flow's `community-plugins.json` description.
  - User reports this was fixed externally; leave open until the raw upstream metadata confirms it.
  - 2026-05-12 recheck: the community page and raw `obsidianmd/obsidian-releases` metadata still contain `(Closed source)`, so the external fix has not re-indexed or landed upstream yet.
- [x] Decide GPL flavor: current `LICENSE` text says GPL v3 or later, while `package.json` says `GPL-3.0-only`.
- [x] Align `LICENSE`, `package.json`, and `README.md` so GitHub detects the license. Recommended: use the full `GPL-3.0-or-later` text if that matches intent.
- [ ] Verify with `gh repo view tavva/flow --json licenseInfo` after push.

## Task 2: Network And Privacy Scanner Findings

- [x] Replace `fetch()` in `src/cover-image-generator.ts` with Obsidian `requestUrl`.
- [x] Add focused tests for successful OpenRouter image response, HTTP error response, and malformed response using the new request wrapper.
- [x] Replace runtime `atob()` with an explicit, tested base64 decoding helper that does not look like obfuscation and works in Obsidian's runtime targets.
- [x] Confirm no remaining references to `console.anthropic.com`, old OpenAI-compatible client files, or unused network domains in source or bundled output.
- [x] Rebuild and grep `main.js` for unexpected domains.
  - 2026-05-12: source and bundle grep only found expected OpenRouter references; no `fetch(`, `atob(`, `btoa(`, Anthropic SDK, Svelte, or bundled Dataview references.

## Task 3: Popout Compatibility

- [x] Create a small helper for active document/window access, likely using `this.app.workspace.activeDocument` / `activeWindow` where available and falling back safely for tests.
- [x] Replace direct `document.createElement` / `document.createElementNS` in runtime code with active-document equivalents.
- [x] Replace direct `setTimeout` / `clearTimeout` in view and modal classes with active-window equivalents.
- [x] Keep utility-only timing code injectable or scoped so tests remain deterministic.
- [x] Add tests covering helper fallback behavior and at least one converted view/modal path.
  - 2026-05-12: Added `src/obsidian-platform.ts`; converted runtime DOM creation, timers, intervals, key listeners, and `window.open` through owner-window/active-window helpers. Source grep now only finds those operations inside the helper plus a plain text UI string.

## Task 4: Async Handling

- [x] Review every community-reported unhandled promise location in current `main`.
- [x] For intentional fire-and-forget calls, prefix with `void` and attach `.catch` where user-facing errors should be noticed.
- [x] Await save/write/refresh calls where ordering matters.
- [x] Add regression tests for any changed sequencing that affects persistence or UI refresh behavior.
  - 2026-05-12: Added `src/async-utils.ts`; routed host callbacks, settings saves, menu actions, DOM events, scheduled refreshes, cover image processing, and intentional background renders through explicit rejection handling. `ProjectCoverDisplay.processAllViews()` now awaits all file updates.

## Task 5: CSS And Inline Style Cleanup

- [x] Replace `.modal:has(...)` selectors by adding Flow-specific classes to modal containers during `onOpen` and removing them during `onClose`.
- [x] Remove avoidable `!important` rules by increasing selector specificity or moving rules under Flow-owned container classes.
- [x] Move high-volume inline styles out of `src/inbox-modal-views.ts` into `styles.css` first.
- [x] Repeat for `new-project-modal`, `focus-view`, `sphere-view`, `waiting-for-view`, `add-to-inbox-modal`, and `new-person-modal`.
- [x] Keep dynamic values as CSS variables via `setCssProps` or narrow inline assignment only where values are genuinely data-driven.
  - 2026-05-12: Remaining inline styles are narrow dynamic visibility controls (`display`) or hierarchy depth sizing in `sphere-view`; static layout, cursor, loading, modal, notification, and error styles now live in `styles.css`.
- [ ] Run visual/manual Obsidian checks for inbox processing, new project/person modals, focus view, sphere view, waiting-for view, and keyboard shortcuts modal.
  - 2026-05-12: Obsidian automation skill is present, but its helper scripts are not installed in this environment and `CLAUDE_PLUGIN_ROOT` is unset. Leave this open for a local Obsidian smoke pass.

## Task 6: Type And Lint Hygiene

- [x] Remove stale scan findings that no longer exist after `1.3.1` before editing.
- [x] Replace `any` in new and touched code with local interfaces first, especially Dataview task access and workspace event payloads.
- [x] Remove unused imports/variables reported by the scanner.
- [x] Replace unsafe `TFile` / `TFolder` casts with `instanceof` checks where practical.
- [x] Avoid broad refactors outside files already touched by scanner-driven work.
  - 2026-05-12: Strict TypeScript check with `--noUnusedLocals --noUnusedParameters` passes. Source grep no longer finds live `any`, `as TFile`, or `as TFolder` usages; remaining matches are plain-English comments containing "any". Added local interfaces for Dataview tasks, Flow workspace events, editor-bearing views, Templater access, internal search, and tag cache access.

## Task 7: Release Assets And Artifact Attestations

- [x] Decide whether releases should be fully created by GitHub Actions rather than local `gh release create`.
- [x] Update release automation to build `main.js`, `manifest.json`, and `styles.css` in CI.
- [x] Add GitHub artifact attestations for `main.js` and `styles.css`.
- [x] Update `docs/RELEASING.md` so future releases do not silently miss attestations.
- [x] Keep manual release creation as a fallback only if the attestation workflow documents the limitation.
  - 2026-05-12: Chosen path is CI-owned release assets. The local production release script now creates a draft GitHub release without uploading local assets; the tag workflow validates versions, runs `npm run verify`, checks release assets, generates GitHub artifact attestations for `manifest.json`, `main.js`, and `styles.css`, and uploads those assets to the draft release. Manual `gh release upload` is documented as an emergency fallback only because it cannot satisfy provenance attestation checks.

## Task 8: Verification And Final Community Recheck

- [x] Run `npm run format`.
- [x] Run `npm run build`.
- [x] Run `npm test`.
- [x] Run `npm audit --json` and confirm zero vulnerabilities.
- [x] Inspect bundled output for removed dependencies/domains.
- [ ] Create one release after a coherent remediation batch, not after every individual fix.
- [ ] After the release is indexed, revisit the community page and record the new Health/Review status, issue count, version, license, and description.
  - 2026-05-12: Local verification passes after Tasks 6-7: `npm run format`, `npm run build`, `npm test` (52 suites, 904 tests), strict TypeScript unused-symbol check, `git diff --check`, and `npm audit --json` with 0 vulnerabilities. Bundle grep found no `fetch(`, `atob(`, `btoa(`, Anthropic, Svelte, OpenAI API, or bundled Dataview package references; expected OpenRouter and optional Dataview API lookup strings remain. Release and post-release community recheck remain pending because this batch has not been released.
