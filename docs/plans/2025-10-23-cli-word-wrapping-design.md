# CLI Word Wrapping Design

**Date:** 2025-10-23
**Status:** Approved for implementation

## Problem

CLI output from the GTD Coach runs past terminal width without wrapping, making long responses difficult to read. The issue affects markdown-rendered Coach responses where paragraph text extends beyond the visible terminal area.

## Solution

Add word wrapping to CLI output using the `wrap-ansi` library, which preserves ANSI color codes whilst wrapping text to terminal width.

## Design

### Approach

Use `wrap-ansi` as a post-processing step after markdown rendering:

1. `marked-terminal` renders markdown to ANSI-colored text (existing)
2. `wrap-ansi` wraps the ANSI text to terminal width (new)
3. Wrapped text outputs via `console.log()` (existing)

**Why wrap-ansi:**

- Battle-tested library for ANSI-aware text wrapping
- Simple integration at final output stage
- Preserves color codes and formatting
- Minimal architectural impact

### Integration Points

**File:** `src/cli.tsx`

**New utility function:**

```typescript
import wrapAnsi from "wrap-ansi";

function wrapForTerminal(text: string): string {
  const width = process.stdout.columns || 80;
  return wrapAnsi(text, width, { hard: false, trim: false });
}
```

**Apply wrapping to:**

- Line 385: Coach markdown responses
- Lines 220-221: Tool execution result messages
- Line 230: Tool execution summary messages

**Leave unwrapped:**

- Ink components (handle their own layout)
- System messages ("Thinking...", "Network error...")
- Initial stats display (lines 266-271)

### Configuration

- **Width:** `process.stdout.columns` with 80-column fallback
- **hard: false** - Only break at whitespace, not mid-word
- **trim: false** - Preserve markdown spacing

### Code Block Handling

Code blocks won't receive special treatment. They'll use soft wrapping (break at whitespace only). If code lines exceed terminal width, they'll overflow. This is acceptable because:

- Code often needs horizontal scrolling anyway
- Detecting code block boundaries in rendered ANSI is fragile
- Simple solution is better than complex code block detection

## Implementation

**Dependency:**

```json
"wrap-ansi": "^9.0.0"
```

**Changes:**

- Add `wrap-ansi` import to `src/cli.tsx`
- Create `wrapForTerminal()` utility function
- Wrap output at three locations (Coach responses, tool results, tool summaries)

## Testing

Manual testing in terminal:

- Verify long Coach responses wrap correctly
- Check ANSI colors preserved after wrapping
- Test with different terminal widths
- Verify code blocks don't break mid-word
