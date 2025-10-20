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
    it("should get a fresh leaf each time to avoid stale references", async () => {
      const firstProject = new TFile("Projects/first-project.md");
      const secondProject = new TFile("Projects/second-project.md");

      const firstLeaf = new WorkspaceLeaf();
      const secondLeaf = new WorkspaceLeaf();

      // Setup mocks - getLeaf will return a fresh leaf each time
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

      // Should call getLeaf each time to avoid stale leaf references
      expect(app.workspace.getLeaf).toHaveBeenCalledTimes(2);
      expect(app.workspace.getLeaf).toHaveBeenNthCalledWith(2, "split", "vertical");
      // Second file should open in the second leaf returned by getLeaf
      expect(secondLeaf.openFile).toHaveBeenCalledWith(secondProject);
    });
  });

  describe("filtering projects", () => {
    it("should filter out all files in Templates folder", async () => {
      const projectTemplate = {
        file: "Templates/Project.md",
        title: "Project Template",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Some action"],
      };

      const workProjectTemplate = {
        file: "Templates/Work project.md",
        title: "Work Project Template",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Some work action"],
      };

      const regularProject = {
        file: "Projects/Regular.md",
        title: "Regular Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["Another action"],
      };

      mockScanner.scanProjects.mockResolvedValue([
        projectTemplate,
        workProjectTemplate,
        regularProject,
      ]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.file).toBe("Projects/Regular.md");
    });

    it("should filter out template file from settings even if outside Templates folder", async () => {
      const customTemplate = {
        file: "My Custom Template.md",
        title: "Custom Template",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Template action"],
      };

      const regularProject = {
        file: "Projects/Regular.md",
        title: "Regular Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["Another action"],
      };

      mockScanner.scanProjects.mockResolvedValue([customTemplate, regularProject]);

      settings.projectTemplateFilePath = "My Custom Template.md";
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.file).toBe("Projects/Regular.md");
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

  describe("project sorting", () => {
    it("should sort projects by priority, then alphabetically", async () => {
      const projects = [
        {
          file: "Charlie.md",
          title: "Charlie Project",
          tags: ["project/work"],
          status: "live" as const,
          priority: 3,
          nextActions: ["Charlie action"],
          mtime: Date.now(),
        },
        {
          file: "Alpha.md",
          title: "Alpha Project",
          tags: ["project/work"],
          status: "live" as const,
          priority: 1,
          nextActions: ["Alpha action"],
          mtime: Date.now(),
        },
        {
          file: "Zulu.md",
          title: "Zulu Project",
          tags: ["project/work"],
          status: "live" as const,
          priority: undefined,
          nextActions: ["Zulu action"],
          mtime: Date.now(),
        },
        {
          file: "Bravo.md",
          title: "Bravo Project",
          tags: ["project/work"],
          status: "live" as const,
          priority: 1,
          nextActions: ["Bravo action"],
          mtime: Date.now(),
        },
        {
          file: "Delta.md",
          title: "Delta Project",
          tags: ["project/work"],
          status: "live" as const,
          priority: null,
          nextActions: ["Delta action"],
          mtime: Date.now(),
        },
      ];

      mockScanner.scanProjects.mockResolvedValue(projects);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(5);
      // Priority 1 projects alphabetically (Alpha, Bravo)
      expect(data.projects[0].project.title).toBe("Alpha Project");
      expect(data.projects[1].project.title).toBe("Bravo Project");
      // Priority 3 project
      expect(data.projects[2].project.title).toBe("Charlie Project");
      // No priority projects alphabetically (Delta, Zulu)
      expect(data.projects[3].project.title).toBe("Delta Project");
      expect(data.projects[4].project.title).toBe("Zulu Project");
    });
  });

  describe("completed items filtering", () => {
    it("should exclude completed actions from project next actions", async () => {
      const project = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: [
          "Call client about meeting",
          "Review proposal",
          "Send follow-up email",
        ],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      // Should only include incomplete actions
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.nextActions).toEqual([
        "Call client about meeting",
        "Review proposal",
        "Send follow-up email",
      ]);
    });

    it("should exclude completed general next actions", async () => {
      mockScanner.scanProjects.mockResolvedValue([]);

      const nextActionsContent = `
# Next Actions

- [ ] Call dentist #sphere/work
- [x] Email team update #sphere/work
- [X] Review quarterly report #sphere/work
- [ ] Schedule meeting #sphere/work
`;

      const mockFile = new TFile("Next actions.md");
      app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      app.vault.read = jest.fn().mockResolvedValue(nextActionsContent);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      // Should only include incomplete actions
      expect(data.generalNextActions).toEqual(["Call dentist", "Schedule meeting"]);
    });
  });

  describe("always-on hotlist toggle", () => {
    it("should not have planning mode property", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // After removing planning mode, this property should not exist
      expect((view as any).planningMode).toBeUndefined();
    });

    it("should add action to hotlist when clicked", async () => {
      settings.hotlist = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

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

    it("should remove action from hotlist when clicked again", async () => {
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

    it("should toggle hotlist item off when clicked again (add then remove)", async () => {
      settings.hotlist = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // First click: add to hotlist
      await (view as any).addToHotlist(
        "Toggle action",
        "Projects/Toggle.md",
        10,
        "- [ ] Toggle action",
        "work",
        false
      );

      expect(settings.hotlist).toHaveLength(1);
      expect(settings.hotlist[0].text).toBe("Toggle action");
      expect(mockSaveSettings).toHaveBeenCalledTimes(1);

      // Second click: remove from hotlist
      await (view as any).removeFromHotlist("Projects/Toggle.md", 10);

      expect(settings.hotlist).toHaveLength(0);
      expect(mockSaveSettings).toHaveBeenCalledTimes(2);
    });

    it("should add CSS class to element when adding to hotlist", async () => {
      settings.hotlist = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Create a mock HTML element with classList
      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      } as any;

      await (view as any).addToHotlist(
        "Test action",
        "Projects/Test.md",
        5,
        "- [ ] Test action",
        "work",
        false,
        mockElement
      );

      // CSS class should be added to the element
      expect(mockElement.classList.add).toHaveBeenCalledWith("sphere-action-in-hotlist");
    });

    it("should remove CSS class from element when removing from hotlist", async () => {
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

      // Create a mock HTML element with classList
      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      } as any;

      await (view as any).removeFromHotlist("Projects/Test.md", 5, mockElement);

      // CSS class should be removed from the element
      expect(mockElement.classList.remove).toHaveBeenCalledWith("sphere-action-in-hotlist");
    });

    it("should not refresh view when element is provided", async () => {
      settings.hotlist = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      } as any;
      const onOpenSpy = jest.spyOn(view, "onOpen");

      await (view as any).addToHotlist(
        "Test action",
        "Projects/Test.md",
        5,
        "- [ ] Test action",
        "work",
        false,
        mockElement
      );

      // View should NOT refresh when element is provided
      expect(onOpenSpy).not.toHaveBeenCalled();
    });
  });
});
