#!/usr/bin/env tsx
// ABOUTME: CLI script to run single test case from Python bridge
// ABOUTME: Loads test case JSON, executes conversation, outputs results as JSON

import { CoachTestRunner } from "./coach-test-runner";
import { CoachTestCase } from "./types";
import * as fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: ts-node run_test_case.ts <test-case-json>");
    process.exit(1);
  }

  const testCaseJson = args[0];
  const testCase: CoachTestCase = JSON.parse(testCaseJson);

  const runner = new CoachTestRunner();
  const result = await runner.runConversation(testCase);

  // Output result as JSON
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error("Error running test case:", error);
  process.exit(1);
});
