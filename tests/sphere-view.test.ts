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

    it("should create new leaf when getRoot() throws an exception", async () => {
      const firstProject = new TFile("Projects/first-project.md");
      const secondProject = new TFile("Projects/second-project.md");

      const firstLeaf = new WorkspaceLeaf();
      firstLeaf.getRoot = jest.fn().mockImplementation(() => {
        throw new Error("Leaf is in invalid state");
      });

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

      // Open second project - should catch exception from getRoot() and create new leaf
      await (view as any).openProjectFile(secondProject.path);

      // Should create a new leaf since getRoot() threw an exception
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
    it("should preserve hierarchy depth when filtering projects by sphere with same priority", async () => {
      // Create a hierarchy: Root (work, P1) -> Child (work, P1) -> Grandchild (personal, P1)
      // Same priority means child stays nested under parent
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
        priority: 1, // Same priority as parent
        parentProject: "[[Root]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      const grandchildProject = {
        file: "Grandchild.md",
        title: "Grandchild Project",
        tags: ["project/personal"],
        status: "live" as const,
        priority: 1,
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

      // Child should have depth 1 (same priority as parent, so stays nested)
      const child = data.projects.find((p: any) => p.project.file === "Child.md");
      expect(child?.depth).toBe(1);
      expect(child?.parentName).toBeUndefined();
    });

    it("should promote subprojects with different priority to root level", async () => {
      // Create: Root (work, P1) -> Child (work, P2)
      // Different priorities means child is promoted to root level with parent indicator
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
        priority: 2, // Different priority from parent
        parentProject: "[[Root]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([rootProject, childProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(2);

      // Root should have depth 0
      const root = data.projects.find((p: any) => p.project.file === "Root.md");
      expect(root?.depth).toBe(0);
      expect(root?.parentName).toBeUndefined();

      // Child should be promoted to depth 0 with parentName set
      const child = data.projects.find((p: any) => p.project.file === "Child.md");
      expect(child?.depth).toBe(0);
      expect(child?.parentName).toBe("Root Project");
    });

    it("should handle sub-projects where parent is filtered out with different priority", async () => {
      // Create: Root (personal, P1) -> Child (work, P2)
      // Different sphere AND different priority - child promoted with parent indicator
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
        priority: 2, // Different priority from parent
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

      // Child promoted to depth 0 with parent name set
      expect(data.projects[0].depth).toBe(0);
      expect(data.projects[0].parentName).toBe("Root Project");
    });

    it("should preserve depth for sub-projects where parent is filtered out but same priority", async () => {
      // Create: Root (personal, P1) -> Child (work, P1)
      // Different sphere but same priority - child stays at depth 1 without parent indicator
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
        priority: 1, // Same priority as parent
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

      // Child stays at depth 1 (same priority as parent), no parent indicator
      expect(data.projects[0].depth).toBe(1);
      expect(data.projects[0].parentName).toBeUndefined();
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

    it("should sort subprojects into correct priority section when different from parent", async () => {
      // Parent has priority 2, child has priority 1
      // Child should appear BEFORE parent in P1 section, with parent indicator
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
        priority: 1, // Higher priority than parent
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

      // Child (P1) should appear before parent (P2)
      const parentIndex = data.projects.findIndex((p: any) => p.project.file === "Parent.md");
      const childIndex = data.projects.findIndex((p: any) => p.project.file === "Child.md");

      expect(childIndex).toBeLessThan(parentIndex);
      // Child is promoted to depth 0 with parent indicator
      expect(data.projects[childIndex].depth).toBe(0);
      expect(data.projects[childIndex].parentName).toBe("Parent Project");
    });

    it("should preserve hierarchy when child has same priority as parent", async () => {
      // Parent and child both have priority 2
      // Child should appear after parent (nested)
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
        priority: 2, // Same priority as parent
        parentProject: "[[Parent]]",
        nextActions: ["Child action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([parentProject, childProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const data = await (view as any).loadSphereData();

      expect(data.projects).toHaveLength(2);

      // Parent should appear before its child
      const parentIndex = data.projects.findIndex((p: any) => p.project.file === "Parent.md");
      const childIndex = data.projects.findIndex((p: any) => p.project.file === "Child.md");

      expect(parentIndex).toBeLessThan(childIndex);
      // Child stays nested (depth 1, no parent indicator)
      expect(data.projects[childIndex].depth).toBe(1);
      expect(data.projects[childIndex].parentName).toBeUndefined();
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

  describe("priority editing", () => {
    it("should update priority without refreshing the entire view", async () => {
      const project = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["Test action"],
        mtime: Date.now(),
      };

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Mock FileWriter
      const fileWriter = (view as any).fileWriter;
      fileWriter.updateProjectPriority = jest.fn().mockResolvedValue(undefined);

      // Spy on refresh method
      const refreshSpy = jest.spyOn(view as any, "refresh");

      // Create a mock header element with Obsidian methods
      const header = document.createElement("div");
      let capturedChangeHandler: ((e: Event) => void) | null = null;

      // Define all the mock functions first to avoid circular references
      const createSpanFn = jest.fn((options?: any) => {
        const span = document.createElement("span");
        if (options?.cls) span.className = options.cls;
        if (options?.text) span.textContent = options.text;
        (span as any).setText = jest.fn(function (this: HTMLElement, text: string) {
          this.textContent = text;
        });
        header.appendChild(span);
        return span;
      });

      const createElFn = jest.fn((tag: string, options?: any) => {
        const el = document.createElement(tag);
        if (options?.cls) el.className = options.cls;
        if (options?.value) (el as any).value = options.value;
        if (options?.text) (el as any).text = options.text;

        // Spy on addEventListener to capture the change handler
        const originalAddEventListener = el.addEventListener.bind(el);
        el.addEventListener = jest.fn((event: string, handler: any) => {
          if (event === "change" && tag === "select") {
            capturedChangeHandler = handler;
          }
          return originalAddEventListener(event, handler);
        });

        (el as any).createEl = (tag2: string, options2?: any) => {
          const el2 = document.createElement(tag2);
          if (options2?.value) (el2 as any).value = options2.value;
          if (options2?.text) (el2 as any).text = options2.text;
          el.appendChild(el2);
          return el2;
        };
        header.appendChild(el);
        return el;
      });

      const createDivFn = jest.fn((options?: any) => {
        const div = document.createElement("div");
        if (options?.cls) div.className = options.cls;
        // Add Obsidian methods to the div as well
        (div as any).createSpan = createSpanFn;
        (div as any).createEl = createElFn;
        (div as any).createDiv = createDivFn;
        header.appendChild(div);
        return div;
      });

      // Assign them to the header
      (header as any).createDiv = createDivFn;
      (header as any).createSpan = createSpanFn;
      (header as any).createEl = createElFn;

      // Call renderPriorityDropdown directly
      (view as any).renderPriorityDropdown(header, project, 1);

      // Find the dropdown and label that were created
      const dropdown = header.querySelector("select") as HTMLSelectElement;
      const label = header.querySelector(".flow-gtd-sphere-project-priority-label") as HTMLElement;

      expect(dropdown).toBeTruthy();
      expect(label).toBeTruthy();
      expect(label.textContent).toBe("Priority 1");
      expect(capturedChangeHandler).toBeTruthy();

      // Change the dropdown value and call the actual change handler
      dropdown.value = "3";
      const event = { target: dropdown } as any;

      // Call the captured change handler (this is the actual handler from the code)
      await capturedChangeHandler!(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should update file
      expect(fileWriter.updateProjectPriority).toHaveBeenCalledWith(project, 3);

      // Should update label
      expect(label.textContent).toBe("Priority 3");

      // Should NOT refresh the entire view
      // NOTE: This will FAIL with current implementation because refresh() IS called
      expect(refreshSpy).not.toHaveBeenCalled();

      refreshSpy.mockRestore();
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

  describe("next actions visibility toggle", () => {
    it("should have a toggle button in the header", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const toggleButton = container.querySelector(".flow-gtd-sphere-actions-toggle");

      expect(toggleButton).toBeTruthy();
      expect(toggleButton?.textContent).toContain("Hide");
    });

    it("should show next actions by default", async () => {
      const project = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["First action", "Second action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const actionsList = container.querySelector(".flow-gtd-sphere-next-actions");

      expect(actionsList).toBeTruthy();
      expect(actionsList?.classList.contains("flow-gtd-sphere-actions-hidden")).toBe(false);
    });

    it("should hide next actions when toggle is clicked", async () => {
      const project = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["First action", "Second action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const toggleButton = container.querySelector(
        ".flow-gtd-sphere-actions-toggle"
      ) as HTMLElement;

      // Click the toggle button
      toggleButton?.click();

      const actionsList = container.querySelector(".flow-gtd-sphere-next-actions");
      expect(actionsList?.classList.contains("flow-gtd-sphere-actions-hidden")).toBe(true);
      expect(toggleButton?.textContent).toContain("Show");
    });

    it("should show next actions again when toggle is clicked twice", async () => {
      const project = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["First action", "Second action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const toggleButton = container.querySelector(
        ".flow-gtd-sphere-actions-toggle"
      ) as HTMLElement;

      // Click twice
      toggleButton?.click();
      toggleButton?.click();

      const actionsList = container.querySelector(".flow-gtd-sphere-next-actions");
      expect(actionsList?.classList.contains("flow-gtd-sphere-actions-hidden")).toBe(false);
      expect(toggleButton?.textContent).toContain("Hide");
    });

    it("should hide general next actions when toggle is clicked", async () => {
      mockScanner.scanProjects.mockResolvedValue([]);

      const nextActionsContent = `
# Next Actions

- [ ] Call dentist #sphere/work
- [ ] Schedule meeting #sphere/work
`;

      const mockFile = new TFile("Next actions.md");
      app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      app.vault.read = jest.fn().mockResolvedValue(nextActionsContent);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const toggleButton = container.querySelector(
        ".flow-gtd-sphere-actions-toggle"
      ) as HTMLElement;

      // Click the toggle button
      toggleButton?.click();

      const generalActionsList = container.querySelectorAll(".flow-gtd-sphere-next-actions");
      generalActionsList.forEach((list) => {
        expect(list.classList.contains("flow-gtd-sphere-actions-hidden")).toBe(true);
      });
    });
  });

  describe("priority separators", () => {
    it("should render separators between different priority groups", async () => {
      const priority1Project = {
        file: "Projects/p1.md",
        title: "Priority 1 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["P1 action"],
        mtime: Date.now(),
      };

      const priority2Project = {
        file: "Projects/p2.md",
        title: "Priority 2 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["P2 action"],
        mtime: Date.now(),
      };

      const priority3Project = {
        file: "Projects/p3.md",
        title: "Priority 3 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 3,
        nextActions: ["P3 action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([
        priority1Project,
        priority2Project,
        priority3Project,
      ]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const separators = container.querySelectorAll(".flow-gtd-sphere-priority-separator");

      // Should have 2 separators (between P1->P2 and P2->P3)
      expect(separators.length).toBe(2);

      // Check separator labels
      const labels = Array.from(separators).map(
        (sep) => sep.querySelector(".flow-gtd-sphere-priority-separator-label")?.textContent
      );
      expect(labels).toEqual(["P2", "P3"]);
    });

    it("should not render separator before the first project", async () => {
      const priority1Project = {
        file: "Projects/p1.md",
        title: "Priority 1 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["P1 action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([priority1Project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const separators = container.querySelectorAll(".flow-gtd-sphere-priority-separator");

      // Should have no separators for a single project
      expect(separators.length).toBe(0);
    });

    it("should render separator when transitioning from priority to no priority", async () => {
      const priority1Project = {
        file: "Projects/p1.md",
        title: "Priority 1 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["P1 action"],
        mtime: Date.now(),
      };

      const noPriorityProject = {
        file: "Projects/no-priority.md",
        title: "No Priority Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: null,
        nextActions: ["Action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([priority1Project, noPriorityProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const separators = container.querySelectorAll(".flow-gtd-sphere-priority-separator");

      // Should have 1 separator between priority and no-priority
      expect(separators.length).toBe(1);
      const label = separators[0].querySelector(
        ".flow-gtd-sphere-priority-separator-label"
      )?.textContent;
      expect(label).toBe("No Priority");
    });
  });

  describe("P1 project highlighting", () => {
    it("should add P1 CSS class to priority 1 projects", async () => {
      const priority1Project = {
        file: "Projects/p1.md",
        title: "Priority 1 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 1,
        nextActions: ["P1 action"],
        mtime: Date.now(),
      };

      const priority2Project = {
        file: "Projects/p2.md",
        title: "Priority 2 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["P2 action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([priority1Project, priority2Project]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const projects = container.querySelectorAll(".flow-gtd-sphere-project");

      // First project (P1) should have the P1 class
      expect(projects[0].classList.contains("flow-gtd-sphere-project-p1")).toBe(true);

      // Second project (P2) should NOT have the P1 class
      expect(projects[1].classList.contains("flow-gtd-sphere-project-p1")).toBe(false);
    });

    it("should not add P1 CSS class to projects with other priorities", async () => {
      const priority2Project = {
        file: "Projects/p2.md",
        title: "Priority 2 Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: 2,
        nextActions: ["P2 action"],
        mtime: Date.now(),
      };

      const noPriorityProject = {
        file: "Projects/no-priority.md",
        title: "No Priority Project",
        tags: ["project/work"],
        status: "live" as const,
        priority: null,
        nextActions: ["Action"],
        mtime: Date.now(),
      };

      mockScanner.scanProjects.mockResolvedValue([priority2Project, noPriorityProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const projects = container.querySelectorAll(".flow-gtd-sphere-project");

      // Neither project should have the P1 class
      projects.forEach((project) => {
        expect(project.classList.contains("flow-gtd-sphere-project-p1")).toBe(false);
      });
    });

    it("should apply P1 highlighting to sub-projects with priority 1", async () => {
      // When child has P1 and parent has P2, child appears first (in P1 section)
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

      mockScanner.scanProjects.mockResolvedValue([parentProject, childProject]);

      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.onOpen();

      const container = view.containerEl.children[1] as HTMLElement;
      const projects = container.querySelectorAll(".flow-gtd-sphere-project");

      // Child (P1) appears first and has P1 class
      expect(projects[0].classList.contains("flow-gtd-sphere-project-p1")).toBe(true);

      // Parent (P2) appears second and should NOT have P1 class
      expect(projects[1].classList.contains("flow-gtd-sphere-project-p1")).toBe(false);
    });
  });

  describe("view state persistence", () => {
    it("should persist searchQuery in getState", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Set search query
      (view as any).searchQuery = "test query";

      const state = view.getState();

      expect(state.searchQuery).toBe("test query");
    });

    it("should persist showNextActions in getState", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Set showNextActions to false
      (view as any).showNextActions = false;

      const state = view.getState();

      expect(state.showNextActions).toBe(false);
    });

    it("should persist sphere in getState", () => {
      const view = new SphereView(leaf, "personal", settings, mockSaveSettings);
      view.app = app;

      const state = view.getState();

      expect(state.sphere).toBe("personal");
    });

    it("should restore searchQuery from setState", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.setState({ searchQuery: "restored query" }, {});

      expect((view as any).searchQuery).toBe("restored query");
    });

    it("should restore showNextActions from setState", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.setState({ showNextActions: false }, {});

      expect((view as any).showNextActions).toBe(false);
    });

    it("should restore sphere from setState", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      await view.setState({ sphere: "personal" }, {});

      expect((view as any).sphere).toBe("personal");
    });

    it("should handle partial state in setState", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      // Set initial values
      (view as any).searchQuery = "initial";
      (view as any).showNextActions = false;

      // Restore only searchQuery
      await view.setState({ searchQuery: "updated" }, {});

      // searchQuery should be updated, showNextActions should remain
      expect((view as any).searchQuery).toBe("updated");
      expect((view as any).showNextActions).toBe(false);
    });

    it("should refresh view after setState when sphere changes", async () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      const onOpenSpy = jest.spyOn(view, "onOpen").mockResolvedValue();

      await view.setState({ sphere: "personal" }, {});

      expect(onOpenSpy).toHaveBeenCalled();
      onOpenSpy.mockRestore();
    });

    it("should persist all state properties together", () => {
      const view = new SphereView(leaf, "work", settings, mockSaveSettings);
      view.app = app;

      (view as any).searchQuery = "my search";
      (view as any).showNextActions = false;

      const state = view.getState();

      expect(state).toEqual({
        sphere: "work",
        searchQuery: "my search",
        showNextActions: false,
      });
    });
  });
});
