// ABOUTME: Runs coach conversations for evaluation tests with auto-approved tools
// ABOUTME: Executes test cases, captures messages and tool calls, mocks vault operations

import { MockVault } from "./mock-vault";
import { CoachTestCase, CoachResponse } from "./types";
import { LanguageModelClient, ToolCall } from "../../src/language-model";
import { COACH_TOOLS, createToolExecutor } from "../../src/coach-tools";
import { createLanguageModelClient } from "../../src/llm-factory";
import { DEFAULT_SETTINGS } from "../../src/types";

export class CoachTestRunner {
  private modelClient: LanguageModelClient;

  constructor() {
    // Use environment variable for test API key
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    const settings = {
      ...DEFAULT_SETTINGS,
      aiEnabled: true,
      llmProvider: "openai-compatible" as const,
      openaiApiKey: apiKey,
      openaiBaseUrl: "https://openrouter.ai/api/v1",
      openaiModel: "anthropic/claude-sonnet-4.5",
    };

    const client = createLanguageModelClient(settings);
    if (!client) {
      throw new Error("Failed to create language model client. Ensure OPENROUTER_API_KEY is set.");
    }
    this.modelClient = client;
  }

  async runConversation(testCase: CoachTestCase): Promise<CoachResponse> {
    const mockVault = new MockVault(testCase.vaultContext);
    const messages: string[] = [];
    const toolCalls: ToolCall[] = [];

    // Create auto-approving tool executor
    const toolExecutor = createToolExecutor(
      mockVault.getApp(),
      DEFAULT_SETTINGS,
      async () => {}, // No UI updates needed
      () => true // Auto-approve all tools
    );

    // Build conversation history
    const conversationHistory: Array<{ role: string; content: string }> = [];

    for (const turn of testCase.conversation) {
      if (turn.role === "user") {
        conversationHistory.push({
          role: "user",
          content: turn.content,
        });

        // Get coach response
        const response = await this.modelClient.sendMessage(conversationHistory, COACH_TOOLS);

        messages.push(response.content);
        conversationHistory.push({
          role: "assistant",
          content: response.content,
        });

        // Execute any tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            toolCalls.push(toolCall);
            await toolExecutor.executeTool(toolCall);
          }
        }
      }
    }

    return {
      messages,
      toolCalls,
    };
  }
}
