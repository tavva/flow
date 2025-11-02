import { FlowCoachView, FLOW_COACH_VIEW_TYPE } from "../src/flow-coach-view";
import { WorkspaceLeaf } from "obsidian";
import { PluginSettings, CoachState } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

describe("FlowCoachView", () => {
  let view: FlowCoachView;
  let mockLeaf: WorkspaceLeaf;
  let mockSettings: PluginSettings;
  let mockSaveSettings: jest.Mock;
  let mockGetState: jest.Mock;
  let mockSetState: jest.Mock;
  let mockCoachState: CoachState;

  beforeEach(() => {
    // Mock app with vault methods
    const mockApp = {
      vault: {
        getMarkdownFiles: jest.fn(() => []),
        getAbstractFileByPath: jest.fn(() => null),
        read: jest.fn().mockResolvedValue(""),
        adapter: {
          basePath: "/test/vault",
        },
      },
      metadataCache: {
        getFileCache: jest.fn(() => null),
      },
      workspace: {
        openLinkText: jest.fn(),
      },
    };

    mockLeaf = {
      view: null as any,
    } as WorkspaceLeaf;

    mockSettings = {
      aiEnabled: true,
      llmProvider: "anthropic",
      anthropicApiKey: generateDeterministicFakeApiKey("test"),
      anthropicModel: "claude-sonnet-4-20250514",
      openaiApiKey: "",
      openaiBaseUrl: "",
      openaiModel: "",
      defaultPriority: 2,
      defaultStatus: "live",
      inboxFilesFolderPath: "Inbox",
      inboxFolderPath: "Inbox",
      processedInboxFolderPath: "Processed",
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      projectsFolderPath: "Projects",
      projectTemplateFilePath: "",
      spheres: ["personal", "work"],
      focusAutoClearTime: "",
      focusArchiveFile: "Archive.md",
      lastFocusClearTimestamp: 0,
      inboxFileProcessingThreshold: 10,
    };
    mockSaveSettings = jest.fn().mockResolvedValue(undefined);
    mockCoachState = {
      conversations: [],
      activeConversationId: null,
    };
    mockGetState = jest.fn(() => mockCoachState);
    mockSetState = jest.fn((state: CoachState) => {
      mockCoachState = state;
    });

    view = new FlowCoachView(mockLeaf, mockSettings, mockSaveSettings, mockGetState, mockSetState);
    // Inject mock app
    (view as any).app = mockApp;
  });

  describe("View metadata", () => {
    it("should return correct view type", () => {
      expect(view.getViewType()).toBe(FLOW_COACH_VIEW_TYPE);
    });

    it("should return correct display text", () => {
      expect(view.getDisplayText()).toBe("Flow Coach");
    });

    it("should return correct icon", () => {
      expect(view.getIcon()).toBe("message-circle");
    });
  });

  describe("onOpen", () => {
    it("should render header with title and dropdown", async () => {
      await view.onOpen();

      const container = view.containerEl.children[1];
      expect(container.querySelector(".coach-header")).toBeTruthy();
      expect(container.querySelector(".coach-title")?.textContent).toBe("Flow Coach");
      expect(container.querySelector(".coach-conversation-dropdown")).toBeTruthy();
    });

    it("should render empty state for new conversation", async () => {
      await view.onOpen();

      const container = view.containerEl.children[1];
      expect(container.querySelector(".coach-messages")).toBeTruthy();
      expect(container.querySelector(".coach-input-area")).toBeTruthy();
    });
  });

  describe("Conversation management", () => {
    it("should create new conversation on startup", async () => {
      await view.onOpen();

      // Should have created a conversation
      expect(view["activeConversation"]).toBeTruthy();
      expect(view["state"].conversations.length).toBe(1);
    });

    it("should switch to existing conversation", async () => {
      await view.onOpen();

      const firstConversation = view["activeConversation"];

      // Start new conversation
      await view["startNewConversation"]();

      expect(view["activeConversation"]?.id).not.toBe(firstConversation?.id);
      expect(view["state"].conversations.length).toBe(2);

      // Switch back to first
      view["switchConversation"](firstConversation!.id);

      expect(view["activeConversation"]?.id).toBe(firstConversation?.id);
    });

    it("should save state after creating conversation", async () => {
      await view.onOpen();

      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  describe("Loading indicator", () => {
    it("should show loading indicator in messages container", async () => {
      await view.onOpen();

      // Verify messagesContainerEl is set
      expect(view["messagesContainerEl"]).toBeTruthy();

      // Initially no loading indicator
      expect(view["messagesContainerEl"]?.querySelector(".coach-loading-indicator")).toBeFalsy();

      // Call showLoadingIndicator directly
      view["showLoadingIndicator"]();

      // Should now show loading indicator
      expect(view["messagesContainerEl"]?.querySelector(".coach-loading-indicator")).toBeTruthy();
    });

    it("should hide loading indicator from messages container", async () => {
      await view.onOpen();

      // Show the loading indicator first
      view["showLoadingIndicator"]();
      expect(view["messagesContainerEl"]?.querySelector(".coach-loading-indicator")).toBeTruthy();

      // Hide it
      view["hideLoadingIndicator"]();

      // Should be removed
      expect(view["messagesContainerEl"]?.querySelector(".coach-loading-indicator")).toBeFalsy();
    });
  });
});
