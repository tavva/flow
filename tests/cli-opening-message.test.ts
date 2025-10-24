import { buildAnalysisPrompt } from "../src/cli";
import { SystemIssues } from "../src/system-analyzer";

describe("buildAnalysisPrompt", () => {
  it("should build prompt for issues detected", () => {
    const issues: SystemIssues = {
      stalledProjects: 3,
      inboxCount: 12,
      inboxNeedsAttention: true,
      hasIssues: true,
    };

    const prompt = buildAnalysisPrompt(issues);

    expect(prompt).toContain("Issues detected:");
    expect(prompt).toContain("3 projects have no next actions");
    expect(prompt).toContain("12 inbox items need processing");
    expect(prompt).toContain("suggest 3 numbered options to address them");
    expect(prompt).toContain("High-level counts only");
  });

  it("should build prompt for healthy system", () => {
    const issues: SystemIssues = {
      stalledProjects: 0,
      inboxCount: 3,
      inboxNeedsAttention: false,
      hasIssues: false,
    };

    const prompt = buildAnalysisPrompt(issues);

    expect(prompt).toContain("system looks healthy");
    expect(prompt).toContain("suggest 3 numbered options for proactive work");
    expect(prompt).not.toContain("Issues detected:");
  });

  it("should mention only stalled projects when inbox is fine", () => {
    const issues: SystemIssues = {
      stalledProjects: 5,
      inboxCount: 2,
      inboxNeedsAttention: false,
      hasIssues: true,
    };

    const prompt = buildAnalysisPrompt(issues);

    expect(prompt).toContain("5 projects have no next actions");
    expect(prompt).not.toContain("inbox items need processing");
  });

  it("should mention only inbox when no stalled projects", () => {
    const issues: SystemIssues = {
      stalledProjects: 0,
      inboxCount: 15,
      inboxNeedsAttention: true,
      hasIssues: true,
    };

    const prompt = buildAnalysisPrompt(issues);

    expect(prompt).toContain("15 inbox items need processing");
    expect(prompt).not.toContain("projects have no next actions");
  });
});
