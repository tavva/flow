# Hotlist Archive Links Design

**Date:** 27 October 2025

**Purpose:** Add wikilinks to archived hotlist items so users can navigate back to the source file.

## Requirements

When hotlist items are archived, each item should include a link back to its source file:
- **Project items**: `- [[Projects/Health]] Call Dr. Smith`
- **General actions**: `- [[Next actions|Call Dr. Smith]]`

## Current Behaviour

The `archiveClearedTasks()` function in `src/hotlist-auto-clear.ts` currently:
1. Strips checkbox markers from `item.lineContent`
2. Outputs plain list items: `- Call Dr. Smith`

## Design

### Data Available

The `HotlistItem` type provides:
- `file`: Source file path (e.g., `Projects/Health.md`)
- `text`: Action text without checkbox (e.g., `Call Dr. Smith`)
- `isGeneral`: Boolean indicating if from Next actions file vs project

### Implementation

Modify the mapping function in `archiveClearedTasks()` (line 85-90):

**Current:**
```typescript
items.map((item) => {
  return item.lineContent.replace(/^(\s*-\s*)\[[^\]]*\]\s*/, "$1");
})
```

**New:**
```typescript
items.map((item) => {
  const wikilinkPath = item.file.replace(/\.md$/, '');

  if (item.isGeneral) {
    return `- [[Next actions|${item.text}]]`;
  } else {
    return `- [[${wikilinkPath}]] ${item.text}`;
  }
})
```

### Testing Strategy

1. **Update existing test** - "strips checkbox markers from archived items" to verify new link format
2. **Add new test** - "formats general vs project items correctly with wikilinks"
3. **Test edge cases**:
   - Files without `.md` extension
   - Special characters in file paths
   - Verify both general and project items in same archive batch

## Trade-offs

**Chosen approach:**
- Simple path-to-wikilink conversion (strip `.md`, wrap in `[[]]`)
- Use `item.text` instead of parsing `lineContent`
- Different format for general vs project items for better readability

**Rejected alternatives:**
- Wikilinks with block IDs (requires modifying source files, too invasive)
- Plain text paths (not clickable in Obsidian)
- Adding sphere tags (verbose, sphere context less useful in archive)
