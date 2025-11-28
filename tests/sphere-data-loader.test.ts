// ABOUTME: Tests for sphere data loading extracted from sphere-view.ts
// ABOUTME: Covers project filtering, hierarchy building, and general action extraction

import { SphereDataLoader, SphereViewData, SphereProjectSummary } from "../src/sphere-data-loader";
import { FlowProject } from "../src/types";
import { TFile, Vault, App } from "obsidian";

// Mock the flow scanner
jest.mock("../src/flow-scanner", () => ({
  FlowProjectScanner: jest.fn().mockImplementation(() => ({
    scanProjects: jest.fn(),
  })),
}));

describe("SphereDataLoader", () => {
  let mockApp: App;
  let mockVault: Vault;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    } as unknown as Vault;

    mockApp = {
      vault: mockVault,
    } as unknown as App;
  });

  describe("loadSphereData", () => {
    it("should filter projects by sphere tag", async () => {
      const loader = new SphereDataLoader(mockApp, "work", {
        nextActionsFilePath: "Next actions.md",
        projectTemplateFilePath: "Templates/Project.md",
      } as any);

      // Mock scanner to return test projects
      const mockProjects: FlowProject[] = [
        {
          title: "Work Project",
          file: "Projects/work-project.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: ["Do work thing"],
        },
        {
          title: "Personal Project",
          file: "Projects/personal-project.md",
          tags: ["project/personal"],
          status: "live",
          priority: 2,
          nextActions: ["Do personal thing"],
        },
      ];

      (loader as any).scanner.scanProjects.mockResolvedValue(mockProjects);
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const data = await loader.loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.title).toBe("Work Project");
    });

    it("should exclude projects with non-live status", async () => {
      const loader = new SphereDataLoader(mockApp, "work", {
        nextActionsFilePath: "Next actions.md",
        projectTemplateFilePath: "Templates/Project.md",
      } as any);

      const mockProjects: FlowProject[] = [
        {
          title: "Live Project",
          file: "Projects/live.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: [],
        },
        {
          title: "Someday Project",
          file: "Projects/someday.md",
          tags: ["project/work"],
          status: "someday",
          priority: 2,
          nextActions: [],
        },
      ];

      (loader as any).scanner.scanProjects.mockResolvedValue(mockProjects);
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const data = await loader.loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.title).toBe("Live Project");
    });

    it("should exclude template files", async () => {
      const loader = new SphereDataLoader(mockApp, "work", {
        nextActionsFilePath: "Next actions.md",
        projectTemplateFilePath: "Templates/Project.md",
      } as any);

      const mockProjects: FlowProject[] = [
        {
          title: "Real Project",
          file: "Projects/real.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: [],
        },
        {
          title: "Template",
          file: "Templates/Project.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: [],
        },
      ];

      (loader as any).scanner.scanProjects.mockResolvedValue(mockProjects);
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const data = await loader.loadSphereData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].project.title).toBe("Real Project");
    });

    it("should identify projects needing next actions", async () => {
      const loader = new SphereDataLoader(mockApp, "work", {
        nextActionsFilePath: "Next actions.md",
        projectTemplateFilePath: "Templates/Project.md",
      } as any);

      const mockProjects: FlowProject[] = [
        {
          title: "Has Actions",
          file: "Projects/has-actions.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: ["Do something"],
        },
        {
          title: "No Actions",
          file: "Projects/no-actions.md",
          tags: ["project/work"],
          status: "live",
          priority: 2,
          nextActions: [],
        },
      ];

      (loader as any).scanner.scanProjects.mockResolvedValue(mockProjects);
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const data = await loader.loadSphereData();

      expect(data.projectsNeedingNextActions).toHaveLength(1);
      expect(data.projectsNeedingNextActions[0].project.title).toBe("No Actions");
    });

    it("should sort projects by priority", async () => {
      const loader = new SphereDataLoader(mockApp, "work", {
        nextActionsFilePath: "Next actions.md",
        projectTemplateFilePath: "Templates/Project.md",
      } as any);

      const mockProjects: FlowProject[] = [
        {
          title: "Low Priority",
          file: "Projects/low.md",
          tags: ["project/work"],
          status: "live",
          priority: 3,
          nextActions: [],
        },
        {
          title: "High Priority",
          file: "Projects/high.md",
          tags: ["project/work"],
          status: "live",
          priority: 1,
          nextActions: [],
        },
        {
          title: "Medium Priority",
          file: "Projects/medium.md",
          tags: ["project/work"],
          status: "live",
          priority: 2,
          nextActions: [],
        },
      ];

      (loader as any).scanner.scanProjects.mockResolvedValue(mockProjects);
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const data = await loader.loadSphereData();

      expect(data.projects[0].project.title).toBe("High Priority");
      expect(data.projects[1].project.title).toBe("Medium Priority");
      expect(data.projects[2].project.title).toBe("Low Priority");
    });
  });

  describe("filterData", () => {
    it("should return unfiltered data when query is empty", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const data: SphereViewData = {
        projects: [{ project: { title: "Project A" } as FlowProject, priority: 1, depth: 0 }],
        projectsNeedingNextActions: [],
        generalNextActions: ["Action 1"],
      };

      const filtered = loader.filterData(data, "");

      expect(filtered).toEqual(data);
    });

    it("should filter projects by name match", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const data: SphereViewData = {
        projects: [
          {
            project: { title: "Website Redesign", nextActions: [] } as FlowProject,
            priority: 1,
            depth: 0,
          },
          {
            project: { title: "App Development", nextActions: [] } as FlowProject,
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const filtered = loader.filterData(data, "website");

      expect(filtered.projects).toHaveLength(1);
      expect(filtered.projects[0].project.title).toBe("Website Redesign");
    });

    it("should filter projects by action match", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const data: SphereViewData = {
        projects: [
          {
            project: { title: "Project A", nextActions: ["Call dentist"] } as FlowProject,
            priority: 1,
            depth: 0,
          },
          {
            project: { title: "Project B", nextActions: ["Email client"] } as FlowProject,
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const filtered = loader.filterData(data, "dentist");

      expect(filtered.projects).toHaveLength(1);
      expect(filtered.projects[0].project.title).toBe("Project A");
      // Should only include matching actions
      expect(filtered.projects[0].project.nextActions).toEqual(["Call dentist"]);
    });

    it("should filter general next actions", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const data: SphereViewData = {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: ["Buy groceries", "Call mom", "Fix bug"],
      };

      const filtered = loader.filterData(data, "call");

      expect(filtered.generalNextActions).toHaveLength(1);
      expect(filtered.generalNextActions[0]).toBe("Call mom");
    });

    it("should be case-insensitive", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const data: SphereViewData = {
        projects: [
          {
            project: { title: "UPPERCASE PROJECT", nextActions: [] } as FlowProject,
            priority: 1,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: ["lowercase action"],
      };

      const filtered = loader.filterData(data, "UPPERCASE");
      expect(filtered.projects).toHaveLength(1);

      const filtered2 = loader.filterData(data, "LOWERCASE");
      expect(filtered2.generalNextActions).toHaveLength(1);
    });
  });

  describe("extractGeneralNextActions", () => {
    it("should extract actions tagged with the sphere", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const content = `# Next Actions

- [ ] Call client about project #sphere/work
- [ ] Buy groceries #sphere/personal
- [ ] Review PR #sphere/work`;

      const actions = loader.extractGeneralNextActions(content);

      expect(actions).toHaveLength(2);
      expect(actions).toContain("Call client about project");
      expect(actions).toContain("Review PR");
    });

    it("should skip completed items", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const content = `# Next Actions

- [ ] Pending task #sphere/work
- [x] Completed task #sphere/work
- [X] Also completed #sphere/work`;

      const actions = loader.extractGeneralNextActions(content);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toBe("Pending task");
    });

    it("should include waiting-for items", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const content = `# Next Actions

- [ ] Regular task #sphere/work
- [w] Waiting for response #sphere/work`;

      const actions = loader.extractGeneralNextActions(content);

      expect(actions).toHaveLength(2);
      expect(actions).toContain("Regular task");
      expect(actions).toContain("Waiting for response");
    });

    it("should handle case-insensitive sphere tags", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const content = `# Next Actions

- [ ] Task one #sphere/Work
- [ ] Task two #sphere/WORK
- [ ] Task three #Sphere/work`;

      const actions = loader.extractGeneralNextActions(content);

      expect(actions).toHaveLength(3);
    });

    it("should remove sphere tag from action text", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      const content = `- [ ] Call client #sphere/work about meeting`;

      const actions = loader.extractGeneralNextActions(content);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toBe("Call client about meeting");
    });
  });

  describe("normalizePriority", () => {
    it("should return number for valid priority", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.normalizePriority(1)).toBe(1);
      expect(loader.normalizePriority(5)).toBe(5);
    });

    it("should return null for undefined priority", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.normalizePriority(undefined)).toBeNull();
    });

    it("should return null for non-finite numbers", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.normalizePriority(NaN)).toBeNull();
      expect(loader.normalizePriority(Infinity)).toBeNull();
    });
  });

  describe("matchesSphereTag", () => {
    it("should match exact sphere", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.matchesSphereTag("project/work")).toBe(true);
      expect(loader.matchesSphereTag("#project/work")).toBe(true);
    });

    it("should not match different sphere", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.matchesSphereTag("project/personal")).toBe(false);
    });

    it("should be case-insensitive", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.matchesSphereTag("project/WORK")).toBe(true);
      expect(loader.matchesSphereTag("project/Work")).toBe(true);
    });

    it("should handle hyphenated spheres", () => {
      const loader = new SphereDataLoader(mockApp, "side-projects", {} as any);

      expect(loader.matchesSphereTag("project/side-projects")).toBe(true);
      expect(loader.matchesSphereTag("project/side projects")).toBe(true);
    });

    it("should reject non-project tags", () => {
      const loader = new SphereDataLoader(mockApp, "work", {} as any);

      expect(loader.matchesSphereTag("sphere/work")).toBe(false);
      expect(loader.matchesSphereTag("work")).toBe(false);
    });
  });
});
