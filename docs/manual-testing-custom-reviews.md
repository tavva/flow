# Manual Testing: Custom Review Routines

## Setup

1. Create the reviews directory in your vault:

   ```bash
   mkdir -p /path/to/your/vault/.flow/reviews
   ```

2. Create test review protocol files (examples below)

3. Build the CLI:

   ```bash
   npm run build:cli
   ```

## Example Review Protocols

### Friday Afternoon Review (Personal)

Create `.flow/reviews/friday-afternoon.md`:

```markdown
---
trigger:
  day: friday
  time: afternoon
spheres:
  - personal
---

# Friday Afternoon Review

Time to wrap up the week and plan for the weekend.

## 1. Week Completion

Review what you accomplished this week in your personal sphere:
- What went well?
- What didn't get done?
- Any wins to celebrate?

## 2. Inbox Zero

Process all personal inbox items to zero.

## 3. Weekend Planning

Set intentions for the weekend:
- What do you want to accomplish?
- What do you want to rest and recharge?
- Any social commitments or family time?

## 4. Monday Prep

What can you prepare now to make Monday easier?
```

### Monday Morning Review (Work)

Create `.flow/reviews/monday-morning.md`:

```markdown
---
trigger:
  day: monday
  time: morning
---

# Monday Morning Review

Start the week with clarity and focus.

## 1. Weekly Goals

What are your top 3 goals for this week?

## 2. Calendar Review

Review your calendar for the week:
- Any conflicts?
- Any prep needed for meetings?
- Time blocked for deep work?

## 3. Project Check

Review active projects:
- Which need attention this week?
- Any stalled projects to restart or archive?

## 4. Set Focus

Choose 3-5 next actions to add to your focus for today.
```

### Weekly Review (Combined)

Create `.flow/reviews/weekly-review.md`:

```markdown
---
spheres:
  - work
  - personal
---

# Weekly Review

Complete GTD weekly review across all spheres.

## 1. Get Clear

Process all inboxes to zero.

## 2. Get Current

Review and update:
- All active projects
- Next actions lists
- Waiting for items
- Calendar for next 2 weeks

## 3. Get Creative

Review someday/maybe list:
- Anything ready to activate?
- Anything to prune?
- New ideas to capture?
```

## Test Scenarios

### Scenario 1: Automatic Protocol Suggestion

**Test**: Start CLI on Friday afternoon

```bash
./dist/cli.mjs --vault /path/to/vault --sphere personal
```

**Expected**:

- CLI shows: "I found these reviews for Friday afternoon:"
- Lists: "1. Friday Afternoon Review"
- Prompts: "Would you like to run one? (type number, name, or "no")"

**Try**:

- Type "1" → Should load Friday review
- Type "no" → Should skip and continue normally
- Type "friday" → Should match by name and load review

### Scenario 2: Manual Protocol Invocation

**Test**: During conversation, request a review

```bash
./dist/cli.mjs --vault /path/to/vault --sphere work
```

**In conversation, type**:

- "run weekly review" → Should load weekly review
- "start monday review" → Should load Monday review
- "friday review" → Should load Friday review

**Expected**:

- CLI shows: "Loading [Protocol Name]..."
- AI follows the protocol step-by-step
- AI waits for acknowledgment between sections

### Scenario 3: Sphere Switching

**Test**: Protocol with multiple spheres overrides --sphere argument

```bash
./dist/cli.mjs --vault /path/to/vault --sphere work
```

**Then select**: Weekly Review (which has `spheres: [work, personal]`)

**Expected**:

- CLI loads projects from BOTH work and personal spheres
- System prompt shows: "work, personal sphere" in header

### Scenario 4: Protocol Without Triggers

**Test**: Create protocol without trigger frontmatter

Create `.flow/reviews/quarterly-review.md`:

```markdown
# Quarterly Review

Review progress on long-term goals.
```

**Expected**:

- Does NOT auto-suggest at CLI startup
- CAN be invoked manually: "run quarterly review"

## Verification Checklist

- [ ] Auto-suggestion works for time-matched protocols
- [ ] Numbered selection (1, 2, 3) works
- [ ] Name selection ("friday", "weekly") works
- [ ] "no" skips protocol selection
- [ ] Manual invocation during conversation works
- [ ] Multiple invocation patterns work ("run X review", "start X review", "X review")
- [ ] Sphere filtering works when protocol specifies spheres
- [ ] AI follows protocol step-by-step
- [ ] AI waits for acknowledgment between sections
- [ ] Protocols without triggers don't auto-suggest but can be invoked manually

## Troubleshooting

**Protocol not found**:

- Check file is in `.flow/reviews/` directory
- Check file has `.md` extension
- Check YAML frontmatter is valid

**Wrong protocols suggested**:

- Check `trigger.day` matches current day (lowercase)
- Check `trigger.time` matches current time period
  - morning: 5am-12pm
  - afternoon: 12pm-6pm
  - evening: 6pm-5am

**AI not following protocol**:

- Check protocol content is loading (visible in "Loading..." message)
- Try being more explicit in protocol steps
- Make sure sections are clearly numbered or bulleted
