# Inbox Tag Autocomplete

## Problem

The "Add to inbox" modal uses a plain text input where Obsidian's editor tag
autocomplete doesn't work. Users must type full tag names manually, which is
error-prone and friction-heavy for context tags.

## Design

Add a `TagSuggest` class (extending Obsidian's `AbstractInputSuggest`) that
provides inline tag autocomplete in the inbox modal's text input.

- **Trigger:** Activates when text contains `#` followed by characters.
  Detects the `#fragment` at or before the cursor position.
- **Source:** `app.metadataCache.getTags()` — all vault tags with counts.
- **Filtering:** Case-insensitive match of partial fragment against vault tags.
- **Selection:** Replaces only the `#fragment` portion of the input text with
  the selected tag. Preserves surrounding text.
- **Integration:** Attached to the input element in `AddToInboxModal.onOpen()`.
