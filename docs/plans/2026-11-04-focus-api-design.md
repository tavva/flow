# Focus Items From Other Plugins

## Overview

Let other Obsidian plugins put items into Focus that have no line in the vault,
such as a Linear ticket or a GitHub issue. Flow stores and shows them like any
other Focus item and reports changes back to the plugin that added them.

Flow knows nothing about any particular source. A companion plugin
(`flow-linear` is the first) owns the connection to the outside tool, the
mapping between its records and Focus items, and any syncing. Flow provides:

- an external kind of Focus item, stored in `focus.md`
- a public API on the plugin instance
- Focus view support for showing, completing, editing and removing these items

Out of scope: external items in sphere views, project views, waiting-for or
someday. They exist only in Focus.

## Data model

`FocusItem` becomes a union of two kinds, told apart by the `external` field:

```typescript
interface FocusItemBase {
  text: string; // Display text
  sphere: string;
  addedAt: number;
  isPinned?: boolean;
  completedAt?: number;
  contexts?: string[];
}

export interface VaultFocusItem extends FocusItemBase {
  file: string;
  lineNumber: number;
  lineContent: string;
  isGeneral: boolean;
}

export interface ExternalFocusItem extends FocusItemBase {
  id: string; // Stable ID, crypto.randomUUID()
  external: ExternalSource;
}

export interface ExternalSource {
  sourceName: string; // Owning plugin's source, e.g. "linear"
  sourceLabel: string; // Shown as a chip, e.g. "Rootcause"
  url: string; // Opened when the item is clicked
  externalId: string; // The source's own ID, e.g. "ROO-123"
}

export type FocusItem = VaultFocusItem | ExternalFocusItem;

export function isExternalFocusItem(item: FocusItem): item is ExternalFocusItem {
  return "external" in item;
}
```

Vault items keep their current shape and identity, so existing `focus.md`
files load unchanged and no migration is needed. Only external items carry an
`id`; vault items are still identified by `file` + `lineNumber` + `addedAt`.

Making the type a union means the compiler flags every place that reads
`file`, `lineNumber`, `lineContent` or `isGeneral`. Each of those places either
narrows to vault items or handles external items explicitly (listed below).

### Item identity

The comparison `i.file === item.file && i.lineNumber === item.lineNumber &&
i.addedAt === item.addedAt` is repeated eight times in `focus-view.ts`. It
moves into one helper in `src/focus-item.ts`:

```typescript
export function isSameFocusItem(a: FocusItem, b: FocusItem): boolean;
```

External items compare by `id`; vault items by the existing three fields; an
external item never equals a vault item. Pin, unpin, remove, complete and
drag-and-drop all use it.

## File format (read contract)

`focus.md` stays JSONL: one JSON object per line, in Focus order (the order
the view shows, which drag-and-drop changes). Other tools may read it;
frame-automation does. An external item line looks like:

```json
{"id":"7c1e…","text":"Draft section 2 of the evals plan","sphere":"work","addedAt":1793520000000,"external":{"sourceName":"linear","sourceLabel":"Rootcause","url":"https://linear.app/rootcause/issue/ROO-123/evals-plan","externalId":"ROO-123"},"contexts":[]}
```

The contract, documented in the README under a new "Focus file format"
section:

- A line with `external` is an external item; any other line is a vault item
  with `file` (vault-relative path), `lineNumber`, `lineContent`, `text`,
  `sphere`, `isGeneral`, `addedAt`.
- `isPinned` true means the item is in the pinned section.
- `completedAt` (ms since epoch) is set once the item is completed; completed
  items stay in the file until removed or auto-cleared.
- Readers skip lines that fail to parse, as Flow does.
- The file's location is set in Flow's settings
  (default `flow-focus-data/focus.md`).
- New fields may be added; readers ignore fields they don't know.

## Public API

Flow sets `this.api` on its plugin instance in `onload`, so companions reach
it as `app.plugins.getPlugin("flow")?.api`. The API lives in
`src/focus-api.ts` and is exported as a type from that file so a companion can
copy or import the interface.

```typescript
export interface FlowApi {
  apiVersion: 1;

  addFocusItem(input: {
    text: string;
    sphere: string;
    sourceName: string;
    sourceLabel: string;
    url: string;
    externalId: string;
  }): Promise<string>; // Returns the new item's id

  updateFocusItem(
    id: string,
    changes: Partial<{ text: string; sphere: string; sourceLabel: string; url: string }>
  ): Promise<void>;

  completeFocusItem(id: string): Promise<void>; // Sets completedAt
  removeFocusItem(id: string): Promise<void>;

  getFocusItems(sourceName: string): Promise<ExternalFocusItem[]>;
  getSpheres(): string[]; // Sphere names from Flow's settings

  onFocusChange(sourceName: string, callback: (change: FocusChange) => void): () => void;
}

export type FocusChange =
  | { type: "added"; item: ExternalFocusItem }
  | { type: "edited"; item: ExternalFocusItem; previous: ExternalFocusItem }
  | { type: "completed"; item: ExternalFocusItem }
  | { type: "removed"; item: ExternalFocusItem };
```

`completeFocusItem` is added to the four operations agreed earlier because a
companion needs it when the outside record closes (a Linear ticket marked
done).
`getSpheres` lets a companion offer a sphere dropdown in its settings.

Every write goes through `updateFocusItems`, so it holds the focus file lock,
reads the latest file and never overwrites another writer's change. Calls with
an unknown `id` reject with a `ValidationError`. `addFocusItem` rejects empty
`text`, `sphere`, `sourceName` or `externalId`. Adding the same `externalId`
twice is allowed: one outside record can have several Focus steps.

