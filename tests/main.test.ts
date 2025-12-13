// ABOUTME: Tests for the main plugin class focusing on command registration and view management
// ABOUTME: Verifies that views are properly focused when already open
import { App, WorkspaceLeaf, Notice } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { FOCUS_VIEW_TYPE } from "../src/focus-view";
import { SPHERE_VIEW_TYPE } from "../src/sphere-view";
import { DEFAULT_SETTINGS } from "../src/types";

// Mock the view modules
jest.mock("../src/inbox-processing-view", () => ({
  INBOX_PROCESSING_VIEW_TYPE: "flow-gtd-inbox-processing",
  InboxProcessingView: jest.fn().mockImplementation(() => ({
    hasItemsInProgress: jest.fn().mockReturnValue(false),
    refresh: jest.fn(),
  })),
}));

jest.mock("../src/waiting-for-view", () => ({
  WAITING_FOR_VIEW_TYPE: "flow-gtd-waiting-for",
  WaitingForView: jest.fn(),
}));

jest.mock("../src/focus-view", () => ({
  FOCUS_VIEW_TYPE: "flow-gtd-focus",
  FocusView: jest.fn(),
}));

jest.mock("../src/sphere-view", () => ({
  SPHERE_VIEW_TYPE: "flow-gtd-sphere",
  SphereView: jest.fn().mockImplementation(() => ({
    getDisplayText: jest.fn().mockReturnValue("Personal Sphere"),
    setSphere: jest.fn(),
  })),
}));

jest.mock("../src/settings-tab", () => ({
  FlowGTDSettingTab: jest.fn(),
}));

jest.mock("../src/flow-coach-view", () => ({
  FLOW_COACH_VIEW_TYPE: "flow-coach-view",
  FlowCoachView: jest.fn(),
}));

