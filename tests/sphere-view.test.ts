// ABOUTME: Tests for SphereView functionality including project opening behaviour.
// ABOUTME: Verifies that projects open in the right pane and replace existing tabs.

import { App, TFile, WorkspaceLeaf } from "obsidian";
import { SphereView } from "../src/sphere-view";
import { PluginSettings } from "../src/types";

// Mock the scanner
jest.mock("../src/flow-scanner");

describe("SphereView", () => {
  let app: App;
  let leaf: WorkspaceLeaf;
  let settings: PluginSettings;

  beforeEach(() => {
    app = new App();
    leaf = new WorkspaceLeaf();
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
    };
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

      const view = new SphereView(leaf, "personal", settings);
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

  describe("planning mode", () => {
    it("should toggle planning mode on and off", () => {
      const view = new SphereView(leaf, "work", settings);
      view.app = app;

      expect((view as any).planningMode).toBe(false);

      (view as any).togglePlanningMode();
      expect((view as any).planningMode).toBe(true);

      (view as any).togglePlanningMode();
      expect((view as any).planningMode).toBe(false);
    });
  });
});