`apiVersion` changes only when an existing method changes in a way that breaks
callers. Adding methods doesn't change it. Companions check it and show a
notice when it's a version they don't support.

### Change events

Change events come from comparing focus file snapshots, not from the code
paths that make changes. This means they cover every writer: the Focus view,
the API, auto-clear, and edits synced in from another device.

- Flow keeps the last parsed snapshot of the focus file.
- After each write under the lock, and on a vault `modify` event for the focus
  file path, Flow parses the file and compares it with the snapshot.
- `diffExternalFocusItems(before, after)` is a pure function in
  `src/focus-api.ts` that matches external items by `id` and returns
  `FocusChange[]`: new ids are `added`, missing ids are `removed`, a newly set
  `completedAt` is `completed`, any other change to `text`, `sphere`,
  `sourceLabel` or `url` is `edited`.
- Each change goes to the callbacks registered for its `sourceName`. A
  throwing callback is logged and doesn't stop the others.
- Pin and reorder changes aren't reported.

Events include changes the companion made itself through the API, so a
companion must handle them without side effects when nothing has changed.
Flow sends no events for the state at startup: a companion calls
`getFocusItems` once Flow is ready and reconciles from that. Events are hints
that something changed; the file is the source of truth.

### Detecting Flow

Obsidian loads every enabled plugin before `onLayoutReady` fires, in no set
order. So:

- A companion looks up `app.plugins.getPlugin("flow")?.api` inside
  `app.workspace.onLayoutReady`.
- Flow fires `app.workspace.trigger("flow:api-ready", api)` at the end of
  `onload` and `flow:api-unloaded` in `onunload`, so a companion notices when
  Flow is enabled, disabled or reloaded later.
- Flow clears all change callbacks on unload.

`app.plugins` isn't in Obsidian's public typings. The companion declares the
narrow type it uses. That is the companion's problem, not Flow's.

## Code paths

Places that change for external items:

| Place                                                       | External item behaviour                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `FocusView.performRefresh` validation                       | Kept as-is; no `FocusValidator` call, no line refresh                                                                                         |
| `FocusView.markItemComplete`                                | Sets `completedAt` only; no file edit                                                                                                         |
| `FocusView.convertToWaitingFor`                             | Not offered; the waiting-for button is hidden                                                                                                 |
| Remove, pin, unpin, drag-and-drop                           | Use `isSameFocusItem`                                                                                                                         |
| `FocusView.groupItems`                                      | Third group kind keyed by `sourceLabel`, shown after project groups and before general actions, sorted by label; the same in Completed Today |
| `renderItem` / `renderPinnedItem` / `renderCompletedItem`   | Text set as plain text, not rendered as markdown; `sourceLabel` chip and `externalId` shown; clicking opens `url` with `window.open`          |
| `handleRenderedTextClick`, `openFile`                       | Not used for external items                                                                                                                   |
| Metadata cache listener (`item.file === file.path`)         | Narrows to vault items                                                                                                                        |
| `FocusValidator`, `ActionLineFinder`                        | Only take `VaultFocusItem`                                                                                                                    |
| `sphere-view.ts`, `focus-editor-menu.ts` line checks        | Narrow to vault items                                                                                                                         |
| `archiveClearedTasks`                                       | External item written as `- [sourceLabel externalId](url) text`                                                                               |
| `legacy-focus-migration.ts`                                 | Vault items only (legacy data has none)                                                                                                       |
| Context filter                                              | External items have no contexts, so they behave like vault items without contexts                                                            |

### Editing the wording

External items get an edit button (pencil icon) next to complete and remove.
Clicking it swaps the text for an input; Enter saves through
`updateFocusItems`, Escape cancels, and an empty value is refused. Vault items
don't get the button: you edit their wording in the source file.

### Auto-clear and archive

Auto-clear treats external items like vault items: all items leave Focus, and
active ones go to the archive. Companions see a `removed` event for each one
and decide what that means (`flow-linear` removes the ticket's label).

## Testing

All tests use the existing Obsidian mock vault (`tests/__mocks__/obsidian.ts`)
and real Flow code; nothing asserts on mocked behaviour.

- `focus-persistence`: round-trip of mixed vault and external items; existing
  vault-only files parse unchanged.
- `isSameFocusItem`: external by id, vault by the three fields, never across
  kinds.
- `diffExternalFocusItems`: added, removed, completed, edited, pin/reorder
  ignored, vault items ignored, an item completed and edited in one diff.
- `focus-api`: add/update/complete/remove against a mock vault focus file,
  including unknown ids, empty fields, duplicate `externalId`, concurrent
  writes from the view and the API keeping both changes, and callbacks firing
  once per change for the right `sourceName` only, including changes written
  directly to the file (sync).
- `focus-view`: external items render with chip and link, complete without
  touching any vault file, hide the waiting-for button, survive refresh
  validation, edit in place (save, cancel, empty refused).
- `focus-auto-clear`: archive line for external items.
- `flow:api-ready` fires on load; callbacks are cleared on unload.

## Docs to update

- `AGENTS.md`: Focus System section gains `src/focus-api.ts` and
  `src/focus-item.ts`, and a note that external items have no source line.
- `README.md`: a "Focus items from other plugins" section (what the API
  offers, how to detect Flow, `apiVersion`), and the "Focus file format"
  contract above.
