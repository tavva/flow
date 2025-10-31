# Weekly Review Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add conversational weekly review guidance to CLI coach through system prompt

**Architecture:** Extend buildSystemPrompt() to include Weekly Review Protocol section that teaches the AI how to guide users through GTD weekly reviews

**Tech Stack:** TypeScript, Jest

---

## Task 1: Add Test for Weekly Review Protocol

**Files:**

- Modify: `tests/cli-system-prompt.test.ts`

**Step 1: Write the failing test**

Add this test at the end of the test suite (after line 96, before the closing `});`):

```typescript
it("should include weekly review protocol", () => {
  const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

  expect(prompt).toContain("Weekly Review Protocol:");
  expect(prompt).toContain("Process inbox to zero");
  expect(prompt).toContain("Review projects");
  expect(prompt).toContain("Review next actions");
  expect(prompt).toContain("Review someday/maybe");
  expect(prompt).toContain("Review waiting-for");
  expect(prompt).toContain("Set weekly focus");
  expect(prompt).toContain("Present relevant data");
  expect(prompt).toContain("Wait for acknowledgment before proceeding");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- cli-system-prompt.test.ts`

Expected: FAIL with message like "Expected string to contain 'Weekly Review Protocol:'"

**Step 3: Commit the failing test**

```bash
git add tests/cli-system-prompt.test.ts
git commit -m "test: add failing test for weekly review protocol"
```

---

## Task 2: Add Weekly Review Protocol to System Prompt

**Files:**

- Modify: `src/cli.tsx:82-230` (buildSystemPrompt function)

**Step 1: Add Weekly Review Protocol section**

Insert this code after line 135 (after the GTD Quality Standards section, before the `if (projectCount === 0...` check):

```typescript
prompt += `Weekly Review Protocol:\n`;
prompt += `When the user asks for help with a weekly review, guide them through these steps:\n`;
prompt += `1. Process inbox to zero\n`;
prompt += `2. Review projects (identify stalled, suggest improvements)\n`;
prompt += `3. Review next actions (improve clarity, suggest focus items)\n`;
prompt += `4. Review someday/maybe (activate items, prune irrelevant)\n`;
prompt += `5. Review waiting-for (identify follow-ups)\n`;
prompt += `6. Set weekly focus\n\n`;
prompt += `For each step:\n`;
prompt += `- Present relevant data using the context you have\n`;
prompt += `- Highlight issues (stalled projects, vague actions, overdue items)\n`;
prompt += `- Suggest improvements using available tools\n`;
prompt += `- Wait for acknowledgment before proceeding\n`;
prompt += `- Accept questions or requests to skip steps\n\n`;
```

**Step 2: Run test to verify it passes**

Run: `npm test -- cli-system-prompt.test.ts`

Expected: PASS (all tests passing, including the new weekly review test)

**Step 3: Run full test suite**

Run: `npm test`

Expected: All 569 tests pass

**Step 4: Commit the implementation**

```bash
git add src/cli.tsx
git commit -m "feat: add weekly review protocol to CLI system prompt

Adds Weekly Review Protocol section to buildSystemPrompt() that teaches
the AI to guide users through six-step GTD weekly review process. The
AI detects weekly review requests conversationally and walks through:
inbox processing, project review, next actions, someday/maybe,
waiting-for, and focus setting."
```

---

## Task 3: Manual Testing

**Files:**

- None (manual CLI testing)

**Step 1: Build the CLI**

Run: `npm run build:cli`

Expected: Build succeeds, creates `dist/cli.mjs`

**Step 2: Test weekly review request**

Run the CLI (replace paths with actual vault):

```bash
./dist/cli.mjs --vault ~/test-vault --sphere work
```

At the prompt, type:

```
Help me run my weekly review please
```

Expected output should:

- Recognise the weekly review request
- Begin guiding through the review process
- Start with inbox processing
- Show relevant GTD context data

**Step 3: Test that the AI follows the protocol**

Continue the conversation:

- Ask to skip inbox if it's empty
- Verify the AI moves to the next step (projects)
- Confirm the AI shows stalled projects
- Verify the AI suggests using tools (update_project, etc.)

Expected: AI guides through each step, waits for acknowledgment, accepts skip requests

**Step 4: Document results**

Create a brief note in your journal about:

- Whether the AI correctly detected weekly review request
- Whether it followed the six-step process
- Quality of guidance and suggestions

---

## Completion Checklist

- [ ] Test added and passing for weekly review protocol
- [ ] Weekly Review Protocol section added to system prompt
- [ ] All existing tests still pass
- [ ] Manual testing confirms AI guides weekly review process
- [ ] Changes committed with clear messages
