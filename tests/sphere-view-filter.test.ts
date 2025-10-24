import { FlowProject } from "../src/types";

describe("SphereView filtering", () => {
  describe("filterData", () => {
    it("should return all data when query is empty", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Test Project",
              nextActions: ["Action 1", "Action 2"],
              tags: ["project/work"],
              status: "live" as const,
              file: "test.md",
            },
            priority: 1,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: ["General action"],
      };

      // Access private method via any cast for testing
      const view = createMockSphereView();
      const result = (view as any).filterData(data, "");

      expect(result).toEqual(data);
    });

    it("should filter projects by action text (case-insensitive)", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Project One",
              nextActions: ["Call dentist", "Email client"],
              tags: ["project/work"],
              status: "live" as const,
              file: "one.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Project Two",
              nextActions: ["Review code", "Write tests"],
              tags: ["project/work"],
              status: "live" as const,
              file: "two.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "DENTIST");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Project One");
      expect(result.projects[0].project.nextActions).toEqual(["Call dentist"]);
    });

    it("should filter projects by project name", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Marketing Campaign",
              nextActions: ["Create landing page"],
              tags: ["project/work"],
              status: "live" as const,
              file: "marketing.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Engineering Sprint",
              nextActions: ["Fix bug"],
              tags: ["project/work"],
              status: "live" as const,
              file: "engineering.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "marketing");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Marketing Campaign");
    });

    it("should filter general actions", () => {
      const data = {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: ["Buy groceries", "Call dentist", "Review email"],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "dentist");

      expect(result.generalNextActions).toEqual(["Call dentist"]);
    });

    it("should not filter projectsNeedingNextActions", () => {
      const needsActions = [
        {
          project: {
            title: "Empty Project",
            nextActions: [],
            tags: ["project/work"],
            status: "live" as const,
            file: "empty.md",
          },
          priority: 1,
          depth: 0,
        },
      ];

      const data = {
        projects: [],
        projectsNeedingNextActions: needsActions,
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "something");

      expect(result.projectsNeedingNextActions).toEqual(needsActions);
    });
  });
});

// Helper to create mock SphereView for testing
function createMockSphereView() {
  const mockLeaf = {} as any;
  const mockSettings = {
    nextActionsFilePath: "Next actions.md",
    hotlist: [],
  } as any;
  const mockSaveSettings = jest.fn();

  // Import SphereView and create instance
  const { SphereView } = require("../src/sphere-view");
  return new SphereView(mockLeaf, "work", mockSettings, mockSaveSettings);
}
