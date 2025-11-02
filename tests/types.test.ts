import {
  FocusItem,
  CoachConversation,
  CoachState,
  ProjectCardData,
  ActionCardData,
  ToolApprovalBlock,
} from "../src/types";

describe("FocusItem type", () => {
  it("should have all required properties", () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    expect(item.file).toBe("Projects/Test.md");
    expect(item.lineNumber).toBe(5);
    expect(item.lineContent).toBe("- [ ] Test action");
    expect(item.text).toBe("Test action");
    expect(item.sphere).toBe("work");
    expect(item.isGeneral).toBe(false);
    expect(typeof item.addedAt).toBe("number");
  });
});

describe("Coach types", () => {
  it("should define CoachConversation interface", () => {
    const conversation: CoachConversation = {
      id: "test-id",
      title: "Test Conversation",
      messages: [],
      systemPrompt: "Test prompt",
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    expect(conversation.id).toBe("test-id");
  });

  it("should define CoachState interface", () => {
    const state: CoachState = {
      conversations: [],
      activeConversationId: null,
    };
    expect(state.conversations).toEqual([]);
  });

  it("should define DisplayCard types", () => {
    const projectCard: ProjectCardData = {
      title: "Test Project",
      description: "Test description",
      priority: 1,
      status: "live",
      nextActionsCount: 3,
      file: "Projects/test.md",
    };
    expect(projectCard.title).toBe("Test Project");

    const actionCard: ActionCardData = {
      text: "Test action",
      file: "Projects/test.md",
      lineNumber: 10,
      status: "incomplete",
    };
    expect(actionCard.text).toBe("Test action");
  });

  it("should define ToolApprovalBlock type", () => {
    const block: ToolApprovalBlock = {
      toolCall: {
        id: "test",
        name: "move_to_focus",
        input: {},
      },
      status: "pending",
    };
    expect(block.status).toBe("pending");
  });
});