describe("FlowGTDCoachPlugin - View Focusing", () => {
  let plugin: FlowGTDCoachPlugin;
  let mockApp: App;
  let mockLeaf: WorkspaceLeaf;

  beforeEach(async () => {
    // Mock window.setInterval and window.clearInterval
    global.window = {
      setInterval: jest.fn().mockReturnValue(123),
      clearInterval: jest.fn(),
    } as any;

    mockApp = new App();
    mockLeaf = new WorkspaceLeaf();

    plugin = new FlowGTDCoachPlugin(mockApp, {
      id: "flow",
      name: "Flow",
      version: "0.1.0",
      minAppVersion: "0.15.0",
      description: "Test",
      author: "Test",
      authorUrl: "",
      isDesktopOnly: false,
    });

    await plugin.onload();
  });

  afterEach(() => {
    plugin.onunload();
    jest.clearAllTimers();
  });

  describe("activateWaitingForView", () => {
    it("should focus existing waiting-for view if already open", async () => {
      // Setup: Existing leaf with waiting-for view
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      // Execute
      await plugin.activateWaitingForView();

      // Verify: Should reveal the leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);

      // Verify: Should also set it as active with focus
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(mockLeaf, { focus: true });
    });

    it("should create new waiting-for view if none exists", async () => {
      // Setup: No existing leaves
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      const tabLeaf = new WorkspaceLeaf();
      (mockApp.workspace.getLeaf as jest.Mock).mockReturnValue(tabLeaf);

      // Execute
      await plugin.activateWaitingForView();

      // Verify: Should create view in new tab
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith("tab");
      expect(tabLeaf.setViewState).toHaveBeenCalledWith({
        type: WAITING_FOR_VIEW_TYPE,
        active: true,
      });

      // Verify: Should reveal and focus the new leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(tabLeaf);
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(tabLeaf, { focus: true });
    });
  });

  describe("activateFocusView", () => {
    it("should focus and refresh existing focus view if already open", async () => {
      // Setup: Existing leaf with focus view that has onOpen method
      const mockOnOpen = jest.fn().mockResolvedValue(undefined);
      mockLeaf.view = { onOpen: mockOnOpen };
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      // Execute
      await plugin.activateFocusView();

      // Verify: Should reveal the leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);

      // Verify: Should also set it as active with focus
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(mockLeaf, { focus: true });

      // Verify: Should refresh the view by calling onOpen
      expect(mockOnOpen).toHaveBeenCalled();
    });

    it("should create new focus view if none exists", async () => {
      // Setup: No existing leaves
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      const rightLeaf = new WorkspaceLeaf();
      (mockApp.workspace.getRightLeaf as jest.Mock).mockReturnValue(rightLeaf);

      // Execute
      await plugin.activateFocusView();

      // Verify: Should create view in right leaf
      expect(mockApp.workspace.getRightLeaf).toHaveBeenCalledWith(false);
      expect(rightLeaf.setViewState).toHaveBeenCalledWith({
        type: FOCUS_VIEW_TYPE,
        active: true,
      });

      // Verify: Should reveal and focus the new leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(rightLeaf);
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(rightLeaf, { focus: true });
    });
  });

  describe("openSphereView - focus integration", () => {
    it("should open focus view when opening sphere view if focus not already open", async () => {
      // Setup: No existing sphere or focus views
      const sphereLeaf = new WorkspaceLeaf();
      const rightLeaf = new WorkspaceLeaf();

      // Mock sphere view with required methods
      const mockSphereView = {
        setSphere: jest.fn().mockResolvedValue(undefined),
      };
      sphereLeaf.view = mockSphereView as any;

      (mockApp.workspace.getLeavesOfType as jest.Mock).mockImplementation((type: string) => {
        if (type === SPHERE_VIEW_TYPE) return [];
        if (type === FOCUS_VIEW_TYPE) return []; // No focus open
        return [];
      });

      (mockApp.workspace.getLeaf as jest.Mock).mockReturnValue(sphereLeaf);
      (mockApp.workspace.getRightLeaf as jest.Mock).mockReturnValue(rightLeaf);

      // Execute: Open a sphere view
      await (plugin as any).openSphereView("personal");

      // Verify: Should open both sphere view and focus view
      expect(sphereLeaf.setViewState).toHaveBeenCalledWith({
        type: SPHERE_VIEW_TYPE,
        active: true,
      });

      expect(rightLeaf.setViewState).toHaveBeenCalledWith({
        type: FOCUS_VIEW_TYPE,
        active: true,
      });
    });

    it("should not open focus view when opening sphere view if focus already open", async () => {
      // Setup: Existing focus view
      const sphereLeaf = new WorkspaceLeaf();
      const existingFocusLeaf = new WorkspaceLeaf();

      // Mock sphere view with required methods
      const mockSphereView = {
        setSphere: jest.fn().mockResolvedValue(undefined),
      };
      sphereLeaf.view = mockSphereView as any;

      (mockApp.workspace.getLeavesOfType as jest.Mock).mockImplementation((type: string) => {
        if (type === SPHERE_VIEW_TYPE) return [];
        if (type === FOCUS_VIEW_TYPE) return [existingFocusLeaf]; // Focus already open
        return [];
      });

      (mockApp.workspace.getLeaf as jest.Mock).mockReturnValue(sphereLeaf);

      // Execute: Open a sphere view
      await (plugin as any).openSphereView("personal");

      // Verify: Should only reveal existing focus, not create new one
      expect(mockApp.workspace.getRightLeaf).not.toHaveBeenCalled();
    });
  });

  describe("Flow Coach View registration", () => {
    it("should register flow-coach-view on load", async () => {
      // The viewRegistry is populated by registerView calls
      const viewTypes = Object.keys(mockApp.workspace.viewRegistry);
      expect(viewTypes).toContain("flow-coach-view");
    });

    it("should register open-flow-coach command", async () => {
      // Check if the command was registered
      const commands = mockApp.commands.commands;
      expect(commands["flow:open-flow-coach"]).toBeDefined();
    });

    it("should load and save coach state", async () => {
      // Mock loadData to return coach state
      const mockLoadData = jest.fn().mockResolvedValue({
        settings: {},
        coachState: {
          conversations: [
            {
              id: "test-id",
              title: "Test",
              messages: [],
              systemPrompt: "prompt",
              createdAt: 123,
              lastUpdatedAt: 123,
            },
          ],
          activeConversationId: "test-id",
        },
      });
      plugin.loadData = mockLoadData;

      // Reload plugin
      await plugin.loadSettings();

      expect(plugin["coachState"]).toBeDefined();
      expect(plugin["coachState"].conversations.length).toBe(1);
    });
  });

  describe("AI-disabled behavior", () => {
    it("should return true from hasRequiredApiKey when AI is disabled", () => {
      // Set AI to disabled with no API key
      plugin.settings.aiEnabled = false;
      plugin.settings.anthropicApiKey = "";
      plugin.settings.openaiApiKey = "";

      const hasKey = (plugin as any).hasRequiredApiKey();

      expect(hasKey).toBe(true);
    });

    it("should return false from hasRequiredApiKey when AI is enabled but API key is missing", () => {
      // Set AI to enabled with no API key (Anthropic provider)
      plugin.settings.aiEnabled = true;
      plugin.settings.llmProvider = "anthropic";
      plugin.settings.anthropicApiKey = "";

      const hasKey = (plugin as any).hasRequiredApiKey();

      expect(hasKey).toBe(false);
    });

    it("should return true from hasRequiredApiKey when AI is enabled and API key is present", () => {
      // Set AI to enabled with API key
      plugin.settings.aiEnabled = true;
      plugin.settings.llmProvider = "anthropic";
      plugin.settings.anthropicApiKey = "sk-ant-test123456789";

      const hasKey = (plugin as any).hasRequiredApiKey();

      expect(hasKey).toBe(true);
    });

    it("should return appropriate message when AI is disabled", () => {
      plugin.settings.aiEnabled = false;

      const message = (plugin as any).getMissingApiKeyMessage();

      expect(message).toContain("AI features are disabled");
      expect(message).toContain("enable AI in the plugin settings");
    });

    it("should return appropriate message when AI is enabled but API key is missing", () => {
      plugin.settings.aiEnabled = true;

      const message = (plugin as any).getMissingApiKeyMessage();

      expect(message).toContain("API key");
      expect(message).not.toContain("AI features are disabled");
    });
  });

  describe("Default settings", () => {
    it("should include completedTodaySectionCollapsed in default settings", () => {
      const settings = DEFAULT_SETTINGS;
      expect(settings.completedTodaySectionCollapsed).toBe(false);
    });
  });

  describe("Generate cover image command", () => {
    beforeEach(() => {
      Notice.mockConstructor.mockClear();
    });

    it("should register generate-cover-image command", () => {
      const commands = mockApp.commands.commands;
      expect(commands["flow:generate-cover-image"]).toBeDefined();
    });

    it("should show error notice if AI is disabled", async () => {
      plugin.settings.aiEnabled = false;

      // Execute command
      const command = mockApp.commands.commands["flow:generate-cover-image"];
      await command.callback();

      expect(Notice.mockConstructor).toHaveBeenCalledWith(
        expect.stringContaining("AI features are disabled")
      );
    });

    it("should show error notice if no active file", async () => {
      // Enable AI for this test
      plugin.settings.aiEnabled = true;
      plugin.settings.openaiApiKey = "test-key";

      // No active file
      (mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(null);

      // Execute command
      const command = mockApp.commands.commands["flow:generate-cover-image"];
      await command.callback();

      expect(Notice.mockConstructor).toHaveBeenCalledWith(
        expect.stringContaining("No active file")
      );
    });
  });
});
