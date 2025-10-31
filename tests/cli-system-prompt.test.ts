import { buildSystemPrompt } from "../src/cli";
import { GTDContext } from "../src/gtd-context-scanner";
import { FlowProject, ReviewProtocol } from "../src/types";

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

    expect(prompt).toContain("focus");
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

  it("should include opening message format guidance", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Opening Message Format:");
    expect(prompt).toContain("provide an opening summary");
    expect(prompt).toContain("exactly 3 numbered options");
    expect(prompt).toContain("Use high-level counts only");
    expect(prompt).toContain("never list specific project names in the opening");
  });

  it("should include weekly review protocol", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("Weekly Review Protocol:");
    expect(prompt).toContain("Process inbox to zero");
    expect(prompt).toContain("Review projects");
    expect(prompt).toContain("Review next actions");
    expect(prompt).toContain("Review someday/maybe");
    expect(prompt).toContain("Review waiting-for");
    expect(prompt).toContain("Set weekly focus");
    expect(prompt).toContain("Present relevant data");
    expect(prompt).toContain("Wait for acknowledgment before proceeding");
  });

  it("should include Flow System explanation", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).toContain("The Flow System:");
    expect(prompt).toContain("Flow is a GTD implementation for Obsidian");
    expect(prompt).toContain("Spheres:");
    expect(prompt).toContain("File Organisation:");
    expect(prompt).toContain("Project Structure:");
    expect(prompt).toContain("Priority: 1-5 scale");
    expect(prompt).toContain("1=highest priority, 5=lowest priority");
    expect(prompt).toContain("Project Statuses:");
    expect(prompt).toContain("live: Active projects");
  });
});

describe("CLI System Prompt - Custom Review Protocols", () => {
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

  it("should not include protocol content when no protocol provided", () => {
    const prompt = buildSystemPrompt(mockProjects, "work", mockContext);

    expect(prompt).not.toContain("Custom Review in Progress:");
    expect(prompt).not.toContain("Follow the protocol below:");
  });

  it("should include protocol content when protocol provided", () => {
    const protocol: ReviewProtocol = {
      filename: "friday-review.md",
      name: "Friday Afternoon Review",
      content: "# Friday Review\n\n1. Review personal projects\n2. Plan weekend",
    };

    const prompt = buildSystemPrompt(mockProjects, "work", mockContext, protocol);

    expect(prompt).toContain("Custom Review in Progress:");
    expect(prompt).toContain('The user has selected the "Friday Afternoon Review" review');
    expect(prompt).toContain("# Friday Review");
    expect(prompt).toContain("1. Review personal projects");
    expect(prompt).toContain("2. Plan weekend");
  });

  it("should instruct to follow protocol step-by-step", () => {
    const protocol: ReviewProtocol = {
      filename: "test.md",
      name: "Test Review",
      content: "Review content",
    };

    const prompt = buildSystemPrompt(mockProjects, "work", mockContext, protocol);

    expect(prompt).toContain("Follow this protocol step-by-step");
    expect(prompt).toContain("wait for the user to acknowledge before moving to the next step");
  });

  it("should include protocol with trigger metadata", () => {
    const protocol: ReviewProtocol = {
      filename: "monday.md",
      name: "Monday Review",
      trigger: {
        day: "monday",
        time: "morning",
      },
      content: "# Monday Morning\n\nStart the week right",
    };

    const prompt = buildSystemPrompt(mockProjects, "work", mockContext, protocol);

    expect(prompt).toContain("Monday Review");
    expect(prompt).toContain("# Monday Morning");
    expect(prompt).toContain("Start the week right");
  });

  it("should include protocol with spheres metadata", () => {
    const protocol: ReviewProtocol = {
      filename: "combined.md",
      name: "Combined Review",
      spheres: ["work", "personal"],
      content: "Review both spheres",
    };

    const prompt = buildSystemPrompt(mockProjects, "work", mockContext, protocol);

    expect(prompt).toContain("Combined Review");
    expect(prompt).toContain("Review both spheres");
  });
});
