// ABOUTME: Type definitions for deepeval coach evaluation test cases
// ABOUTME: Defines test case structure, expectations, and vault context mocking

import { FlowProject } from "../../src/types";
import { ToolCall } from "../../src/language-model";

export interface CoachTestCase {
  id: string;
  description: string;
  type: "single-turn" | "multi-turn";
  conversation: ConversationTurn[];
  vaultContext: VaultContext;
  expectations: TestExpectations;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  expectedTools?: ExpectedToolCall[];
  actualTools?: ToolCall[];
}

export interface VaultContext {
  projects: FlowProject[];
  nextActions: string[];
  somedayItems: string[];
  protocolActive?: string;
}

export interface ExpectedToolCall {
  name: string;
  parameters?: Record<string, any>;
}

export interface TestExpectations {
  toolUsage?: ToolUsageExpectation[];
  coachingQuality: GEvalCriteria;
  conversationCoherence?: CoherenceExpectation;
}

export interface ToolUsageExpectation {
  turn?: number;
  shouldCallTool: boolean;
  toolName?: string;
  requiredParams?: string[];
}

export interface GEvalCriteria {
  criteria: string[];
  threshold: number;
}

export interface CoherenceExpectation {
  maintainsContext: boolean;
  respondsToUserFeedback: boolean;
}

export interface CoachResponse {
  messages: string[];
  toolCalls: ToolCall[];
}
