// ABOUTME: Tests for the main plugin class focusing on command registration and view management
// ABOUTME: Verifies that views are properly focused when already open
import { App, WorkspaceLeaf } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { FOCUS_VIEW_TYPE } from "../src/focus-view";
import { SPHERE_VIEW_TYPE } from "../src/sphere-view";

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
    it("should focus existing focus view if already open", async () => {
      // Setup: Existing leaf with focus view
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      // Execute
      await plugin.activateFocusView();

      // Verify: Should reveal the leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);

      // Verify: Should also set it as active with focus
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(mockLeaf, { focus: true });
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
});
