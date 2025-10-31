# Custom Review Routines Design

**Date:** 2025-10-31
**Status:** Approved

## Overview

Allow users to define custom review routines in editable text files, replacing the hardcoded weekly review protocol in the CLI. Users can create multiple review routines (e.g., Friday afternoon personal review, Monday morning work review) that automatically suggest themselves at appropriate times.

## Problem Statement

The current CLI has a hardcoded weekly review protocol that works for a general GTD workflow, but doesn't accommodate different review styles or schedules. Ben's review process is split across Friday afternoon (personal focus) and Monday commute (work focus), which the current single protocol can't support.

Users must be able to:

- Define their own review structure and steps
- Schedule reviews for specific days and times
- Create multiple review routines for different purposes
- Edit their review process without changing code

## User Experience

### Creating a Review

1. Create a markdown file in `{vault}/.flow/reviews/`
2. Add YAML frontmatter specifying when it should trigger
3. Write free-form markdown describing the review steps

Example file: `{vault}/.flow/reviews/friday-afternoon.md`

```markdown
---
trigger:
  day: friday
  time: afternoon
spheres:
  - work
  - personal
---

# Friday Afternoon Weekly Review (1 hour)

Part 1: Close Work Week (15-20 min)

Quick Capture & Empty

- Collect any loose work notes, emails, Slack messages into work inbox
- Empty work inbox in Flow (just capture, don't process)
- Quick scan: did I complete anything this week that isn't marked done?

Review & Release

- Review past week calendar - capture any open loops or follow-ups
- Check waiting-for list - does anything need a nudge Monday?
- Brain dump: what's on my mind about work? (capture to work inbox for Monday)
- Log any wins from the week

Part 2: Full Personal Review (40-45 min)

Get Clear

- Collect loose items (personal emails, notes, random captures) into personal inbox
- Process personal inbox to zero
- Empty head - brain dump anything rattling around

Get Current

- Review past week personal calendar - any loose ends?
- Review upcoming personal calendar (next 2-4 weeks) - anything need preparation?
- Review all personal projects (~30 projects):
  - Is status current?
  - Does each have a clear next action?
  - Anything to move to someday/maybe or complete?
- Review personal next actions list - still relevant and actionable?
- Review personal waiting-for list - need to follow up on anything?

Get Creative

- Review someday/maybe list - anything ready to activate?
- Any new personal projects or ideas to capture?
- Reflect: what went well this week? What could improve?
```

### Using a Review

**Automatic suggestion:**

When user starts CLI on Friday afternoon:

```
$ npm run cli -- --vault ~/notes

I found these reviews for Friday afternoon:
1. Friday Afternoon Weekly Review

Would you like to run one? (type number, name, or 'no')
```

**Manual invocation:**

User can always request a review by name:

```
> Run my Friday review
> Do the weekly review
```

**During the review:**

1. CLI displays the full review text
2. AI guides user through the review conversationally
3. AI uses available tools (move_to_focus, create_project, etc.) to help with each step
4. User can ask questions, skip sections, or deviate from the structure
5. When complete, AI displays: "✓ Friday Afternoon Weekly Review complete. You can end the session or continue with additional coaching."

## Technical Design

### File Structure

**Review files location:** `{vault}/.flow/reviews/*.md`

Each file contains:

- YAML frontmatter (optional) with trigger and sphere configuration
- Markdown body with free-form review instructions

### Data Model

```typescript
interface ReviewProtocol {
  filename: string; // e.g., "friday-afternoon.md"
  name: string; // Extracted from first H1, fallback to filename
  trigger?: {
    day?: string; // monday, tuesday, wednesday, thursday, friday, saturday, sunday
    time?: string; // morning, afternoon, evening
  };
  spheres?: string[]; // e.g., ["work", "personal"]
  content: string; // Full markdown body (without frontmatter)
}
```

**Time period definitions:**

- morning: 05:00-11:59
- afternoon: 12:00-17:59
- evening: 18:00-04:59 (crosses midnight)

### Components

#### 1. Protocol Scanner (`src/protocol-scanner.ts`)

Responsibilities:

- Check if `{vault}/.flow/reviews/` exists
- Find all `.md` files in the directory
- Parse YAML frontmatter using `gray-matter` or similar
- Extract review name from first H1 heading
- Return array of `ReviewProtocol` objects

Error handling:

- Missing directory → return empty array
- Invalid YAML → log warning, skip that file
- No H1 heading → use filename as name
- Empty body → skip that file

#### 2. Protocol Matcher (`src/protocol-matcher.ts`)

Responsibilities:

- Take current date/time and array of protocols
- Match protocols with triggers for current day/time
- Return matched protocols

Logic:

- Compare current day of week against `trigger.day`
- Compare current time against `trigger.time` period
- Protocols without triggers never auto-match (but can be manually invoked)
- Return all matches (multiple matches possible)

