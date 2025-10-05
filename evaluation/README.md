# GTD Coach Evaluation Framework

This directory contains a comprehensive evaluation framework for testing the quality and accuracy of the GTD Coach's AI processing.

## Overview

The evaluation framework tests the GTD processor against a curated set of test cases, measuring:

- **Category Accuracy**: Does it correctly identify projects vs. next actions vs. reference items?
- **Action Quality**: Are next actions well-formed according to GTD principles?
- **Specificity**: Are actions specific enough to be actionable?
- **Verb Usage**: Do actions start with clear action verbs?
- **Outcome Clarity**: Are project outcomes clearly defined?

## Quick Start

### Running the Evaluation

```bash
# With API key from environment
export ANTHROPIC_API_KEY=your-key-here
npm run evaluate

# Or pass API key directly
npm run evaluate sk-ant-your-key-here
```

### Understanding Results

The evaluation will:
1. Process all 15 test cases through the GTD processor
2. Score each result against expected criteria
3. Generate a detailed report
4. Save results to `evaluation/results/`

Example output:
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
```

## Test Cases

### Categories Tested

The test suite includes examples of:

1. **Simple Next Actions** (`simple-next-action-1`)
   - Single, clear actions
   - Should enhance with specificity

2. **Simple Projects** (`simple-project-1`)
   - Multi-step outcomes
   - Require planning and future actions

3. **Reference Items** (`reference-1`)
   - Information to store
   - Not actionable

4. **Someday/Maybe** (`someday-1`)
   - Future aspirations
   - Not currently committed

5. **Disguised Projects** (`project-disguised-as-action-1`)
   - Look simple but need multiple steps
   - Common misidentifications

6. **Vague Actions** (`vague-action-1`)
   - Need clarification
   - Should be improved by AI

7. **Complex Projects** (`complex-project-1`)
   - Large, multi-phase projects
   - Should have comprehensive future actions

8. **Well-Formed Actions** (`specific-action-1`)
   - Already GTD-compliant
   - Test that AI doesn't over-process

## Scoring System

### Overall Score (100 points)

- **Category Correctness**: 40 points
- **Action Quality**: 25 points
- **Specificity**: 15 points
- **Verb Usage**: 10 points
- **Outcome Clarity** (projects only): 10 points

### Action Quality Breakdown

Actions are evaluated on:
- ✓ Appropriate length (15-150 characters)
- ✓ Starts with action verb
- ✓ Contains specific details (names, times, numbers)
- ✓ Avoids vague terms ("something", "maybe", "stuff")
- ✓ Sufficient specificity

### Specificity Scoring

Actions receive bonus points for:
- Names of people or places
- Specific times/dates
- Contact information
- Quantities or measurements

### Project Outcome Evaluation

Project outcomes are scored on:
- ✓ Stated as completed outcome (past tense)
- ✓ Clear and specific
- ✓ Measurable/definable

## Metrics Explained

### Category Accuracy
Percentage of test cases where the AI correctly identified the type (project/next-action/reference/someday).

**Target**: > 90%

### Action Quality Score
Average quality score of all generated next actions, measuring GTD compliance.

**Target**: > 80%

### Specificity Score
How specific and actionable the next actions are.

**Target**: > 75%

## Adding New Test Cases

Edit `evaluation/test-cases.json`:

```json
{
  "id": "unique-test-id",
  "input": "your inbox item",
  "expectedCategory": "project|next-action|reference|someday",
  "expectedAttributes": {
    "isActionable": true,
    "startsWithVerb": true,
    "hasOutcome": true
  },
  "notes": "Why this test case matters"
}
```

### Available Expected Attributes

- `isActionable`: Should this item be actionable?
- `startsWithVerb`: Should action start with verb?
- `isSpecific`: Should action be specific?
- `hasContext`: Should include context (where/when)?
- `hasOutcome`: (Projects) Should have clear outcome?
- `hasFutureActions`: (Projects) Should have future actions?
- `needsClarification`: Is this intentionally vague?
- `isQuickAction`: Is this a 2-minute task?
- `isWaitingFor`: Is this a waiting-for item?
- `isRecurring`: Is this recurring?

## Understanding Results

### Test Result Structure

```typescript
{
  "testCaseId": "simple-next-action-1",
  "input": "call dentist",
  "passed": true,
  "score": 87.5,
  "metrics": {
    "categoryCorrect": true,
    "actionQuality": 0.85,
    "specificityScore": 0.75,
    "verbUsage": true
  },
  "output": {
    "category": "next-action",
    "nextAction": "Call dentist's office to schedule annual checkup"
  },
  "errors": [],
  "warnings": ["Action could include specific contact details"]
}
```

### Pass/Fail Criteria

A test **passes** if:
- Category is correctly identified
- No critical errors occurred

A test can pass but still have warnings for improvement opportunities.

### Common Warnings

- "Next action does not start with an action verb"
- "Next action lacks specificity"
- "Project outcome could be clearer"
- "Project should include future actions"

## Continuous Improvement

### Baseline Tracking

Results are saved with timestamps to track improvements over time:

```bash
evaluation/results/
├── evaluation-2025-10-05T20-15-30.json
├── evaluation-2025-10-06T14-22-11.json
└── evaluation-2025-10-07T09-05-42.json
```

### Regression Testing

Run evaluation after:
- Prompt engineering changes
- Model updates
- Logic modifications

Compare scores to ensure quality doesn't regress.

### Benchmarking

Track key metrics:
```bash
# Compare two evaluation runs
diff evaluation/results/evaluation-*.json
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/evaluate.yml
- name: Run GTD Evaluation
  run: npm run evaluate
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The evaluation exits with code 1 if pass rate < 80%.

## Advanced Usage

### Custom Thresholds

Edit `run-evaluation.ts` to adjust passing criteria:

```typescript
const passRate = (summary.passed / summary.totalTests) * 100;
if (passRate < 90) {  // Increase from 80 to 90
  process.exit(1);
}
```

### Filtering Test Cases

Run specific tests:

```typescript
// In evaluator.ts
const testCases = require('./test-cases.json')
  .filter(tc => tc.id.startsWith('project-'));
```

### Custom Metrics

Add your own scoring criteria in `evaluator.ts`:

```typescript
private evaluateMyMetric(action: string): number {
  // Your custom logic
  return score;
}
```

## Troubleshooting

### "API key required" Error
Ensure you've set `ANTHROPIC_API_KEY` or passed it as an argument.

### Tests Timing Out
The evaluation makes 15 API calls. With rate limits, this may take 1-2 minutes.

### Low Scores
- Check if test cases align with your expectations
- Review prompt engineering in `gtd-processor.ts`
- Consider if the model needs different instructions

## Best Practices

1. **Run regularly**: After any prompt changes
2. **Track trends**: Compare results over time
3. **Add edge cases**: When you find issues in production
4. **Review failures**: Understand why tests failed
5. **Update expectations**: As your GTD standards evolve

## Future Enhancements

Potential additions:
- [ ] Project suggestion accuracy metrics
- [ ] Future action completeness scoring
- [ ] Context appropriateness evaluation
- [ ] Benchmark against human GTD coaches
- [ ] A/B testing different prompts
- [ ] Performance timing metrics
