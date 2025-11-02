// ABOUTME: Manages conversation state including creation, title generation, and pruning.
// ABOUTME: Provides utilities for conversation lifecycle management.

import { CoachState, CoachConversation } from "./types";
import { v4 as uuidv4 } from "uuid";

export class CoachStateManager {
  /**
   * Create a new conversation with UUID and initial state.
   */
  createConversation(systemPrompt: string): CoachConversation {
    const now = Date.now();
    return {
      id: uuidv4(),
      title: "New conversation",
      messages: [],
      systemPrompt,
      createdAt: now,
      lastUpdatedAt: now,
    };
  }

  /**
   * Generate conversation title from first user message.
   * Truncates to 50 characters if necessary.
   */
  updateConversationTitle(firstMessage: string): string {
    const maxLength = 50;
    if (firstMessage.length <= maxLength) {
      return firstMessage;
    }
    return firstMessage.slice(0, maxLength);
  }

  /**
   * Prune conversations to keep last 50, sorted by creation date.
   * Returns new state with pruned conversations.
   */
  pruneOldConversations(state: CoachState): CoachState {
    const maxConversations = 50;

    if (state.conversations.length <= maxConversations) {
      return state;
    }

    // Sort by creation date descending (newest first)
    const sorted = [...state.conversations].sort((a, b) => b.createdAt - a.createdAt);

    // Keep last 50
    const pruned = sorted.slice(0, maxConversations);

    return {
      ...state,
      conversations: pruned,
    };
  }
}
