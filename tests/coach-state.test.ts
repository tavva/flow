import { CoachStateManager } from "../src/coach-state";
import { CoachState, CoachConversation } from "../src/types";

describe("CoachStateManager", () => {
  let manager: CoachStateManager;

  beforeEach(() => {
    manager = new CoachStateManager();
  });

  describe("createConversation", () => {
    it("should create new conversation with UUID", () => {
      const systemPrompt = "Test prompt";
      const conversation = manager.createConversation(systemPrompt);

      expect(conversation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
      expect(conversation.title).toBe("New conversation");
      expect(conversation.messages).toEqual([]);
      expect(conversation.systemPrompt).toBe(systemPrompt);
      expect(conversation.createdAt).toBeGreaterThan(0);
      expect(conversation.lastUpdatedAt).toBe(conversation.createdAt);
    });
  });

  describe("updateConversationTitle", () => {
    it("should generate title from first user message", () => {
      const conversation = manager.createConversation("prompt");
      const title = manager.updateConversationTitle("Help me prioritize my tasks for today");

      expect(title).toBe("Help me prioritize my tasks for today");
    });

    it("should truncate long titles to 50 characters", () => {
      const conversation = manager.createConversation("prompt");
      const longMessage =
        "This is a very long message that should be truncated to fifty characters maximum";
      const title = manager.updateConversationTitle(longMessage);

      expect(title.length).toBe(50);
      expect(title).toBe("This is a very long message that should be truncat");
    });
  });

  describe("pruneOldConversations", () => {
    it("should keep last 50 conversations", () => {
      const state: CoachState = {
        conversations: [],
        activeConversationId: null,
      };

      // Create 60 conversations with incrementing timestamps
      for (let i = 0; i < 60; i++) {
        const conversation = manager.createConversation("prompt");
        // Ensure each conversation has a unique timestamp
        conversation.createdAt = Date.now() - (60 - i) * 1000;
        conversation.lastUpdatedAt = conversation.createdAt;
        state.conversations.push(conversation);
      }

      const pruned = manager.pruneOldConversations(state);

      expect(pruned.conversations.length).toBe(50);
      // Should keep most recent (highest timestamps)
      expect(pruned.conversations[0].createdAt).toBeGreaterThan(state.conversations[0].createdAt);
    });

    it("should not prune if less than 50 conversations", () => {
      const state: CoachState = {
        conversations: [manager.createConversation("prompt"), manager.createConversation("prompt")],
        activeConversationId: null,
      };

      const pruned = manager.pruneOldConversations(state);
      expect(pruned.conversations.length).toBe(2);
    });
  });
});
