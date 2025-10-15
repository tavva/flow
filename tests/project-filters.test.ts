import { filterTemplates, filterLiveProjects, filterLiveNonTemplateProjects } from "../src/project-filters";
import { FlowProject } from "../src/types";

describe("project-filters", () => {
  const mockProjects: FlowProject[] = [
    {
      file: "live-project.md",
      title: "Live Project",
      tags: ["project/personal"],
      status: "live",
      nextActions: ["Do something"],
    },
    {
      file: "Templates/Project.md",
      title: "Project Template",
      tags: ["project/template"],
      status: "live",
      nextActions: [],
    },
    {
      file: "Templates/SubFolder/Another.md",
      title: "Another Template",
      tags: ["project/template"],
      status: "live",
      nextActions: [],
    },
    {
      file: "Custom Template.md",
      title: "Custom Template",
      tags: ["project/work"],
      status: "live",
      nextActions: [],
    },
    {
      file: "paused-project.md",
      title: "Paused Project",
      tags: ["project/work"],
      status: "paused",
      nextActions: ["Old action"],
    },
    {
      file: "no-status-project.md",
      title: "No Status Project",
      tags: ["project/personal"],
      nextActions: ["Action"],
    },
  ];

  describe("filterTemplates", () => {
    it("should filter out projects in Templates/ folder", () => {
      const result = filterTemplates(mockProjects, "NonExistent.md");

      const filePaths = result.map((p) => p.file);
      expect(filePaths).not.toContain("Templates/Project.md");
      expect(filePaths).not.toContain("Templates/SubFolder/Another.md");
      expect(filePaths).toContain("live-project.md");
      expect(filePaths).toContain("Custom Template.md");
    });

    it("should filter out the configured template file", () => {
      const result = filterTemplates(mockProjects, "Custom Template.md");

      const filePaths = result.map((p) => p.file);
      expect(filePaths).not.toContain("Custom Template.md");
      expect(filePaths).toContain("live-project.md");
    });

    it("should handle empty template file path", () => {
      const result = filterTemplates(mockProjects, "");

      const filePaths = result.map((p) => p.file);
      expect(filePaths).not.toContain("Templates/Project.md");
      expect(filePaths).toContain("Custom Template.md");
      expect(result.length).toBe(4); // All except Templates/
    });

    it("should return all projects if no templates match", () => {
      const nonTemplateProjects: FlowProject[] = [
        {
          file: "project1.md",
          title: "Project 1",
          tags: ["project/personal"],
          nextActions: [],
        },
        {
          file: "project2.md",
          title: "Project 2",
          tags: ["project/work"],
          nextActions: [],
        },
      ];

      const result = filterTemplates(nonTemplateProjects, "NonExistent.md");

      expect(result).toEqual(nonTemplateProjects);
    });
  });

  describe("filterLiveProjects", () => {
    it("should include projects with 'live' status", () => {
      const result = filterLiveProjects(mockProjects);

      const statuses = result.map((p) => p.status);
      expect(statuses).toContain("live");
    });

    it("should include projects with no status", () => {
      const result = filterLiveProjects(mockProjects);

      const filePaths = result.map((p) => p.file);
      expect(filePaths).toContain("no-status-project.md");
    });

    it("should exclude projects with non-live status", () => {
      const result = filterLiveProjects(mockProjects);

      const filePaths = result.map((p) => p.file);
      expect(filePaths).not.toContain("paused-project.md");
    });

    it("should handle empty status string as live", () => {
      const projectsWithEmptyStatus: FlowProject[] = [
        {
          file: "empty-status.md",
          title: "Empty Status",
          tags: ["project/personal"],
          status: "",
          nextActions: [],
        },
      ];

      const result = filterLiveProjects(projectsWithEmptyStatus);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("empty-status.md");
    });

    it("should handle whitespace-only status as live", () => {
      const projectsWithWhitespaceStatus: FlowProject[] = [
        {
          file: "whitespace-status.md",
          title: "Whitespace Status",
          tags: ["project/personal"],
          status: "   ",
          nextActions: [],
        },
      ];

      const result = filterLiveProjects(projectsWithWhitespaceStatus);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("whitespace-status.md");
    });
  });

  describe("filterLiveNonTemplateProjects", () => {
    it("should filter out both templates and non-live projects", () => {
      const result = filterLiveNonTemplateProjects(mockProjects, "Custom Template.md");

      const filePaths = result.map((p) => p.file);

      // Should include live, non-template projects
      expect(filePaths).toContain("live-project.md");
      expect(filePaths).toContain("no-status-project.md");

      // Should exclude templates
      expect(filePaths).not.toContain("Templates/Project.md");
      expect(filePaths).not.toContain("Templates/SubFolder/Another.md");
      expect(filePaths).not.toContain("Custom Template.md");

      // Should exclude non-live projects
      expect(filePaths).not.toContain("paused-project.md");
    });

    it("should return empty array when all projects are templates or non-live", () => {
      const allTemplatesOrPaused: FlowProject[] = [
        {
          file: "Templates/Template.md",
          title: "Template",
          tags: ["project/template"],
          status: "live",
          nextActions: [],
        },
        {
          file: "paused.md",
          title: "Paused",
          tags: ["project/work"],
          status: "paused",
          nextActions: [],
        },
      ];

      const result = filterLiveNonTemplateProjects(allTemplatesOrPaused, "");

      expect(result).toEqual([]);
    });

    it("should handle empty input array", () => {
      const result = filterLiveNonTemplateProjects([], "Templates/Project.md");

      expect(result).toEqual([]);
    });
  });
});