#### 3. CLI Integration (`src/cli.tsx` modifications)

**On startup:**

1. Scan for review files using protocol scanner
2. Match against current day/time using protocol matcher
3. If matches found, display numbered list and prompt user
4. If no matches, proceed with normal CLI startup

**When review selected:**

1. Display full review content to user
2. Append review content to system prompt with instruction: "Guide the user through this review. Follow the structure and steps outlined. Be conversational and adaptive - accept questions, allow skipping steps, and use available tools to help with each section."
3. Load GTD data for spheres specified in `protocol.spheres` (or all spheres if not specified)
4. Begin coaching session

**During session:**

- AI follows review structure
- AI can use existing CLI tools
- User can deviate, ask questions, skip sections

**On completion:**

- AI detects when all review steps are complete
- Display: "✓ {Review Name} complete. You can end the session or continue with additional coaching."
- Wait for user response
- Continue with normal coaching if user doesn't exit

### Sphere Handling

**Loading data:**

- If protocol has `spheres` field: load only those spheres
- If protocol has no `spheres` field: load all spheres (safest default)
- If `--sphere` CLI flag provided: override protocol and load only that sphere

**During review:**

- Protocol content can reference specific spheres (e.g., "Review work projects", "Process personal inbox")
- AI understands context from protocol text
- All loaded sphere data is available for AI to reference

### Error Handling

| Scenario                                | Behaviour                                         |
| --------------------------------------- | ------------------------------------------------- |
| `.flow/reviews/` doesn't exist          | Skip protocol features, CLI works normally        |
| Invalid YAML frontmatter                | Log warning, skip that file, continue with others |
| No H1 heading in protocol               | Use filename as protocol name                     |
| Empty protocol body                     | Skip that file                                    |
| No protocols match current time         | No auto-suggestion, normal CLI startup            |
| Multiple protocols match                | Show numbered list, let user choose               |
| User types non-existent protocol name   | Show available protocols                          |
| Protocol references non-existent sphere | AI mentions it but continues                      |
| User stops protocol mid-way             | AI switches to normal coaching mode               |

### Backwards Compatibility

- If no protocols exist, CLI behaves exactly as today
- Existing hardcoded weekly review still available via manual request
- `--sphere` flag continues to work as before
- No breaking changes to CLI interface

## Testing Strategy

### Unit Tests

**`tests/protocol-scanner.test.ts`:**

- ✓ Scans folder and finds .md files
- ✓ Parses YAML frontmatter correctly
- ✓ Handles missing frontmatter gracefully
- ✓ Extracts protocol name from H1 heading
- ✓ Falls back to filename if no H1
- ✓ Handles missing `.flow/reviews/` folder
- ✓ Skips files with invalid YAML
- ✓ Skips files with empty body

**`tests/protocol-matcher.test.ts`:**

- ✓ Matches protocols by day and time correctly
- ✓ Handles morning/afternoon/evening time periods
- ✓ Handles evening crossing midnight boundary
- ✓ Returns empty array when no matches
- ✓ Returns multiple matches when appropriate
- ✓ Handles protocols without triggers

**`tests/cli-protocol-integration.test.ts`:**

- ✓ CLI suggests matched protocols on startup
- ✓ User can select protocol from list
- ✓ Protocol content added to system prompt
- ✓ Loads spheres specified in protocol
- ✓ Falls back to all spheres if no spheres specified
- ✓ Protocol completion message displayed
- ✓ User can continue after completion
- ✓ Manual protocol invocation works
- ✓ `--sphere` flag overrides protocol spheres

### Manual Testing Scenarios

1. Create `.flow/reviews/friday-afternoon.md` with example content
2. Run CLI on Friday afternoon at 3pm, verify auto-suggestion
3. Select the review, verify full content displayed
4. Work through review, verify AI follows structure
5. Verify completion message at end
6. Test manual invocation: "run my Friday review"
7. Test on wrong day/time - verify no auto-suggestion
8. Test with multiple matching protocols
9. Test protocol with no spheres field
10. Test `--sphere` flag override

## Implementation Plan

1. Create `src/protocol-scanner.ts` with tests
2. Create `src/protocol-matcher.ts` with tests
3. Add `ReviewProtocol` interface to `src/types.ts`
4. Modify `src/cli.tsx` to integrate protocols
5. Add CLI integration tests
6. Update `docs/gtd-coach-cli.md` with review documentation
7. Create example review files for documentation

## Open Questions

None - design is approved and ready for implementation.

## Future Enhancements (out of scope)

- Review history tracking (when reviews were completed)
- Review reminders/notifications outside CLI
- Review templates/examples built into plugin
- Shared review routines (community library)
- Multiple trigger times per review
- Natural language trigger expressions ("every Friday" vs explicit day/time)
