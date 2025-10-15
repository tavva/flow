// ABOUTME: Tests for project hierarchy building, cycle detection, and display utilities.
// ABOUTME: Validates tree construction, depth calculation, and action aggregation.

import {
  buildProjectHierarchy,
  flattenHierarchy,
  extractParentPath,
  getProjectDisplayName,
  ProjectNode,
} from "../src/project-hierarchy";
import { FlowProject } from "../src/types";

describe("extractParentPath", () => {
  it("should extract path from wikilink with brackets", () => {
    expect(extractParentPath("[[Parent Project]]")).toBe("Parent Project.md");
  });

  it("should handle wikilink with folder path", () => {
    expect(extractParentPath("[[Projects/Parent Project]]")).toBe("Projects/Parent Project.md");
  });

  it("should handle wikilink that already has .md extension", () => {
    expect(extractParentPath("[[Parent Project.md]]")).toBe("Parent Project.md");
  });

  it("should return null for empty string", () => {
    expect(extractParentPath("")).toBeNull();
  });

  it("should return null for just brackets", () => {
    expect(extractParentPath("[[]]")).toBeNull();
  });

  it("should handle whitespace inside brackets", () => {
    expect(extractParentPath("[[  Parent Project  ]]")).toBe("Parent Project.md");
  });
});

