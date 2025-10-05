# Evaluation Framework Example

## Running Your First Evaluation

1. **Set your API key**:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

2. **Run the evaluation**:
```bash
npm run evaluate
```

3. **View the results**:
```
═══════════════════════════════════════════════════════════
              GTD COACH EVALUATION RESULTS
═══════════════════════════════════════════════════════════

Total Test Cases: 15
Passed: 13 (86.7%)
Failed: 2 (13.3%)

Overall Metrics:
  Average Score:        87.3%
  Category Accuracy:    93.3%
  Action Quality Score: 84.2%

───────────────────────────────────────────────────────────
Detailed Results:
───────────────────────────────────────────────────────────

✓ PASS [92.5%] simple-next-action-1
  Input: "call dentist"
  Category: next-action (✓)
  Action: "Call dentist's office to schedule annual check-up appointment"
  Metrics:
    Action Quality:  90.0%
    Specificity:     75.0%
    Verb Usage:      ✓

✓ PASS [95.0%] simple-project-1
  Input: "plan vacation to Italy"
  Category: project (✓)
  Action: "Research best time to visit Italy and check availability"
  Outcome: "Italy vacation fully planned and booked"
  Metrics:
    Action Quality:  85.0%
    Specificity:     80.0%
    Verb Usage:      ✓
    Outcome Clarity: 90.0%

✗ FAIL [65.0%] vague-action-1
  Input: "do something about the project"
  Category: next-action (✓)
  Action: "Review project status and identify next actionable step"
  Metrics:
    Action Quality:  60.0%
    Specificity:     50.0%
    Verb Usage:      ✓
  Warnings:
    • Next action lacks specificity
```

## Understanding a Test Result

Let's break down what each test shows:

### ✓ PASS: Well-Formed Action
```
✓ PASS [92.5%] simple-next-action-1
  Input: "call dentist"
  Category: next-action (✓)
  Action: "Call dentist's office to schedule annual check-up appointment"
```

**What happened:**
- AI correctly identified this as a simple next action (not a project)
- Enhanced vague "call dentist" with specificity
- Added context: "dentist's office", "schedule", "annual check-up"
- Started with action verb "Call"
- Score: 92.5% - excellent!

### ✓ PASS: Good Project
```
✓ PASS [95.0%] simple-project-1
  Input: "plan vacation to Italy"
  Category: project (✓)
  Action: "Research best time to visit Italy and check availability"
  Outcome: "Italy vacation fully planned and booked"
```

**What happened:**
- Correctly identified as multi-step project
- Clear outcome stated as completion: "vacation fully planned and booked"
- Good first action: research and checking
- Would also generate future actions (booking flights, hotels, etc.)
- Score: 95.0% - nearly perfect!

### ✗ FAIL: Needs Improvement
```
✗ FAIL [65.0%] vague-action-1
  Input: "do something about the project"
  Category: next-action (✓)
  Action: "Review project status and identify next actionable step"
  Warnings:
    • Next action lacks specificity
```

**What happened:**
- Correctly identified as actionable (not reference/someday)
- Tried to clarify vague input
- But result still not specific enough for GTD
- Doesn't say WHICH project
- "Review" and "identify" aren't concrete enough
- Score: 65.0% - room for improvement

**How to fix:** Could prompt user for clarification or suggest being more specific.

## Common Patterns

### Pattern 1: Simple → Specific

**Input:** "buy groceries"
**Output:** "Create shopping list and buy groceries at Tesco this afternoon"

The AI adds:
- ✓ Specific action (create list)
- ✓ Location context (Tesco)
- ✓ Time context (this afternoon)

### Pattern 2: Vague → Project

**Input:** "fix broken kitchen sink"
**Category:** project (correctly identified!)
**Outcome:** "Kitchen sink repaired and working properly"
**Next Action:** "Inspect sink to diagnose the problem and determine needed parts"

The AI recognises:
- ✓ Appears simple but needs multiple steps
- ✓ First step is diagnosis, not repair
- ✓ Future actions would include buying parts, doing repair

### Pattern 3: Already Good → Minimal Changes

**Input:** "Email Sarah at sarah@example.com to confirm Thursday meeting at 2pm"
**Output:** Same (or minor British English spelling adjustments)

The AI preserves:
- ✓ Already starts with verb
- ✓ Already specific
- ✓ Has all context needed
- Doesn't over-process well-formed actions

## Metrics Deep Dive

### Category Accuracy: 93.3%

This means:
- Out of 15 test cases, 14 were categorised correctly
- 1 was miscategorised (e.g., called a project when it's a simple action)
- **Goal:** > 90% ✓

### Action Quality: 84.2%

Average score measuring:
- Proper verb usage
- Appropriate length
- Specific details
- No vague terms
- **Goal:** > 80% ✓

### Specificity: 75.0%

How specific and actionable:
- Names, times, places included?
- Contact info present?
- Clear context?
- **Goal:** > 75% ✓

## What Makes a Good Score?

### Excellent (90-100%)
- Category spot-on
- Action clear and specific
- Follows all GTD principles
- Ready to execute

### Good (80-89%)
- Category correct
- Action mostly clear
- Minor improvements possible
- Generally usable

### Needs Work (70-79%)
- May have category issues
- Action needs more specificity
- Missing key GTD elements
- Requires editing

### Poor (<70%)
- Wrong category
- Vague or unclear action
- Not GTD-compliant
- Needs significant revision

## Using Results to Improve

### If Category Accuracy is Low

Update the prompt in `src/gtd-processor.ts`:
- Add more examples
- Clarify definitions
- Emphasise key distinctions

### If Action Quality is Low

Improve action generation:
- Require specific verbs
- Ask for context
- Push for details
- Avoid vague terms

### If Specificity is Low

Enhance prompts to request:
- Who, what, when, where
- Specific names/places
- Time commitments
- Contact information

## Next Steps

1. Run evaluation after any prompt changes
2. Compare results over time
3. Add new test cases for edge cases you discover
4. Track improvements in `evaluation/results/`
5. Aim for consistent 85%+ scores

## Questions?

See the full documentation in [`README.md`](README.md).
