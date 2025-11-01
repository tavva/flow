// ABOUTME: Tests for SphereView functionality including project opening behaviour.
// ABOUTME: Verifies that projects open in right pane and reuse the same split leaf.

import { App, TFile, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { SphereView } from "../src/sphere-view";
import { PluginSettings, FocusItem } from "../src/types";
import { FlowProjectScanner } from "../src/flow-scanner";
import { ActionLineFinder } from "../src/action-line-finder";

// Mock the scanner and line finder
jest.mock("../src/flow-scanner");
jest.mock("../src/action-line-finder");

// Mock focus persistence
let mockFocusItems: FocusItem[] = [];
jest.mock("../src/focus-persistence", () => ({
  loadFocusItems: jest.fn(() => Promise.resolve(mockFocusItems)),
  saveFocusItems: jest.fn((vault, items) => {
    mockFocusItems = items;
    return Promise.resolve();
  }),
}));

import { saveFocusItems as mockSaveFocusItems } from "../src/focus-persistence";

describe("SphereView", () => {
  let app: App;
  let leaf: WorkspaceLeaf;
  let settings: PluginSettings;
  let mockSaveSettings: jest.Mock;
  let mockScanner: jest.Mocked<FlowProjectScanner>;
  let mockLineFinder: jest.Mocked<ActionLineFinder>;

  beforeEach(() => {
    // Reset mock focus items
    mockFocusItems = [];
    (mockSaveFocusItems as jest.Mock).mockClear();

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

    // Mock workspace methods for focus view
    app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
    app.workspace.getRightLeaf = jest.fn().mockReturnValue(null);
    app.workspace.revealLeaf = jest.fn();

    // Mock vault methods
    app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
    app.vault.read = jest.fn().mockResolvedValue("");
  });

  describe("openProjectFile", () => {
    it("should reuse the same leaf for subsequent project opens", async () => {
      const firstProject = new TFile("Projects/first-project.md");
      const secondProject = new TFile("Projects/second-project.md");

      const projectLeaf = new WorkspaceLeaf();
      projectLeaf.getRoot = jest.fn().mockReturnValue(app.workspace.rootSplit);

      // Setup mocks - getLeaf only called once for first project
      app.workspace.getLeaf = jest.fn().mockReturnValue(projectLeaf);

      app.vault.getAbstractFileByPath = jest
        .fn()
        .mockReturnValueOnce(firstProject)
        .mockReturnValueOnce(secondProject);

      const view = new SphereView(leaf, "personal", settings, mockSaveSettings);
      view.app = app;

      // Open first project
      await (view as any).openProjectFile(firstProject.path);

      // Verify first project opened with "split" mode
      expect(app.workspace.getLeaf).toHaveBeenCalledWith("split", "vertical");
      expect(projectLeaf.openFile).toHaveBeenCalledWith(firstProject);

      // Open second project
      await (view as any).openProjectFile(secondProject.path);

      // Should NOT call getLeaf again - should reuse the same leaf
      expect(app.workspace.getLeaf).toHaveBeenCalledTimes(1);
      // Second file should open in the SAME leaf
      expect(projectLeaf.openFile).toHaveBeenCalledWith(secondProject);
      expect(projectLeaf.openFile).toHaveBeenCalledTimes(2);
    });

    it("should create new leaf if cached leaf is detached", async () => {
      const firstProject = new TFile("Projects/first-project.md");
      const secondProject = new TFile("Projects/second-project.md");

      const firstLeaf = new WorkspaceLeaf();
      firstLeaf.getRoot = jest.fn().mockReturnValue(app.workspace.rootSplit);

      const secondLeaf = new WorkspaceLeaf();
      secondLeaf.getRoot = jest.fn().mockReturnValue(app.workspace.rootSplit);

      app.workspace.getLeaf = jest
        .fn()
        .mockReturnValueOnce(firstLeaf)
        .mockReturnValueOnce(secondLeaf);

      app.vault.getAbstractFileByPath = jest
        .fn()
        .mockReturnValueOnce(firstProject)
        .mockReturnValueOnce(secondProject);

      const view = new SphereView(leaf, "personal", settings, mockSaveSettings);
      view.app = app;

      // Open first project
      await (view as any).openProjectFile(firstProject.path);
      expect(app.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(firstLeaf.openFile).toHaveBeenCalledWith(firstProject);

      // Simulate leaf being detached (e.g., user closed the pane)
      firstLeaf.getRoot = jest.fn().mockReturnValue(null);

      // Open second project
      await (view as any).openProjectFile(secondProject.path);

      // Should create a new leaf since the cached one is detached
      expect(app.workspace.getLeaf).toHaveBeenCalledTimes(2);
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

    it("should preserve hierarchy when sorting by priority", async () => {
      // Parent has priority 2, child has priority 1
      // After sorting, child should still appear AFTER parent (grouped with parent)
      const parentProject = {
        file: "Parent.md",
        title: "Parent Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["Parent action"],
        mtime: Date.now(),
      };

      const childProject = {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        parentProject: "[[Parent]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      const otherProject = {
        file: "Other.md",
        title: "Other Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 3,
        nextActions: ["Other action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([parentProject, childProject, otherProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(3);

      // Parent should appear before its child despite lower priority
      const parentIndex = data.projects.findIndex((p: any) => p.project.file === "Parent.md");
      const childIndex = data.projects.findIndex((p: any) => p.project.file === "Child.md");

      expect(parentIndex).toBeLessThan(childIndex);
      expect(data.projects[childIndex].depth).toBe(1);
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
        nextActions: ["Call client about meeting", "Review proposal", "Send follow-up email"],
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

  describe("waiting-for visual indicator", () => {
    it("should display handshake emoji for waiting-for items", async () => {
      // Mock line finder to return waiting-for checkbox for one action
      mockLineFinder.findActionLine.mockImplementation((file: string, action: string) => {
        if (action === "Wait for client response") {
          return Promise.resolve({
            found: true,
            lineNumber: 5,
            lineContent: "- [w] Wait for client response",
          });
        }
        return Promise.resolve({
          found: true,
          lineNumber: 6,
          lineContent: "- [ ] Regular action",
        });
      });

      const mockListElement = {
        createEl: jest.fn().mockReturnValue({
          style: {},
          classList: {
            add: jest.fn(),
          },
          addEventListener: jest.fn(),
        }),
      };

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Spy on MarkdownRenderer
      const renderMarkdownSpy = jest.spyOn(MarkdownRenderer, "renderMarkdown");

      // Test waiting-for item
      await (view as any).renderActionItem(
        mockListElement,
        "Wait for client response",
        "Projects/Test.md",
        "work",
        false
      );

      // Should have handshake emoji prefix in markdown
      expect(renderMarkdownSpy).toHaveBeenCalledWith(
        "🤝 Wait for client response",
        expect.anything(),
        "",
        view
      );

      renderMarkdownSpy.mockClear();

      // Test regular item
      await (view as any).renderActionItem(
        mockListElement,
        "Regular action",
        "Projects/Test.md",
        "work",
        false
      );

      // Should NOT have handshake emoji prefix
      expect(renderMarkdownSpy).toHaveBeenCalledWith("Regular action", expect.anything(), "", view);

      renderMarkdownSpy.mockRestore();
    });
  });

  describe("always-on focus toggle", () => {
    it("should not have planning mode property", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // After removing planning mode, this property should not exist
      expect((view as any).planningMode).toBeUndefined();
    });

    it("should add action to focus when clicked", async () => {
      mockFocusItems = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await (view as any).addToFocus(
        "Test action",
        "Projects/Test.md",
        5,
        "- [ ] Test action",
        "work",
        false
      );

      expect(mockFocusItems).toHaveLength(1);
      expect(mockFocusItems[0].text).toBe("Test action");
      expect(mockFocusItems[0].file).toBe("Projects/Test.md");
    });

    it("should remove action from focus when clicked again", async () => {
      mockFocusItems = [
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

      await (view as any).removeFromFocus("Projects/Test.md", 5);

      expect(mockFocusItems).toHaveLength(0);
    });

    it("should check if action is on focus", async () => {
      mockFocusItems = [
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

      expect(await (view as any).isOnFocus("Projects/Test.md", 5)).toBe(true);
      expect(await (view as any).isOnFocus("Projects/Test.md", 6)).toBe(false);
      expect(await (view as any).isOnFocus("Projects/Other.md", 5)).toBe(false);
    });

    it("should toggle focus item off when clicked again (add then remove)", async () => {
      mockFocusItems = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // First click: add to focus
      await (view as any).addToFocus(
        "Toggle action",
        "Projects/Toggle.md",
        10,
        "- [ ] Toggle action",
        "work",
        false
      );

      expect(mockFocusItems).toHaveLength(1);
      expect(mockFocusItems[0].text).toBe("Toggle action");
      expect(mockSaveFocusItems).toHaveBeenCalledTimes(1);

      // Second click: remove from focus
      await (view as any).removeFromFocus("Projects/Toggle.md", 10);

      expect(mockFocusItems).toHaveLength(0);
      expect(mockSaveFocusItems).toHaveBeenCalledTimes(2);
    });

    it("should add CSS class to element when adding to focus", async () => {
      mockFocusItems = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Create a mock HTML element with classList
      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      } as any;

      await (view as any).addToFocus(
        "Test action",
        "Projects/Test.md",
        5,
        "- [ ] Test action",
        "work",
        false,
        mockElement
      );

      // CSS class should be added to the element
      expect(mockElement.classList.add).toHaveBeenCalledWith("sphere-action-in-focus");
    });

    it("should remove CSS class from element when removing from focus", async () => {
      mockFocusItems = [
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

      await (view as any).removeFromFocus("Projects/Test.md", 5, mockElement);

      // CSS class should be removed from the element
      expect(mockElement.classList.remove).toHaveBeenCalledWith("sphere-action-in-focus");
    });

    it("should not refresh view when element is provided", async () => {
      mockFocusItems = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      } as any;
      const onOpenSpy = jest.spyOn(view, "onOpen");

      await (view as any).addToFocus(
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

    it("should add items from planning mode as unpinned by default", async () => {
      mockFocusItems = [];
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Simulate adding action via planning mode
      const action = "Test action";
      const file = "Projects/Test.md";
      const lineNumber = 10;
      const lineContent = "- [ ] Test action";

      await (view as any).addToFocus(action, file, lineNumber, lineContent, "work", false);

      // Check item was added with isPinned: false (or undefined, which is treated as false)
      expect(mockFocusItems.length).toBe(1);
      expect(mockFocusItems[0].isPinned).toBeFalsy();
      expect(mockFocusItems[0].text).toBe(action);
    });
  });
});
