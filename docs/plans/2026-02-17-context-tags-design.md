# GTD Context Tags

## Problem

Flow lacks support for GTD contexts (@home, @phone, @errands) — a core GTD
concept that answers "what can I do right here, right now?" Users can add
Obsidian tags manually but Flow doesn't extract, display, or filter by them.

## Design

### Tag Format

`#context/X` inline on action checkbox lines, matching the existing `#sphere/X`
pattern:

```markdown
- [ ] Call dentist about appointment #context/phone
- [ ] Buy milk and eggs #context/errands
- [ ] Review pull request #context/computer
```

### Scope

- **Action lines only.** No project-level defaults, no tags on projects or
  someday items.
- **Not stripped from display text.** Unlike `#sphere/X`, context tags remain
  visible — they convey useful information at a glance.
- **No predefined list.** Contexts are discovered dynamically from whatever
  `#context/X` tags exist in the vault.

### Data Model

Add `contexts: string[]` to action data structures:

- Actions in `SphereDataLoader` output
- `FocusItem` in `types/domain.ts` (persisted in JSONL)
- Waiting-for items from `WaitingForScanner`
- Someday items from `SomedayScanner`

Default `[]` for actions without context tags. Existing FocusItems without a
`contexts` field default to `[]` on read.

### Extraction

Extend existing scanners to extract `#context/X` alongside `#sphere/X`:

- **`SphereDataLoader`** — extract context tags during action line parsing
- **`WaitingForScanner`** — extract context tags alongside sphere tags
- **`SomedayScanner`** — same pattern
- **`FocusPersistence`** — persist `contexts` array in JSONL, default `[]` on
  read for backwards compatibility

Regex: `/#context\/([^\s]+)/gi`

### Filter UI

Multi-select toggle buttons in all four views:

- **SphereView** — context filter alongside existing text search
- **FocusView** — context filter (currently has no filter UI)
- **WaitingForView** — context filter below existing sphere filter
- **SomedayView** — context filter below existing sphere filter

Behaviour:

- Buttons show all context tags found in the current view's data
- No contexts selected = show everything (no filtering)
- One or more selected = show only actions with at least one matching tag
- Actions with no context tags are hidden when any filter is active
- Available buttons update dynamically as data changes
- Selected contexts persisted via `getState()`/`setState()`

Follows the existing sphere filter pattern from WaitingForView/SomedayView.

### Out of Scope

- Autocomplete for context tags in inbox modal (follow-up)
- AI-suggested context tags
- Context tags on non-action items
