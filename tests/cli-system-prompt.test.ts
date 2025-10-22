import { buildSystemPrompt } from "../src/cli";
import { GTDContext } from "../src/gtd-context-scanner";
import { FlowProject } from "../src/types";

describe("CLI System Prompt - Tool Support", () => {
  const mockContext: GTDContext = {
    nextActions: [],
    somedayItems: [],
    inboxItems: [],
  };

  const mockProjects: FlowProject[] = [
    {
      file: "Projects/Test.md",
      title: "Test Project",
      description: "Test",
      priority: 2,
      tags: ["project/work"],
      status: "live",
      nextActions: ["First action"],
    },
  ];

  it("should not mention read-only", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).not.toContain("read-only");
    expect(prompt).not.toContain("You are read-only");
    expect(prompt).not.toContain("cannot edit files");
  });

  it("should mention ability to suggest and apply changes", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("suggest and apply changes");
  });

  it("should list tool capabilities", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("hotlist");
    expect(prompt).toContain("next actions");
    expect(prompt).toContain("project status");
  });

  it("should mention user approval", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("approve");
    expect(prompt).toContain("applied");
  });

  it("should instruct to use available tools", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("use the available tools");
  });

  it("should still include GTD coaching instructions", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("GTD");
    expect(prompt).toContain("coach");
    expect(prompt).toContain("prioritise");
  });

  it("should still include communication style", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Communication Style");
    expect(prompt).toContain("Ask questions only when");
  });

  it("should still include quality standards", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Quality Standards");
    expect(prompt).toContain("start with a verb");
  });

  it("should include project file paths for tool calls", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Test Project");
    expect(prompt).toContain("Projects/Test.md");
  });
});
