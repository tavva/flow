# CLI Word Wrapping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add word wrapping to CLI output so long text wraps to terminal width instead of overflowing.

**Architecture:** Post-process markdown-rendered output with `wrap-ansi` library before logging to console. Use `process.stdout.columns` to detect terminal width with 80-column fallback.

**Tech Stack:** wrap-ansi (v9.0.0), existing marked-terminal for markdown rendering

---

## Task 1: Add wrap-ansi dependency

**Files:**
- Modify: `package.json`

**Step 1: Add wrap-ansi to dependencies**

```bash
cd ~/.config/superpowers/worktrees/flow/cli-word-wrapping
npm install --save wrap-ansi@^9.0.0
```

Expected: Package added to dependencies in package.json

**Step 2: Verify installation**

```bash
npm list wrap-ansi
```

Expected: Shows wrap-ansi@9.x.x in dependency tree

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add wrap-ansi dependency for terminal text wrapping"
```

---

## Task 2: Create wrapForTerminal utility function

**Files:**
- Modify: `src/cli.tsx:1-25` (add import and function after existing imports)

**Step 1: Add wrap-ansi import**

Add after the existing imports (around line 22):

```typescript
import wrapAnsi from 'wrap-ansi';
```

**Step 2: Create wrapForTerminal function**

Add after the imports, before the `CliArgs` interface (around line 24):

```typescript
/**
 * Wraps text to terminal width whilst preserving ANSI color codes.
 * Uses process.stdout.columns with 80-column fallback.
 */
function wrapForTerminal(text: string): string {
  const width = process.stdout.columns || 80;
  return wrapAnsi(text, width, { hard: false, trim: false });
}
```

**Step 3: Verify no syntax errors**

```bash
npm run lint
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/cli.tsx
git commit -m "Add wrapForTerminal utility function"
```

---

## Task 3: Apply wrapping to Coach responses

**Files:**
- Modify: `src/cli.tsx:385` (the console.log for Coach responses)

**Step 1: Find the Coach response output**

Current code (around line 385):

```typescript
console.log(`${colors.assistant}Coach:${colors.reset}\n${rendered}`);
```

**Step 2: Wrap the rendered markdown before logging**

Replace with:

```typescript
console.log(`${colors.assistant}Coach:${colors.reset}\n${wrapForTerminal(rendered)}`);
```

**Step 3: Verify no syntax errors**

```bash
npm run lint
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/cli.tsx
git commit -m "Apply word wrapping to Coach markdown responses"
```

---

## Task 4: Apply wrapping to tool execution messages

**Files:**
- Modify: `src/cli.tsx:220-221,230` (tool result messages)

**Step 1: Wrap tool error messages**

Find around line 220-221:

```typescript
if (result.is_error) {
  console.log(`  ✗ ${result.content}`);
} else {
  console.log(`  ${result.content}`);
}
```

Replace with:

```typescript
if (result.is_error) {
  console.log(`  ✗ ${wrapForTerminal(result.content)}`);
} else {
  console.log(`  ${wrapForTerminal(result.content)}`);
}
```

**Step 2: Wrap tool summary message**

Find around line 230:

```typescript
console.log(`\n${colors.assistant}Coach:${colors.reset} ${summary}\n`);
```

Replace with:

```typescript
console.log(`\n${colors.assistant}Coach:${colors.reset} ${wrapForTerminal(summary)}\n`);
```

**Step 3: Verify no syntax errors**

```bash
npm run lint
```

Expected: No TypeScript errors

**Step 4: Run tests**

```bash
npm test
```

Expected: All 492 tests pass (wrapping doesn't affect test behaviour)

**Step 5: Commit**

```bash
git add src/cli.tsx
git commit -m "Apply word wrapping to tool execution messages"
```

---

## Task 5: Build and manual verification

**Files:**
- None (verification only)

**Step 1: Build the CLI**

```bash
npm run build:cli
```

Expected: dist/cli.mjs built successfully

**Step 2: Verify in narrow terminal**

This requires manual testing. Create a test vault or use existing one:

```bash
# Resize terminal to 80 columns
# Run CLI with a sphere
node dist/cli.mjs --vault /path/to/vault --sphere work
```

**Step 3: Test word wrapping**

In the CLI, ask a question that will produce a long response:

```
> Explain the benefits of GTD in detail with multiple long paragraphs.
```

Expected: Long paragraphs wrap at terminal width, no text runs off screen

**Step 4: Test with wider terminal**

Resize terminal to 120 columns and ask the same question.

Expected: Text wraps at new width (more text per line)

**Step 5: Test tool execution wrapping**

Ask the Coach to suggest improvements that trigger tool calls:

```
> Review my projects and suggest improvements
```

Expected: Tool result messages wrap correctly

**Step 6: Document verification**

Add note to commit message that manual testing was performed.

```bash
git commit --allow-empty -m "Verify word wrapping works in terminal

Manual testing performed:
- Long responses wrap correctly at 80 columns
- Text re-wraps when terminal resized
- Tool execution messages wrap properly
- ANSI colors preserved after wrapping
"
```

---

## Task 6: Update documentation

**Files:**
- Modify: `CLAUDE.md` (update CLI section with wrapping info)

**Step 1: Find CLI documentation section**

Locate the "GTD Coach CLI" section in CLAUDE.md

**Step 2: Add wrapping note**

Add after the existing CLI usage notes:

```markdown
**Output Formatting:**
- CLI output automatically wraps to terminal width using `wrap-ansi`
- Width detection uses `process.stdout.columns` (fallback: 80 columns)
- ANSI colors are preserved during wrapping
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document CLI word wrapping feature"
```

---

## Verification Checklist

Before considering complete:

- [ ] All 492 tests pass
- [ ] CLI builds without errors
- [ ] Long text wraps in 80-column terminal
- [ ] Text re-wraps when terminal resized
- [ ] ANSI colors preserved
- [ ] Tool messages wrap correctly
- [ ] Documentation updated

---

## Notes

**Testing Strategy:**
- No unit tests for wrapping (would require mocking process.stdout.columns)
- Manual verification in terminal is sufficient
- Existing tests verify wrapping doesn't break functionality

**Code Block Handling:**
- Using `hard: false` means code won't break mid-word
- Long code lines may still overflow (acceptable)
- No special code block detection needed

**Potential Future Improvements:**
- Add configuration option for max width override
- Better handling of very long code blocks
- Detect and preserve pre-formatted blocks
