# Legacy Focus Migration Design

Migration path for users upgrading from the old Flow version (which used `#flow-planned` tags on tasks) to the new beta version (which stores focus data in a JSON file).

## Overview

The old system tagged tasks with `#flow-planned` inline. The new system stores focus items in `flow-focus-data/focus.md` as structured JSON with metadata (file, line number, sphere, timestamps, etc.).

## State Tracking

Two new settings fields track migration state:

```typescript
legacyFocusMigrationDismissed: boolean; // "Don't ask again" for migration
legacyFocusTagRemovalDismissed: boolean; // "Keep forever" for tag removal
```

**Logic:**

- If `#flow-planned` tags exist AND `legacyFocusMigrationDismissed` is false → show migration prompt
- After migration, if tags still exist AND `legacyFocusTagRemovalDismissed` is false → show tag removal prompt

## Scanner

Scans the entire vault for checkbox lines containing `#flow-planned`:

```typescript
interface LegacyFocusItem {
  file: string; // File path
  lineNumber: number; // 1-indexed
  lineContent: string; // Full line text
}

async function scanForLegacyFocusTags(vault: Vault): Promise<LegacyFocusItem[]>;
```

Matches any checkbox state: `- [ ]`, `- [x]`, `- [w]`.

## Code Organisation

All migration code lives in `src/legacy-focus-migration.ts` with one entry point:

```typescript
export async function checkAndPromptLegacyMigration(
  app: App,
  settings: PluginSettings,
  saveSettings: () => Promise<void>
): Promise<void>;
```

Called from `main.ts` `onload()` after settings are loaded.

**File contents:**

- `scanForLegacyFocusTags()` - finds legacy items
- `migrateLegacyFocusItems()` - converts to new format, skips duplicates
- `removeLegacyTags()` - strips `#flow-planned` from source files
- `LegacyMigrationModal` - confirmation modal
- `TagRemovalModal` - post-migration modal

**Future removal:** Delete the file, remove one import and one call from `main.ts`, remove two settings fields.

## Migration Logic

When user clicks "Migrate":

1. Load existing focus items from `focus.md`
2. For each legacy item, create a `FocusItem`:
   - `file`, `lineNumber`, `lineContent`: from scanner
   - `text`: extract action text (strip checkbox, tags)
   - `sphere`: detect from inline `#sphere/X` or project frontmatter
   - `isGeneral`: true if file matches `nextActionsFilePath`
   - `addedAt`: `Date.now()`
   - `isPinned`: false
3. Skip duplicates (same `file` + `lineContent` already in focus)
4. Skip items with no detectable sphere (warn user)
5. Save combined list to `focus.md`

## Modal UI

**Migration Modal:**

- Title: "Migrate Legacy Focus Items"
- Body: "Found X items with #flow-planned tags. Would you like to migrate them to the new focus system?"
- Buttons: [Migrate] [Not now] [Don't ask again]

**Tag Removal Modal:**

- Title: "Remove Legacy Tags"
- Body: "Migration complete. X items migrated. (Y items skipped - no sphere detected)"
- "Would you like to remove the #flow-planned tags from your files?"
- Buttons: [Remove tags] [Keep for now] [Keep forever]

The "skipped" line only appears if items were skipped.

## Edge Cases

1. **No legacy tags** - no modal shown
2. **Tags on completed/waiting items** - still migrate
3. **File deleted between scan and migration** - skip gracefully
4. **No sphere detected** - skip item, warn user
5. **Duplicates** - skip items already in focus

## Testing

Test coverage in `legacy-focus-migration.test.ts`:

- Scanner finds tags across files
- Scanner ignores non-checkbox lines
- Migration creates correct FocusItem structure
- Migration skips duplicates
- Sphere detection from frontmatter and inline tags
- Items without sphere are skipped
- Tag removal modifies source files
- Settings flags set correctly
