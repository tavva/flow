# CLI Opening Message Design

**Date:** 2025-10-24
**Status:** Approved

## Summary

Add a proactive opening message to the CLI that observes system state and offers specific help options. The opening message replaces the current "wait for user input" approach with data-driven observations about the GTD system's health.

## Requirements

### Message Behaviour

- **No issues found**: Brief positive summary ("System looks healthy. 5 P1 projects active.")
- **Issues found**: High-level counts only, no specific examples
- **Always**: State observations + 3 numbered action options
- **Issue triggers**:
  - Stalled projects (projects with no next actions)
  - Large inbox (>5 items, configurable threshold)

### Architecture

**Hybrid approach**: TypeScript detects issues using simple heuristics, AI formats the message naturally.

**Rationale**:

- Consistent detection logic (no model variance)
- Natural language formatting (leverages AI strengths)
- No extra token cost for detection
- One additional API call at startup for formatting

## Design

### 1. System Analysis (TypeScript)

**New file**: `src/system-analyzer.ts`

```typescript
interface SystemIssues {
  stalledProjects: number; // Projects with no next actions
  inboxCount: number; // Total inbox items
  inboxNeedsAttention: boolean; // true if > threshold
  hasIssues: boolean; // true if any issue present
}

class SystemAnalyzer {
  /**
   * Analyze GTD system for issues
   * @param gtdContext - Scanned GTD context (inbox, actions, someday items)
   * @param projects - All projects for the sphere
   * @param inboxThreshold - Inbox size that triggers attention flag (default: 5)
   */
  static analyze(
    gtdContext: GTDContext,
    projects: FlowProject[],
    inboxThreshold: number = 5
  ): SystemIssues {
    const stalledProjects = projects.filter((p) => p.nextActions.length === 0).length;

    const inboxCount = gtdContext.inboxItems.length;
    const inboxNeedsAttention = inboxCount > inboxThreshold;

    return {
      stalledProjects,
      inboxCount,
      inboxNeedsAttention,
      hasIssues: stalledProjects > 0 || inboxNeedsAttention,
    };
  }
}
```

**Detection logic:**

- Count projects where `nextActions.length === 0` (stalled projects)
- Check inbox count against configurable threshold
- Set `hasIssues = true` if any issue detected

### 2. Opening Message Flow

**Location**: `runREPL()` in `cli.tsx`, after system message added (currently line ~294)

**Modified flow:**

```typescript
// Current: After system message push (line 294)
messages.push({
  role: "system",
  content: systemPrompt,
});

// NEW: Auto-send opening analysis
const issues = SystemAnalyzer.analyze(gtdContext, projects);
const analysisPrompt = buildAnalysisPrompt(issues);

messages.push({
  role: "user",
  content: analysisPrompt,
});

// Show thinking indicator
process.stdout.write(`${colors.dim}Processing...${colors.reset}`);

// Get AI's formatted opening
const openingResponse = await languageModelClient.sendMessage({
  model,
  maxTokens: 500,
  messages,
});

// Clear thinking indicator and display opening
process.stdout.write("\r");
if (typeof process.stdout.clearLine === "function") {
  process.stdout.clearLine(0);
}

console.log(`${colors.assistant}Coach:${colors.reset}\n${wrapForTerminal(openingResponse)}\n`);

messages.push({ role: "assistant", content: openingResponse });

// THEN: Enter normal REPL loop
while (true) {
  // ... existing REPL code
}
```

**Helper function:**

```typescript
function buildAnalysisPrompt(issues: SystemIssues): string {
  let prompt = "Based on the system context you have, provide a brief opening summary.\n\n";

  if (issues.hasIssues) {
    prompt += "Issues detected:\n";
    if (issues.stalledProjects > 0) {
      prompt += `- ${issues.stalledProjects} projects have no next actions (stalled)\n`;
    }
    if (issues.inboxNeedsAttention) {
      prompt += `- ${issues.inboxCount} inbox items need processing\n`;
    }
    prompt +=
      "\nProvide a brief summary of these issues and suggest 3 numbered options to address them.\n";
  } else {
    prompt += "The system looks healthy - no stalled projects, inbox is under control.\n\n";
    prompt +=
      "Provide a brief positive summary and suggest 3 numbered options for proactive work.\n";
  }

  prompt += "\nFormat: Brief observation paragraph, then numbered list of 3 options.\n";
  prompt += "Keep it concise. High-level counts only, no specific project names or examples.";

  return prompt;
}
```

### 3. System Prompt Enhancement

Add to system prompt (in `buildSystemPrompt()`) to guide opening message format:

```typescript
// Add after "Communication Style:" section (around line 119)
prompt += `Opening Message Format:\n`;
prompt += `- When asked to provide an opening summary, be brief and data-driven\n`;
prompt += `- State what you observe (e.g., "5 projects are stalled")\n`;
prompt += `- Always provide exactly 3 numbered options for what to work on\n`;
prompt += `- Use high-level counts only, never list specific project names in the opening\n`;
prompt += `- If system is healthy, note this positively and suggest proactive actions\n\n`;
```

