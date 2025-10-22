# CLI Ink Usage

The GTD Coach CLI uses Ink (React for terminals) for a modern input experience with multiline text support.

## Running the CLI

```bash
npx tsx src/cli.tsx --vault /path/to/vault --sphere work
```

## Input Controls

- **Enter**: Submit your input
- **Shift+Enter**: Insert a newline and continue editing
- **Backspace**: Delete character before cursor (merges lines at line start)
- **Paste**: Multiline content preserves newlines automatically

## Requirements

- `--vault`: Path to your Obsidian vault (required)
- `--sphere`: Which sphere to focus on (required: work, personal, etc.)

## Example Session

```
What's on your mind? (Shift+Enter for new line, Enter to submit)

> Had a great meeting with the team
> Need to follow up on three action items
> [Press Enter to submit]
```

## Manual Integration Testing Scenarios

When testing the CLI manually, verify these scenarios work correctly:

### Single Line Input

1. Type a single line of text
2. Press Enter
3. Verify input is submitted correctly

### Multiline Input

1. Type first line of text
2. Press Shift+Enter
3. Type second line of text
4. Press Shift+Enter
5. Type third line of text
6. Press Enter
7. Verify all three lines are submitted with preserved newlines

### Paste Multiline Content

1. Copy multiline text to clipboard (e.g., from notes app)
2. Paste into CLI
3. Verify newlines are preserved correctly
4. Press Enter
5. Verify pasted content is submitted correctly

### Backspace Across Lines

1. Type first line
2. Press Shift+Enter
3. Type second line
4. Press Backspace repeatedly to delete all characters on second line
5. Continue pressing Backspace to merge with first line
6. Verify lines merge correctly at the newline boundary

### Empty Input

1. Without typing anything, press Enter
2. Verify empty input is not submitted (component should ignore)
3. Type whitespace only, press Enter
4. Verify whitespace-only input is trimmed and not submitted

## Architecture Notes

The CLI uses React components rendered with Ink:

- **InboxApp**: Root component managing state
- **MultilineTextarea**: Input component with keyboard handling
- **ProcessingIndicator**: Displays spinner during AI processing

All input handling uses Ink's `useInput` hook - no raw terminal mode or readline code.
