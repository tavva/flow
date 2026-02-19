# Configurable Context Tag Prefix

## Problem

Context tags (`#context/home`, `#context/office`) are hardcoded with the prefix `context`. Users can't discover this feature without reading commits, and can't change the prefix to suit their workflow (e.g. `#at/home`, `#ctx/office`).

## Design

### Setting

Add `contextTagPrefix` to `PluginSettings` with default `"context"`.

### Core

Change `extractContexts(text: string)` to `extractContexts(text: string, prefix: string)` — build the regex dynamically from the prefix parameter.

### Call sites

Pass `settings.contextTagPrefix` at all call sites:

- `sphere-view.ts` — has `this.settings`
- `sphere-data-loader.ts` — has `this.settings`
- `someday-scanner.ts` — has `this.settings`
- `waiting-for-scanner.ts` — needs `settings` added to constructor

### Settings UI

Text field in the settings tab with description explaining what context tags are and how to use them.

### README

Short section after "Project Structure" explaining context tags with examples.
