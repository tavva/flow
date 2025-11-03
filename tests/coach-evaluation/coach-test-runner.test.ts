// ABOUTME: Tests for CoachTestRunner class that executes coach conversations for evaluation
// ABOUTME: Verifies single-turn conversations, message capture, and tool call tracking

import { CoachTestRunner } from "./coach-test-runner";
import { CoachTestCase } from "./types";

describe("CoachTestRunner", () => {
  const testFn = process.env.OPENROUTER_API_KEY ? it : it.skip;

  testFn(
    "runs single-turn conversation and captures tool calls",
    async () => {
      const testCase: CoachTestCase = {
        id: "test-1",
        description: "Test conversation",
        type: "single-turn",
        conversation: [
          {
            role: "user",
            content: "Test message",
          },
        ],
        vaultContext: {
          projects: [],
          nextActions: [],
          somedayItems: [],
        },
        expectations: {
          coachingQuality: {
            criteria: ["Helpful"],
            threshold: 0.7,
          },
        },
      };

      const runner = new CoachTestRunner();
      const result = await runner.runConversation(testCase);

      expect(result).toBeDefined();
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.toolCalls).toBeInstanceOf(Array);
    },
    30000
  );
});
