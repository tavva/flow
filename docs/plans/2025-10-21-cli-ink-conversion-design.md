# CLI Ink Conversion Design

**Date:** 2025-10-21
**Status:** Approved

## Overview

Convert the GTD Coach CLI from readline-based input to Ink (React for terminals) to support multiline text input with a modern terminal UI experience.

## Motivation

Current CLI limitations:
- Single-line input only via readline
- Pasted multiline content gets truncated or causes errors
- No way to enter formatted text with newlines
- Poor user experience for longer inbox items

Primary use cases:
1. Pasting formatted content from other apps (meeting notes, emails)
2. Writing longer thoughts directly in the CLI with multiple paragraphs

## Design Decision

**Framework:** Ink (React for terminals)
- Mature, production-ready (used by GitHub Copilot CLI, Cloudflare Wrangler, Prisma)
- Component-based React paradigm
- Provides foundation for future TUI expansion
- Active maintenance with strong ecosystem

**Scope:** Full Ink conversion (not hybrid)
- Replace all readline code with Ink components
- Cleaner architecture with single UI system
- Better foundation for future enhancements

## Architecture

### Component Structure

```
InboxApp (root Ink component)
├── MultilineTextarea (custom component for input)
└── ProcessingIndicator (spinner + status)
```

### User Flow

1. User invokes CLI with required sphere argument:
   ```bash
   npx tsx src/cli.ts --vault /path/to/vault --sphere work
   ```
2. App renders `MultilineTextarea` with "What's on your mind?" prompt
3. User types/pastes content:
   - **Shift+Enter** → Insert newline, continue editing
   - **Enter** → Submit content
   - **Paste with newlines** → Insert content preserving newlines, don't auto-submit
4. App shows `ProcessingIndicator` while AI processes
5. Display results and exit

### CLI Arguments

- `--vault` (required) - Path to Obsidian vault
- `--sphere` (required) - Sphere to process for (work, personal, etc.)

**Breaking change:** `--sphere` becomes required instead of being prompted for interactively.

## Implementation Details

### MultilineTextarea Component

**State:**
- `lines: string[]` - Array of text lines
- `cursorRow: number` - Current line index
- `cursorCol: number` - Column position within line

**Key Handling (useInput hook):**
- `Enter` → Submit (call onSubmit callback)
- `Shift+Enter` → Insert newline (split current line at cursor)
- `Backspace` → Delete char before cursor, merge lines if at start
- `Delete` → Delete char after cursor
- `Arrow keys` → Navigate cursor (up/down between lines, left/right within line)
- `Home/End` → Jump to start/end of current line
- Regular characters → Insert at cursor position

**Paste Detection:**
- Detect paste by checking for newline characters in key event data
- Insert pasted content at cursor position, preserving newlines
- Don't auto-submit on paste (user must press Enter)

**Visual Rendering:**
```
What's on your mind? (Shift+Enter for new line, Enter to submit)

> First line of text
> Second line here
> Third line with cursor█
```

The `>` prompt on each line provides visual feedback for multiline mode.

### Dependencies

**New dependencies:**
- `ink` - Core framework
- `react` - Peer dependency for Ink
- `@types/react` - TypeScript types

### File Structure

```
src/
├── cli.tsx (renamed from .ts, now renders Ink app)
├── components/
│   ├── InboxApp.tsx (root component)
│   ├── MultilineTextarea.tsx (custom textarea)
│   └── ProcessingIndicator.tsx (spinner + status)
└── (existing files unchanged)
```

### Backward Compatibility

**Breaking changes:**
- `--sphere` argument becomes required (no interactive prompt)
- Remove all readline-based input code

**Unchanged:**
- All AI processing logic
- File scanning and writing logic
- Validation logic
- Error handling logic

### Error Handling

- Missing `--sphere` → Display error message with usage help, exit
- Invalid sphere → Show available spheres, exit
- AI processing errors → Display with Ink Text component (red color)
- Network errors → Existing retry logic continues to work

## Testing Strategy

### Unit Tests
- `MultilineTextarea.test.tsx` - Key handling logic, cursor movement, paste detection
- `InboxApp.test.tsx` - Component integration, state management

### Integration Tests
- Full flow test with mocked AI processing
- Argument parsing and validation
- Error display

### Manual Testing
- Test across different terminals (iTerm2, Terminal.app, etc.)
- Verify paste behavior from different sources
- Test with various content types (plain text, formatted text, code)

## Migration Path

1. Install dependencies (`ink`, `react`, `@types/react`)
2. Create component directory structure
3. Implement `MultilineTextarea` component (TDD)
4. Implement `ProcessingIndicator` component
5. Implement `InboxApp` root component
6. Convert `cli.ts` to `cli.tsx` and wire up Ink rendering
7. Update argument parsing to require `--sphere`
8. Remove all readline code
9. Update documentation and README

## Future Enhancements

Potential TUI features enabled by Ink foundation:
- Visual inbox browser with arrow key navigation
- Split pane view (projects left, details right)
- Interactive project/action editing
- Real-time AI processing with progress indicators
- Hotlist management interface
- Waiting-for items view

**Note:** Future direction uncertain (may move features into Obsidian plugin). Ink provides flexibility without over-committing to full TUI.

## Open Questions

None - design approved.

## References

- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink Documentation](https://github.com/vadimdemedes/ink#documentation)
- Current CLI implementation: `src/cli.ts`