### 4. Expected Output Examples

**With issues:**

```
Flow - work sphere
  33 projects
  68 next actions
  22 someday items
  12 inbox items

Processing...

Coach:
I've scanned your work sphere. Here's what I found:

• 5 projects have no next actions (stalled)
• 12 inbox items need processing

I can help with:
1. Processing inbox items
2. Reviewing stalled projects to add next actions
3. Prioritizing current work

> _
```

**No issues:**

```
Flow - work sphere
  33 projects
  68 next actions
  22 someday items
  3 inbox items

Processing...

Coach:
System looks healthy. 5 priority 1 projects are active with clear next actions.

I can help with:
1. Prioritizing what to work on next
2. Reviewing specific projects in detail
3. Planning for the week ahead

> _
```

## Implementation Tasks

1. **Create system analyzer** (`src/system-analyzer.ts`)
   - Define `SystemIssues` interface
   - Implement `SystemAnalyzer.analyze()` method
   - Export for use in CLI

2. **Modify REPL startup** (`src/cli.tsx`)
   - Import `SystemAnalyzer`
   - Add `buildAnalysisPrompt()` helper function
   - Call analyzer after system message push
   - Send analysis prompt and display response
   - Update flow before entering REPL loop

3. **Update system prompt** (`buildSystemPrompt()` in `cli.tsx`)
   - Add "Opening Message Format" section
   - Guide AI on format and content expectations

4. **Add tests** (`tests/system-analyzer.test.ts`)
   - Test stalled project detection
   - Test inbox threshold logic
   - Test `hasIssues` flag combinations
   - Test edge cases (no projects, empty inbox, etc.)

5. **Configuration** (future)
   - Make inbox threshold configurable in plugin settings
   - Currently hardcoded default of 5 items

## Design Decisions

### Why hybrid approach vs pure prompt-based?

**Considered alternatives:**

1. **Pure prompt**: Add detection instructions to system prompt, let AI find issues
   - ❌ Uses tokens on every conversation turn
   - ❌ Inconsistent between models
   - ❌ Can't easily test detection logic

2. **Pure TypeScript**: Detect issues AND format message in code
   - ❌ Rigid formatting, not conversational
   - ❌ Hard to maintain natural language
   - ✅ Consistent, testable

3. **Hybrid** (chosen): TypeScript detects, AI formats
   - ✅ Consistent detection (testable)
   - ✅ Natural formatting
   - ✅ One extra API call at startup (acceptable cost)
   - ✅ Clear separation of concerns

### Why auto-send vs wait for user?

**Current behaviour**: Show stats, wait for user to ask first question

**New behaviour**: Show stats, automatically provide opening summary

**Rationale**:

- User's communication style guide says "no open-ended questions"
- Stating observations is not asking a question
- Provides immediate value (user doesn't need to ask "what should I work on?")
- Options list gives clear starting points without being prescriptive

### Why limit to stalled projects + inbox?

**Initially considered:**

- Action quality detection (vague actions, missing verbs)
- Priority mismatches (P1 with no actions, P3 with many)

**Decided to skip for MVP:**

- Action quality needs LLM analysis (expensive, slow at startup)
- Heuristics have too many false positives
- Stalled projects + inbox are clear, objective metrics
- Can add more detection types later if needed

## Future Enhancements

**Not included in initial implementation:**

1. **Action quality detection**
   - Use LLM to analyze action quality
   - Requires additional API calls or batch analysis
   - Higher value than heuristics, but slower

2. **Priority mismatch detection**
   - Flag P1 projects with no actions
   - Flag P3 projects with many actions
   - Simple heuristic, good candidate for next iteration

3. **Configurable detection rules**
   - Allow user to enable/disable specific checks
   - Adjust thresholds per user preference
   - Add to plugin settings

4. **Weekly review mode**
   - Different opening for weekly review context
   - More comprehensive analysis
   - Could be separate CLI flag: `--mode=weekly-review`

## Testing Strategy

**Unit tests** (`system-analyzer.test.ts`):

- Stalled project detection with various project states
- Inbox threshold logic (boundary cases: 4, 5, 6 items)
- `hasIssues` flag combinations
- Edge cases: no projects, empty inbox, all projects stalled

**Integration tests** (manual for now):

- Run CLI with vault in different states
- Verify opening message format matches examples
- Check that REPL continues normally after opening
- Test with both Anthropic and OpenAI-compatible providers

**Acceptance criteria:**

- Opening message appears automatically after stats
- Issues are detected correctly
- Message format matches design examples
- User can immediately start typing questions after opening
- No regression in normal REPL behaviour
