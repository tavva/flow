import { FlowCoachView, FLOW_COACH_VIEW_TYPE } from "../src/flow-coach-view";
import { WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

describe("FlowCoachView", () => {
  let view: FlowCoachView;
  let mockLeaf: WorkspaceLeaf;
  let mockSettings: PluginSettings;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockLeaf = {} as WorkspaceLeaf;
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

    view = new FlowCoachView(mockLeaf, mockSettings, mockSaveSettings);
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
});