describe("buildProjectHierarchy", () => {
  it("should create root nodes for projects without parents", () => {
    const projects: FlowProject[] = [
      {
        file: "Project A.md",
        title: "Project A",
        tags: ["project/work"],
        nextActions: ["Action A1"],
        mtime: Date.now(),
      },
      {
        file: "Project B.md",
        title: "Project B",
        tags: ["project/work"],
        nextActions: ["Action B1"],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy).toHaveLength(2);
    expect(hierarchy[0].project.file).toBe("Project A.md");
    expect(hierarchy[1].project.file).toBe("Project B.md");
    expect(hierarchy[0].depth).toBe(0);
    expect(hierarchy[1].depth).toBe(0);
    expect(hierarchy[0].children).toHaveLength(0);
    expect(hierarchy[1].children).toHaveLength(0);
  });

  it("should build parent-child relationships correctly", () => {
    const projects: FlowProject[] = [
      {
        file: "Parent.md",
        title: "Parent",
        tags: ["project/work"],
        nextActions: ["Parent Action"],
        mtime: Date.now(),
      },
      {
        file: "Child.md",
        title: "Child",
        tags: ["project/work"],
        parentProject: "[[Parent]]",
        nextActions: ["Child Action"],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].project.file).toBe("Parent.md");
    expect(hierarchy[0].children).toHaveLength(1);
    expect(hierarchy[0].children[0].project.file).toBe("Child.md");
  });

  it("should calculate depth correctly for nested projects", () => {
    const projects: FlowProject[] = [
      {
        file: "Root.md",
        title: "Root",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "Level1.md",
        title: "Level 1",
        tags: ["project/work"],
        parentProject: "[[Root]]",
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "Level2.md",
        title: "Level 2",
        tags: ["project/work"],
        parentProject: "[[Level1]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy[0].depth).toBe(0); // Root
    expect(hierarchy[0].children[0].depth).toBe(1); // Level 1
    expect(hierarchy[0].children[0].children[0].depth).toBe(2); // Level 2
  });

  it("should aggregate next actions from all descendants", () => {
    const projects: FlowProject[] = [
      {
        file: "Parent.md",
        title: "Parent",
        tags: ["project/work"],
        nextActions: ["Parent Action"],
        mtime: Date.now(),
      },
      {
        file: "Child1.md",
        title: "Child 1",
        tags: ["project/work"],
        parentProject: "[[Parent]]",
        nextActions: ["Child1 Action"],
        mtime: Date.now(),
      },
      {
        file: "Child2.md",
        title: "Child 2",
        tags: ["project/work"],
        parentProject: "[[Parent]]",
        nextActions: ["Child2 Action"],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy[0].allNextActions).toEqual([
      "Parent Action",
      "Child1 Action",
      "Child2 Action",
    ]);
  });

  it("should detect and prevent direct cycles", () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    const projects: FlowProject[] = [
      {
        file: "A.md",
        title: "A",
        tags: ["project/work"],
        parentProject: "[[B]]",
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "B.md",
        title: "B",
        tags: ["project/work"],
        parentProject: "[[A]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    // Both should be roots (cycle prevented)
    expect(hierarchy).toHaveLength(2);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should detect and prevent indirect cycles", () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    const projects: FlowProject[] = [
      {
        file: "A.md",
        title: "A",
        tags: ["project/work"],
        parentProject: "[[C]]",
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "B.md",
        title: "B",
        tags: ["project/work"],
        parentProject: "[[A]]",
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "C.md",
        title: "C",
        tags: ["project/work"],
        parentProject: "[[B]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    // At least one should be treated as root (cycle broken)
    expect(hierarchy.length).toBeGreaterThan(0);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should treat projects with missing parents as roots", () => {
    const projects: FlowProject[] = [
      {
        file: "Child.md",
        title: "Child",
        tags: ["project/work"],
        parentProject: "[[NonExistent]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].project.file).toBe("Child.md");
    expect(hierarchy[0].depth).toBe(0);
  });

  it("should treat projects with invalid parent links as roots", () => {
    const projects: FlowProject[] = [
      {
        file: "Child.md",
        title: "Child",
        tags: ["project/work"],
        parentProject: "[[]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].project.file).toBe("Child.md");
    expect(hierarchy[0].depth).toBe(0);
  });

  it("should support title-based wikilinks when title doesn't match filename", () => {
    const projects: FlowProject[] = [
      {
        file: "Projects/parent-project-file.md",
        title: "Parent Project Title",
        tags: ["project/work"],
        nextActions: ["Parent Action"],
        mtime: Date.now(),
      },
      {
        file: "Projects/child-project-file.md",
        title: "Child Project Title",
        tags: ["project/work"],
        parentProject: "[[Parent Project Title]]", // Using title, not filename
        nextActions: ["Child Action"],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    // Should correctly build hierarchy even though wikilink uses title, not filename
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].project.file).toBe("Projects/parent-project-file.md");
    expect(hierarchy[0].children).toHaveLength(1);
    expect(hierarchy[0].children[0].project.file).toBe("Projects/child-project-file.md");
    expect(hierarchy[0].children[0].depth).toBe(1);
  });

  it("should handle multiple root projects with children", () => {
    const projects: FlowProject[] = [
      {
        file: "Root1.md",
        title: "Root 1",
        tags: ["project/work"],
        nextActions: ["Root1 Action"],
        mtime: Date.now(),
      },
      {
        file: "Root1Child.md",
        title: "Root 1 Child",
        tags: ["project/work"],
        parentProject: "[[Root1]]",
        nextActions: ["Root1Child Action"],
        mtime: Date.now(),
      },
      {
        file: "Root2.md",
        title: "Root 2",
        tags: ["project/personal"],
        nextActions: ["Root2 Action"],
        mtime: Date.now(),
      },
      {
        file: "Root2Child.md",
        title: "Root 2 Child",
        tags: ["project/personal"],
        parentProject: "[[Root2]]",
        nextActions: ["Root2Child Action"],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);

    expect(hierarchy).toHaveLength(2);
    expect(hierarchy[0].children).toHaveLength(1);
    expect(hierarchy[1].children).toHaveLength(1);
  });
});

describe("flattenHierarchy", () => {
  it("should flatten a single root node", () => {
    const root: ProjectNode = {
      project: {
        file: "Root.md",
        title: "Root",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [],
      depth: 0,
      allNextActions: [],
    };

    const flattened = flattenHierarchy([root]);

    expect(flattened).toHaveLength(1);
    expect(flattened[0].project.file).toBe("Root.md");
  });

  it("should flatten in depth-first order", () => {
    const child2: ProjectNode = {
      project: {
        file: "Child2.md",
        title: "Child 2",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [],
      depth: 1,
      allNextActions: [],
    };

    const child1: ProjectNode = {
      project: {
        file: "Child1.md",
        title: "Child 1",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [child2],
      depth: 1,
      allNextActions: [],
    };

    const root: ProjectNode = {
      project: {
        file: "Root.md",
        title: "Root",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [child1],
      depth: 0,
      allNextActions: [],
    };

    const flattened = flattenHierarchy([root]);

    expect(flattened).toHaveLength(3);
    expect(flattened[0].project.file).toBe("Root.md");
    expect(flattened[1].project.file).toBe("Child1.md");
    expect(flattened[2].project.file).toBe("Child2.md");
  });

  it("should preserve depth information", () => {
    const projects: FlowProject[] = [
      {
        file: "Root.md",
        title: "Root",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "Child.md",
        title: "Child",
        tags: ["project/work"],
        parentProject: "[[Root]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const hierarchy = buildProjectHierarchy(projects);
    const flattened = flattenHierarchy(hierarchy);

    expect(flattened[0].depth).toBe(0);
    expect(flattened[1].depth).toBe(1);
  });

  it("should handle multiple root nodes", () => {
    const root1: ProjectNode = {
      project: {
        file: "Root1.md",
        title: "Root 1",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [],
      depth: 0,
      allNextActions: [],
    };

    const root2: ProjectNode = {
      project: {
        file: "Root2.md",
        title: "Root 2",
        tags: ["project/personal"],
        nextActions: [],
        mtime: Date.now(),
      },
      children: [],
      depth: 0,
      allNextActions: [],
    };

    const flattened = flattenHierarchy([root1, root2]);

    expect(flattened).toHaveLength(2);
    expect(flattened[0].project.file).toBe("Root1.md");
    expect(flattened[1].project.file).toBe("Root2.md");
  });
});

describe("getProjectDisplayName", () => {
  it("should return just the title for projects without parents", () => {
    const projects: FlowProject[] = [
      {
        file: "Project.md",
        title: "My Project",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const displayName = getProjectDisplayName("Project.md", projects);

    expect(displayName.primary).toBe("My Project");
    expect(displayName.parent).toBeUndefined();
  });

  it("should return title and parent name for sub-projects", () => {
    const projects: FlowProject[] = [
      {
        file: "Parent.md",
        title: "Parent Project",
        tags: ["project/work"],
        nextActions: [],
        mtime: Date.now(),
      },
      {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        parentProject: "[[Parent]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const displayName = getProjectDisplayName("Child.md", projects);

    expect(displayName.primary).toBe("Child Project");
    expect(displayName.parent).toBe("Parent Project");
  });

  it("should handle missing parent project gracefully", () => {
    const projects: FlowProject[] = [
      {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        parentProject: "[[NonExistent]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const displayName = getProjectDisplayName("Child.md", projects);

    expect(displayName.primary).toBe("Child Project");
    expect(displayName.parent).toBe("NonExistent");
  });

  it("should handle project not found in list", () => {
    const projects: FlowProject[] = [];

    const displayName = getProjectDisplayName("Missing.md", projects);

    expect(displayName.primary).toBe("Missing.md");
    expect(displayName.parent).toBeUndefined();
  });

  it("should handle invalid parent link", () => {
    const projects: FlowProject[] = [
      {
        file: "Child.md",
        title: "Child Project",
        tags: ["project/work"],
        parentProject: "[[]]",
        nextActions: [],
        mtime: Date.now(),
      },
    ];

    const displayName = getProjectDisplayName("Child.md", projects);

    expect(displayName.primary).toBe("Child Project");
    expect(displayName.parent).toBeUndefined();
  });
});
