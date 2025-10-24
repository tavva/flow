import { SystemAnalyzer } from "../src/system-analyzer";
import { GTDContext } from "../src/gtd-context-scanner";
import { FlowProject } from "../src/types";

describe("SystemAnalyzer", () => {
  describe("analyze", () => {
    it("should detect stalled projects with no next actions", () => {
      const projects: FlowProject[] = [
        {
          file: "Project1.md",
          title: "Project 1",
          description: "",
          priority: 1,
          status: "live",
          tags: ["project/work"],
          nextActions: [],
          creationDate: "2025-01-01",
          milestones: undefined,
          parentProject: undefined,
        },
        {
          file: "Project2.md",
          title: "Project 2",
          description: "",
          priority: 2,
          status: "live",
          tags: ["project/work"],
          nextActions: ["Do something"],
          creationDate: "2025-01-01",
          milestones: undefined,
          parentProject: undefined,
        },
      ];

      const gtdContext: GTDContext = {
        nextActions: [],
        somedayItems: [],
        inboxItems: [],
      };

      const issues = SystemAnalyzer.analyze(gtdContext, projects);

      expect(issues.stalledProjects).toBe(1);
      expect(issues.hasIssues).toBe(true); // Stalled project is an issue
    });

    it("should flag inbox when count exceeds threshold", () => {
      const projects: FlowProject[] = [];
      const gtdContext: GTDContext = {
        nextActions: [],
        somedayItems: [],
        inboxItems: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6"],
      };

      const issues = SystemAnalyzer.analyze(gtdContext, projects, 5);

      expect(issues.inboxCount).toBe(6);
      expect(issues.inboxNeedsAttention).toBe(true);
      expect(issues.hasIssues).toBe(true);
    });

    it("should not flag inbox when count is at threshold", () => {
      const projects: FlowProject[] = [];
      const gtdContext: GTDContext = {
        nextActions: [],
        somedayItems: [],
        inboxItems: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
      };

      const issues = SystemAnalyzer.analyze(gtdContext, projects, 5);

      expect(issues.inboxCount).toBe(5);
      expect(issues.inboxNeedsAttention).toBe(false);
      expect(issues.hasIssues).toBe(false);
    });

    it("should set hasIssues when multiple issues present", () => {
      const projects: FlowProject[] = [
        {
          file: "Stalled.md",
          title: "Stalled Project",
          description: "",
          priority: 1,
          status: "live",
          tags: ["project/work"],
          nextActions: [],
          creationDate: "2025-01-01",
          milestones: undefined,
          parentProject: undefined,
        },
      ];

      const gtdContext: GTDContext = {
        nextActions: [],
        somedayItems: [],
        inboxItems: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6"],
      };

      const issues = SystemAnalyzer.analyze(gtdContext, projects, 5);

      expect(issues.stalledProjects).toBe(1);
      expect(issues.inboxNeedsAttention).toBe(true);
      expect(issues.hasIssues).toBe(true);
    });

    it("should handle empty projects and inbox", () => {
      const projects: FlowProject[] = [];
      const gtdContext: GTDContext = {
        nextActions: [],
        somedayItems: [],
        inboxItems: [],
      };

      const issues = SystemAnalyzer.analyze(gtdContext, projects);

      expect(issues.stalledProjects).toBe(0);
      expect(issues.inboxCount).toBe(0);
      expect(issues.inboxNeedsAttention).toBe(false);
      expect(issues.hasIssues).toBe(false);
    });
  });
});
