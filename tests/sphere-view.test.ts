// ABOUTME: Tests for SphereView functionality including project opening behaviour.
// ABOUTME: Verifies that projects open in the right pane and replace existing tabs.

import { App, TFile, WorkspaceLeaf } from "obsidian";
import { SphereView } from "../src/sphere-view";
import { PluginSettings } from "../src/types";
import { FlowProjectScanner } from "../src/flow-scanner";
import { ActionLineFinder } from "../src/action-line-finder";

// Mock the scanner and line finder
jest.mock("../src/flow-scanner");
jest.mock("../src/action-line-finder");

describe("SphereView", () => {
  let app: App;
  let leaf: WorkspaceLeaf;
  let settings: PluginSettings;
  let mockSaveSettings: jest.Mock;
  let mockScanner: jest.Mocked<FlowProjectScanner>;
  let mockLineFinder: jest.Mocked<ActionLineFinder>;

  beforeEach(() => {
    app = new App();
    leaf = new WorkspaceLeaf();
    mockSaveSettings = jest.fn();
    settings = {
      anthropicApiKey: "",
      anthropicModel: "claude-sonnet-4-20250514",
      openaiApiKey: "",
      openaiBaseUrl: "https://openrouter.ai/api/v1",
      openaiModel: "openrouter/anthropic/claude-3.5-sonnet",
      llmProvider: "anthropic",
      defaultPriority: 2,
      defaultStatus: "live",
      inboxFilesFolder: "Flow Inbox Files",
      inboxFolder: "Flow Inbox Folder",
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      projectsFolder: "Projects",
      availableSpheres: ["personal", "work"],
      hotlist: [],
    };

    // Mock scanner to return empty array by default
    mockScanner = {
      scanProjects: jest.fn().mockResolvedValue([]),
    } as any;
    (FlowProjectScanner as jest.Mock).mockImplementation(() => mockScanner);

    // Mock line finder
    mockLineFinder = {
      findActionLine: jest.fn().mockResolvedValue({ found: false }),
    } as any;
    (ActionLineFinder as jest.Mock).mockImplementation(() => mockLineFinder);

    // Mock workspace methods for hotlist view
    app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
    app.workspace.getRightLeaf = jest.fn().mockReturnValue(null);
    app.workspace.revealLeaf = jest.fn();

    // Mock vault methods
    app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
    app.vault.read = jest.fn().mockResolvedValue("");
  });

  describe("openProjectFile", () => {
    it("should reuse the same right pane when opening multiple projects", async () => {
      const firstProject = new TFile("Projects/first-project.md");
      const secondProject = new TFile("Projects/second-project.md");

      const firstLeaf = new WorkspaceLeaf();
      const secondLeaf = new WorkspaceLeaf();

      // Setup mocks - getLeaf will return a different leaf each time if called
      // This tests that we DON'T call it multiple times
      app.workspace.getLeaf = jest
        .fn()
        .mockReturnValueOnce(firstLeaf)
        .mockReturnValueOnce(secondLeaf);

      app.vault.getAbstractFileByPath = jest
        .fn()
        .mockReturnValueOnce(firstProject)
        .mockReturnValueOnce(secondProject);

      const view = new SphereView(leaf, "personal", settings, mockSaveSettings);
      // Replace the view's app with our mocked one
      view.app = app;

      // Open first project
      await (view as any).openProjectFile(firstProject.path);

      // Verify first project opened with "split" mode
      expect(app.workspace.getLeaf).toHaveBeenCalledWith("split", "vertical");
      expect(firstLeaf.openFile).toHaveBeenCalledWith(firstProject);

      // Open second project
      await (view as any).openProjectFile(secondProject.path);

      // Should reuse the same leaf - getLeaf should only be called ONCE, not twice
      expect(app.workspace.getLeaf).toHaveBeenCalledTimes(1);
      // Second file should open in the FIRST leaf, not the second
      expect(firstLeaf.openFile).toHaveBeenCalledWith(secondProject);
      expect(firstLeaf.openFile).toHaveBeenCalledTimes(2);
      // Second leaf should never be used
      expect(secondLeaf.openFile).not.toHaveBeenCalled();
    });
  });

  describe("filtering projects", () => {
    it("should filter out the project template file", async () => {
      const projectTemplate = {
        file: "Templates/Project.md",
        title: "Project Template",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Some action"],
      };

      const regularProject = {
        file: "Projects/Regular.md",
        title: "Regular Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["Another action"],
      };

      mockScanner.scanProjects.mockResolvedValue([projectTemplate, regularProject]);

      settings.projectTemplateFilePath = "Templates/Project.md";
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.file).toBe("Projects/Regular.md");
      expect(data.projects[0].project.file).not.toBe("Templates/Project.md");
    });
  });

  describe("project hierarchy", () => {
    it("should preserve hierarchy depth when filtering projects by sphere", async () => {
      // Create a hierarchy: Root (work) -> Child (work) -> Grandchild (personal)
      const rootProject = {
        file: "Root.md",
        title: "Root Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Root action"],
        mtime: Date.now(),
      };

      const childProject = {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        parentProject: "[[Root]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      const grandchildProject = {
        file: "Grandchild.md",
        title: "Grandchild Project",
        tags: ["project/personal"],
        status: "live" as const,
        priority: 3,
        parentProject: "[[Child]]",
        nextActions: ["Grandchild action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([rootProject, childProject, grandchildProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      // Should include root and child (both tagged work), but not grandchild (tagged personal)
      expect(data.projects).toHaveLength(2);

      // Root should have depth 0
      const root = data.projects.find((p: any) => p.project.file === "Root.md");
      expect(root?.depth).toBe(0);

      // Child should have depth 1
      const child = data.projects.find((p: any) => p.project.file === "Child.md");
      expect(child?.depth).toBe(1);
    });

    it("should handle sub-projects where parent is filtered out", async () => {
      // Create: Root (personal) -> Child (work)
      const rootProject = {
        file: "Root.md",
        title: "Root Project",
        tags: ["project/personal"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Root action"],
        mtime: Date.now(),
      };

      const childProject = {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        parentProject: "[[Root]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([rootProject, childProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      // Should only include child (tagged work)
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.file).toBe("Child.md");

      // Child should still have depth 1 because hierarchy was built from ALL projects first
      expect(data.projects[0].depth).toBe(1);
    });
  });

  describe("planning mode", () => {
    it("should toggle planning mode on and off", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      expect((view as any).planningMode).toBe(false);

      (view as any).togglePlanningMode();
      expect((view as any).planningMode).toBe(true);

      (view as any).togglePlanningMode();
      expect((view as any).planningMode).toBe(false);
    });

    it("should add action to hotlist when clicked in planning mode", async () => {
      settings.hotlist = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;
      (view as any).planningMode = true;

      await (view as any).addToHotlist(
        "Test action",
        "Projects/Test.md",
        5,
        "- [ ] Test action",
        "work",
        false
      );

      expect(settings.hotlist).toHaveLength(1);
      expect(settings.hotlist[0].text).toBe("Test action");
      expect(settings.hotlist[0].file).toBe("Projects/Test.md");
    });

    it("should remove action from hotlist when clicked again in planning mode", async () => {
      settings.hotlist = [
        {
          file: "Projects/Test.md",
          lineNumber: 5,
          lineContent: "- [ ] Test action",
          text: "Test action",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
        },
      ];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;
      (view as any).planningMode = true;

      await (view as any).removeFromHotlist("Projects/Test.md", 5);

      expect(settings.hotlist).toHaveLength(0);
    });

    it("should check if action is on hotlist", () => {
      settings.hotlist = [
        {
          file: "Projects/Test.md",
          lineNumber: 5,
          lineContent: "- [ ] Test action",
          text: "Test action",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
        },
      ];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      expect((view as any).isOnHotlist("Projects/Test.md", 5)).toBe(true);
      expect((view as any).isOnHotlist("Projects/Test.md", 6)).toBe(false);
      expect((view as any).isOnHotlist("Projects/Other.md", 5)).toBe(false);
    });
  });
});
