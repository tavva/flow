// ABOUTME: Flow Coach conversation and UI types
// ABOUTME: Contains conversation state, display cards, and tool approval structures

import { ChatMessage, ToolCall } from "../language-model";

export interface CoachConversation {
  id: string; // UUID
  title: string; // Auto-generated from first message
  messages: ChatMessage[];
  systemPrompt: string; // Built once at conversation start
  createdAt: number;
  lastUpdatedAt: number;
  toolApprovalBlocks?: ToolApprovalBlock[]; // Tool calls awaiting approval or completed
  displayCards?: DisplayCard[]; // Cards to render inline with messages
  lastSeenMessageCount?: number; // Number of messages user has seen (for new message indicator)
}

export interface CoachState {
  conversations: CoachConversation[];
  activeConversationId: string | null;
}

export interface ProjectCardData {
  title: string;
  description: string;
  priority: number;
  status: string;
  nextActionsCount: number;
  file: string;
}

export interface ActionCardData {
  text: string;
  file: string;
  lineNumber: number;
  status: "incomplete" | "waiting" | "complete";
}

export type DisplayCard =
  | { type: "project"; data: ProjectCardData; messageIndex: number }
  | { type: "action"; data: ActionCardData; messageIndex: number };

export interface ToolApprovalBlock {
  toolCall: ToolCall;
  status: "pending" | "approved" | "rejected" | "error";
  result?: string;
  error?: string;
}
