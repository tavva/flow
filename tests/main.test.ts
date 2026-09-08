// ABOUTME: Tests for the main plugin class focusing on command registration and view management
// ABOUTME: Verifies that views are properly focused when already open
import { App, WorkspaceLeaf, Notice, TFile } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { FOCUS_VIEW_TYPE } from "../src/focus-view";
import { SPHERE_VIEW_TYPE } from "../src/sphere-view";
import { DEFAULT_SETTINGS } from "../src/types";
import { saveFocusItems } from "../src/focus-persistence";
import { generateDeterministicFakeApiKey } from "./test-utils";

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

    // Keep startup auto-clear from racing with the file operations under test.
    plugin.loadData = jest.fn().mockResolvedValue({ settings: { focusAutoClearTime: "" } });
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

  describe("AI-disabled behavior", () => {
    it("should return true from hasRequiredApiKey when AI is disabled", () => {
      // Set AI to disabled with no API key
      plugin.settings.aiEnabled = false;
      plugin.settings.openrouterApiKey = "";

      const hasKey = (plugin as any).hasRequiredApiKey();

      expect(hasKey).toBe(true);
    });

    it("should return false from hasRequiredApiKey when AI is enabled but API key is missing", () => {
      // Set AI to enabled with no API key
      plugin.settings.aiEnabled = true;
      plugin.settings.openrouterApiKey = "";

      const hasKey = (plugin as any).hasRequiredApiKey();

      expect(hasKey).toBe(false);
    });

    it("should return true from hasRequiredApiKey when AI is enabled and API key is present", () => {
      // Set AI to enabled with API key
      plugin.settings.aiEnabled = true;
      plugin.settings.openrouterApiKey = generateDeterministicFakeApiKey("main-test");

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

  describe("loadSettings", () => {
    beforeEach(() => {
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
    });

    it("routes a pending first write to the new location even if no file existed yet", async () => {
      plugin.settings.focusFilePath = "A.md";
      await plugin.updateFocusFilePath("B.md");
      await saveFocusItems(mockApp.vault, [], "A.md");
      expect(mockApp.vault.create).toHaveBeenCalledWith("B.md", "");
      expect(mockApp.vault.create).not.toHaveBeenCalledWith("A.md", expect.anything());
    });

    it("waits for an active focus write before moving the file", async () => {
      plugin.settings.focusFilePath = "A.md";
      const source = new TFile("A.md");
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      let finishWrite!: () => void;
      let startedWrite!: () => void;
      const started = new Promise<void>((resolve) => {
        startedWrite = resolve;
      });
      mockApp.vault.modify = jest.fn(() => {
        startedWrite();
        return new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
      });
      mockApp.fileManager.renameFile = jest.fn(async (_file, path) => {
        source.path = path;
      });
      const write = saveFocusItems(mockApp.vault, [], "A.md");
      await started;
      const move = plugin.updateFocusFilePath("B.md");
      await new Promise(setImmediate);
      expect(mockApp.fileManager.renameFile).not.toHaveBeenCalled();
      finishWrite();
      await Promise.all([write, move]);
      expect(source.path).toBe("B.md");
    });

    it("supports moving back to a previous location without redirect loops", async () => {
      plugin.settings.focusFilePath = "A.md";
      const source = new TFile("A.md");
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      mockApp.fileManager.renameFile = jest.fn(async (_file, path) => {
        source.path = path;
      });
      await plugin.updateFocusFilePath("B.md");
      await plugin.updateFocusFilePath("A.md");
      await saveFocusItems(mockApp.vault, [], "B.md");
      expect(mockApp.vault.modify).toHaveBeenCalledWith(source, "");
      expect(mockApp.vault.create).not.toHaveBeenCalled();
      expect(source.path).toBe("A.md");
    });

    it("routes an in-flight operation's old path to the moved file instead of recreating it", async () => {
      const oldPath = DEFAULT_SETTINGS.focusFilePath;
      const source = new TFile(oldPath);
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      mockApp.fileManager.renameFile = jest.fn(async (_file, path) => {
        source.path = path;
      });
      await plugin.updateFocusFilePath("Focus.md");
      await saveFocusItems(mockApp.vault, [], oldPath);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(source, "");
      expect(mockApp.vault.create).not.toHaveBeenCalled();
      expect(source.path).toBe("Focus.md");
    });

    it("restores the original file and setting if saving the new setting fails", async () => {
      const source = new TFile(DEFAULT_SETTINGS.focusFilePath);
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      mockApp.fileManager.renameFile = jest.fn().mockResolvedValue(undefined);
      plugin.saveData = jest.fn().mockRejectedValue(new Error("Settings failed"));
      await expect(plugin.updateFocusFilePath("Focus.md")).rejects.toThrow("Settings failed");
      expect(mockApp.fileManager.renameFile.mock.calls).toEqual([
        [source, "Focus.md"],
        [source, DEFAULT_SETTINGS.focusFilePath],
      ]);
      expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
    });

    it("rejects a folder destination without changing the setting", async () => {
      mockApp.vault.adapter.stat = jest.fn().mockResolvedValue({ type: "folder" });
      await expect(plugin.updateFocusFilePath("Folder.md")).rejects.toThrow("points to a folder");
      expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
    });

    it.each(["../Focus.md", "Folder/../Focus.md", "Focus.txt"])(
      "rejects invalid path %s",
      async (path) => {
        await expect(plugin.updateFocusFilePath(path)).rejects.toThrow(
          "Markdown file path inside your vault"
        );
        expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
      }
    );

    it("moves the existing focus file before saving its new location", async () => {
      const source = new TFile(DEFAULT_SETTINGS.focusFilePath);
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      mockApp.fileManager.renameFile = jest.fn().mockResolvedValue(undefined);
      plugin.saveData = jest.fn().mockResolvedValue(undefined);
      await plugin.updateFocusFilePath("GTD/Nested/Focus.md");
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("GTD");
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("GTD/Nested");
      expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(source, "GTD/Nested/Focus.md");
      expect(plugin.settings.focusFilePath).toBe("GTD/Nested/Focus.md");
    });

    it("keeps the original setting if moving the file fails", async () => {
      const source = new TFile(DEFAULT_SETTINGS.focusFilePath);
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : null
      );
      mockApp.fileManager.renameFile = jest.fn().mockRejectedValue(new Error("Move failed"));
      await expect(plugin.updateFocusFilePath("Focus.md")).rejects.toThrow("Move failed");
      expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
    });

    it("asks before using an existing destination and leaves both files untouched on cancellation", async () => {
      const source = new TFile(DEFAULT_SETTINGS.focusFilePath);
      const destination = new TFile("Focus.md");
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === source.path ? source : path === destination.path ? destination : null
      );
      mockApp.fileManager.renameFile = jest.fn();
      const confirm = jest.fn().mockResolvedValue(false);
      expect(await plugin.updateFocusFilePath("Focus.md", confirm)).toBe(false);
      expect(confirm).toHaveBeenCalledWith("Focus.md");
      expect(mockApp.fileManager.renameFile).not.toHaveBeenCalled();
      expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
    });

    it("uses an existing destination only after confirmation without moving the old file", async () => {
      const destination = new TFile("Focus.md");
      mockApp.vault.getAbstractFileByPath = jest.fn((path) =>
        path === destination.path ? destination : null
      );
      mockApp.fileManager.renameFile = jest.fn();
      const confirm = jest.fn().mockResolvedValue(true);
      expect(await plugin.updateFocusFilePath("Focus.md", confirm)).toBe(true);
      expect(plugin.settings.focusFilePath).toBe("Focus.md");
      expect(mockApp.fileManager.renameFile).not.toHaveBeenCalled();
    });

    it("keeps the original focus location for existing installations", async () => {
      plugin.loadData = jest.fn().mockResolvedValue({ settings: { somedayFilePath: "Later.md" } });
      await plugin.loadSettings();
      expect(plugin.settings.focusFilePath).toBe("flow-focus-data/focus.md");
      expect(plugin.settings.somedayFilePath).toBe("Later.md");
    });

    it("saves a custom focus path and reloads open focus and sphere views", async () => {
      const focus = { view: { onOpen: jest.fn().mockResolvedValue(undefined) } };
      const sphere = { view: { onOpen: jest.fn().mockResolvedValue(undefined) } };
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockImplementation((type) =>
        type === FOCUS_VIEW_TYPE ? [focus] : type === SPHERE_VIEW_TYPE ? [sphere] : []
      );
      plugin.saveData = jest.fn().mockResolvedValue(undefined);
      await plugin.updateFocusFilePath(" GTD/Focus.md ");
      expect(plugin.settings.focusFilePath).toBe("GTD/Focus.md");
      expect(plugin.saveData).toHaveBeenCalledWith({
        settings: expect.objectContaining({ focusFilePath: "GTD/Focus.md" }),
      });
      expect(focus.view.onOpen).toHaveBeenCalledTimes(1);
      expect(sphere.view.onOpen).toHaveBeenCalledTimes(1);

      await plugin.updateFocusFilePath(" ");
      expect(plugin.settings.focusFilePath).toBe(DEFAULT_SETTINGS.focusFilePath);
    });

    it("should initialise settings to defaults when loadData returns null (new installation)", async () => {
      // Create a fresh plugin instance
      const freshPlugin = new FlowGTDCoachPlugin(mockApp, {
        id: "flow",
        name: "Flow",
        version: "0.1.0",
        minAppVersion: "0.15.0",
        description: "Test",
        author: "Test",
        authorUrl: "",
        isDesktopOnly: false,
      });

      // Mock loadData to return null (simulating first-time installation)
      freshPlugin.loadData = jest.fn().mockResolvedValue(null);

      // Load settings
      await freshPlugin.loadSettings();

      // Settings should be initialised with defaults, not undefined
      expect(freshPlugin.settings).toBeDefined();
      expect(freshPlugin.settings.legacyFocusMigrationDismissed).toBe(false);
      expect(freshPlugin.settings.spheres).toEqual(DEFAULT_SETTINGS.spheres);
    });
  });

  describe("Sphere command re-registration", () => {
    it("should update sphere commands when spheres change", async () => {
      // Initial spheres are "personal" and "work" from DEFAULT_SETTINGS
      const initialCommands = Object.keys(mockApp.commands.commands);
      expect(initialCommands).toContain("flow:sphere-view-personal");
      expect(initialCommands).toContain("flow:sphere-view-work");

      // Change spheres
      plugin.settings.spheres = ["health", "family"];

      // Call updateSphereCommands (exposed for testing, or via saveSettings)
      await plugin.updateSphereCommands();

      // Old commands should be removed, new ones registered
      const updatedCommands = Object.keys(mockApp.commands.commands);
      expect(updatedCommands).not.toContain("flow:sphere-view-personal");
      expect(updatedCommands).not.toContain("flow:sphere-view-work");
      expect(updatedCommands).toContain("flow:sphere-view-health");
      expect(updatedCommands).toContain("flow:sphere-view-family");
    });

    it("should handle sphere names with special characters", async () => {
      plugin.settings.spheres = ["work-life", "side_projects", "health & fitness"];
      await plugin.updateSphereCommands();

      const commands = Object.keys(mockApp.commands.commands);
      expect(commands).toContain("flow:sphere-view-work-life");
      expect(commands).toContain("flow:sphere-view-side-projects");
      expect(commands).toContain("flow:sphere-view-health-fitness");
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
      plugin.settings.openrouterApiKey = "test-key";

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
