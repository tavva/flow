import { GTDProcessor } from "../src/gtd-processor";
import { GTDProcessingResult, DEFAULT_SETTINGS } from "../src/types";
import { getAnthropicClient } from "../src/anthropic-client";
const testCases = require("./test-cases.json");

interface TestCase {
  id: string;
  input: string;
  expectedCategory: string;
  expectedAttributes: Record<string, any>;
  notes: string;
}

interface EvaluationResult {
  testCaseId: string;
  input: string;
  passed: boolean;
  score: number;
  metrics: {
    categoryCorrect: boolean;
    actionQuality: number;
    specificityScore: number;
    verbUsage: boolean;
    outcomeClarity?: number;
  };
  output: GTDProcessingResult;
  errors: string[];
  warnings: string[];
}

interface EvaluationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  averageScore: number;
  categoryAccuracy: number;
  actionQualityScore: number;
  results: EvaluationResult[];
}

export class GTDEvaluator {
  private processor: GTDProcessor;

  constructor(apiKey: string, model: string = DEFAULT_SETTINGS.anthropicModel) {
    this.processor = new GTDProcessor(getAnthropicClient(apiKey), DEFAULT_SETTINGS.spheres, model);
  }

  /**
   * Run evaluation on all test cases
   */
  async evaluateAll(): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];

    for (const testCase of testCases as TestCase[]) {
      const result = await this.evaluateTestCase(testCase);
      results.push(result);
    }

    return this.summarizeResults(results);
  }

  /**
   * Evaluate a single test case
   */
  async evaluateTestCase(testCase: TestCase): Promise<EvaluationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Process the inbox item
      const output = await this.processor.processInboxItem(testCase.input, []);

      // Check category correctness
      const categoryCorrect = output.category === testCase.expectedCategory;
      if (!categoryCorrect) {
        errors.push(
          `Category mismatch: expected '${testCase.expectedCategory}', got '${output.category}'`
        );
      }

      // Evaluate action quality (only for actionable items)
      let actionQuality = 0;
      let verbUsage = false;
      let specificityScore = 0;

      if (output.isActionable && output.nextAction) {
        actionQuality = this.evaluateActionQuality(output.nextAction);

        // Check if starts with verb
        verbUsage = this.startsWithActionVerb(output.nextAction);
        if (testCase.expectedAttributes.startsWithVerb && !verbUsage) {
          warnings.push("Next action does not start with an action verb");
        }

        // Evaluate specificity
        specificityScore = this.evaluateSpecificity(output.nextAction);
        if (testCase.expectedAttributes.isSpecific && specificityScore < 0.7) {
          warnings.push("Next action lacks specificity");
        }
      } else if (!output.isActionable) {
        // For non-actionable items, we don't evaluate action quality
        actionQuality = 1; // Full score since no action is expected
        verbUsage = true; // N/A for non-actionable
        specificityScore = 1; // N/A for non-actionable
      } else if (output.isActionable && !output.nextAction) {
        // Actionable item missing nextAction - this should be caught by validation
        warnings.push("Actionable item is missing nextAction");
      }

      // Check project-specific attributes
      let outcomeClarity: number | undefined;

      if (testCase.expectedCategory === "project") {
        if (!output.projectOutcome) {
          errors.push("Project missing outcome definition");
          outcomeClarity = 0;
        } else {
          outcomeClarity = this.evaluateOutcomeClarity(output.projectOutcome);
          if (outcomeClarity < 0.7) {
            warnings.push("Project outcome could be clearer");
          }
        }
      }

      // Calculate overall score
      const score = this.calculateScore({
        categoryCorrect,
        actionQuality,
        specificityScore,
        verbUsage,
        outcomeClarity,
        testCase,
      });

      return {
        testCaseId: testCase.id,
        input: testCase.input,
        passed: categoryCorrect && errors.length === 0,
        score,
        metrics: {
          categoryCorrect,
          actionQuality,
          specificityScore,
          verbUsage,
          outcomeClarity,
        },
        output,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        input: testCase.input,
        passed: false,
        score: 0,
        metrics: {
          categoryCorrect: false,
          actionQuality: 0,
          specificityScore: 0,
          verbUsage: false,
        },
        output: {} as GTDProcessingResult,
        errors: [`Processing error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Evaluate the quality of a next action
   */
  private evaluateActionQuality(action: string): number {
    let score = 0;

    // Length check (not too short, not too long)
    if (action.length >= 15 && action.length <= 150) score += 0.2;
    else if (action.length < 10) score -= 0.1;

    // Starts with verb
    if (this.startsWithActionVerb(action)) score += 0.3;

    // Has specific details (numbers, names, times)
    if (/\d+|@|[A-Z][a-z]+|(?:am|pm|Monday|Tuesday|Wednesday|Thursday|Friday)/i.test(action)) {
      score += 0.2;
    }

    // Doesn't have vague terms
    const vagueTerms = ["something", "stuff", "things", "maybe", "possibly", "think about"];
    const hasVagueTerms = vagueTerms.some((term) => action.toLowerCase().includes(term));
    if (!hasVagueTerms) score += 0.2;

    // Is specific enough
    if (this.evaluateSpecificity(action) > 0.7) score += 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Check if action starts with an action verb
   */
  private startsWithActionVerb(action: string): boolean {
    const actionVerbs = [
      "call",
      "email",
      "write",
      "review",
      "research",
      "schedule",
      "book",
      "buy",
      "order",
      "create",
      "update",
      "fix",
      "test",
      "send",
      "meet",
      "discuss",
      "plan",
      "analyse",
      "analyze",
      "prepare",
      "organise",
      "organize",
      "draft",
      "contact",
      "confirm",
      "check",
      "complete",
      "finish",
      "start",
      "reply",
      "respond",
      "follow",
      "ask",
      "request",
      "submit",
      "download",
      "upload",
      "install",
      "configure",
      "set",
      "read",
      "watch",
      "listen",
    ];

    const firstWord = action.toLowerCase().split(/\s+/)[0];
    return actionVerbs.includes(firstWord);
  }

  /**
   * Evaluate specificity of an action
   */
  private evaluateSpecificity(text: string): number {
    let score = 0.5; // Base score

    // Has specific people/names
    if (/[A-Z][a-z]+ (?:[A-Z][a-z]+)?/.test(text)) score += 0.15;

    // Has times/dates
    if (
      /\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(
        text
      )
    ) {
      score += 0.15;
    }

    // Has numbers/quantities
    if (/\d+/.test(text)) score += 0.1;

    // Has contact info
    if (/@|phone|email/i.test(text)) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Evaluate clarity of project outcome
   */
  private evaluateOutcomeClarity(outcome: string): number {
    let score = 0.5;

    // Is stated as an outcome (past tense or "complete")
    if (/(complete|finished|done|ready|ed\b)/i.test(outcome)) score += 0.2;

    // Is specific
    score += this.evaluateSpecificity(outcome) * 0.3;

    return Math.min(score, 1);
  }

  /**
   * Calculate overall score for a test case
   */
  private calculateScore(params: {
    categoryCorrect: boolean;
    actionQuality: number;
    specificityScore: number;
    verbUsage: boolean;
    outcomeClarity?: number;
    testCase: TestCase;
  }): number {
    let score = 0;
    let maxScore = 0;

    // Category correctness (40 points)
    maxScore += 40;
    if (params.categoryCorrect) score += 40;

    // Action quality (25 points)
    maxScore += 25;
    score += params.actionQuality * 25;

    // Specificity (15 points)
    maxScore += 15;
    score += params.specificityScore * 15;

    // Verb usage (10 points)
    maxScore += 10;
    if (params.verbUsage) score += 10;

    // Project-specific criteria
    if (params.testCase.expectedCategory === "project") {
      // Outcome clarity (10 points)
      maxScore += 10;
      if (params.outcomeClarity) score += params.outcomeClarity * 10;
    }

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  /**
   * Summarize evaluation results
   */
  private summarizeResults(results: EvaluationResult[]): EvaluationSummary {
    const totalTests = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = totalTests - passed;

    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalTests;

    const categoryCorrect = results.filter((r) => r.metrics.categoryCorrect).length;
    const categoryAccuracy = (categoryCorrect / totalTests) * 100;

    const actionQualityScore =
      (results.reduce((sum, r) => sum + r.metrics.actionQuality, 0) / totalTests) * 100;

    return {
      totalTests,
      passed,
      failed,
      averageScore,
      categoryAccuracy,
      actionQualityScore,
      results,
    };
  }

  /**
   * Format evaluation summary as text
   */
  formatSummary(summary: EvaluationSummary): string {
    let output = "\n";
    output += "═══════════════════════════════════════════════════════════\n";
    output += "              GTD COACH EVALUATION RESULTS                 \n";
    output += "═══════════════════════════════════════════════════════════\n\n";

    output += `Total Test Cases: ${summary.totalTests}\n`;
    output += `Passed: ${summary.passed} (${((summary.passed / summary.totalTests) * 100).toFixed(1)}%)\n`;
    output += `Failed: ${summary.failed} (${((summary.failed / summary.totalTests) * 100).toFixed(1)}%)\n\n`;

    output += `Overall Metrics:\n`;
    output += `  Average Score:        ${summary.averageScore.toFixed(1)}%\n`;
    output += `  Category Accuracy:    ${summary.categoryAccuracy.toFixed(1)}%\n`;
    output += `  Action Quality Score: ${summary.actionQualityScore.toFixed(1)}%\n\n`;

    output += "───────────────────────────────────────────────────────────\n";
    output += "Detailed Results:\n";
    output += "───────────────────────────────────────────────────────────\n\n";

    for (const result of summary.results) {
      const status = result.passed ? "✓ PASS" : "✗ FAIL";
      const statusColor = result.passed ? status : status;

      output += `${statusColor} [${result.score.toFixed(1)}%] ${result.testCaseId}\n`;
      output += `  Input: "${result.input}"\n`;
      output += `  Category: ${result.output.category || "N/A"} (${result.metrics.categoryCorrect ? "✓" : "✗"})\n`;
      output += `  Action: "${result.output.nextAction || "N/A"}"\n`;

      if (result.output.projectOutcome) {
        output += `  Outcome: "${result.output.projectOutcome}"\n`;
      }

      output += `  Metrics:\n`;
      output += `    Action Quality:  ${(result.metrics.actionQuality * 100).toFixed(1)}%\n`;
      output += `    Specificity:     ${(result.metrics.specificityScore * 100).toFixed(1)}%\n`;
      output += `    Verb Usage:      ${result.metrics.verbUsage ? "✓" : "✗"}\n`;

      if (result.metrics.outcomeClarity !== undefined) {
        output += `    Outcome Clarity: ${(result.metrics.outcomeClarity * 100).toFixed(1)}%\n`;
      }

      if (result.errors.length > 0) {
        output += `  Errors:\n`;
        result.errors.forEach((err) => (output += `    • ${err}\n`));
      }

      if (result.warnings.length > 0) {
        output += `  Warnings:\n`;
        result.warnings.forEach((warn) => (output += `    • ${warn}\n`));
      }

      output += "\n";
    }

    return output;
  }
}
