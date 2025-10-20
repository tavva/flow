#!/usr/bin/env ts-node

import { GTDEvaluator } from "./evaluator";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get API key from environment or command line
  const apiKey = process.env.ANTHROPIC_API_KEY || process.argv[2];

  if (!apiKey) {
    console.error("Error: Anthropic API key required");
    console.error("Usage: npm run evaluate <api-key>");
    console.error("   or: ANTHROPIC_API_KEY=<key> npm run evaluate");
    process.exit(1);
  }

  console.log("Starting GTD Coach Evaluation...\n");
  console.log("This will test the AI against 15 test cases.");
  console.log("Each test evaluates category accuracy, action quality, and GTD principles.\n");

  const evaluator = new GTDEvaluator(apiKey);

  try {
    const summary = await evaluator.evaluateAll();

    // Print results to console
    const formattedOutput = evaluator.formatSummary(summary);
    console.log(formattedOutput);

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outputDir = path.join(__dirname, "results");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `evaluation-${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\nDetailed results saved to: ${outputPath}\n`);

    // Exit with appropriate code
    const passRate = (summary.passed / summary.totalTests) * 100;
    if (passRate < 80) {
      console.log("⚠️  Warning: Pass rate below 80%");
      process.exit(1);
    } else {
      console.log("✓ Evaluation passed!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Evaluation failed:", error.message);
    process.exit(1);
  }
}

main();
