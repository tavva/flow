// ABOUTME: Tests for the main plugin class focusing on command registration and view management
// ABOUTME: Verifies that views are properly focused when already open
import { App, WorkspaceLeaf } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { HOTLIST_VIEW_TYPE } from "../src/hotlist-view";
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

jest.mock("../src/hotlist-view", () => ({
  HOTLIST_VIEW_TYPE: "flow-gtd-hotlist",
  HotlistView: jest.fn(),
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
    mockApp = new App();
    mockLeaf = new WorkspaceLeaf();

    plugin = new FlowGTDCoachPlugin(mockApp, {
      id: "flow-gtd-coach",
      name: "Flow GTD Coach",
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
      const rightLeaf = new WorkspaceLeaf();
      (mockApp.workspace.getRightLeaf as jest.Mock).mockReturnValue(rightLeaf);

      // Execute
      await plugin.activateWaitingForView();

      // Verify: Should create view in right leaf
      expect(mockApp.workspace.getRightLeaf).toHaveBeenCalledWith(false);
      expect(rightLeaf.setViewState).toHaveBeenCalledWith({
        type: WAITING_FOR_VIEW_TYPE,
        active: true,
      });

      // Verify: Should reveal and focus the new leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(rightLeaf);
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(rightLeaf, { focus: true });
    });
  });

  describe("activateHotlistView", () => {
    it("should focus existing hotlist view if already open", async () => {
      // Setup: Existing leaf with hotlist view
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      // Execute
      await plugin.activateHotlistView();

      // Verify: Should reveal the leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);

      // Verify: Should also set it as active with focus
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(mockLeaf, { focus: true });
    });

    it("should create new hotlist view if none exists", async () => {
      // Setup: No existing leaves
      (mockApp.workspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      const rightLeaf = new WorkspaceLeaf();
      (mockApp.workspace.getRightLeaf as jest.Mock).mockReturnValue(rightLeaf);

      // Execute
      await plugin.activateHotlistView();

      // Verify: Should create view in right leaf
      expect(mockApp.workspace.getRightLeaf).toHaveBeenCalledWith(false);
      expect(rightLeaf.setViewState).toHaveBeenCalledWith({
        type: HOTLIST_VIEW_TYPE,
        active: true,
      });

      // Verify: Should reveal and focus the new leaf
      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(rightLeaf);
      expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalledWith(rightLeaf, { focus: true });
    });
  });
});
