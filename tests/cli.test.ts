import { parseCliArgs, loadPluginSettings, buildSystemPrompt } from "../src/cli";
import * as fs from "fs";
import { FlowProject, GTDContext } from "../src/types";

jest.mock("fs");

describe("CLI argument parsing", () => {
  it("should parse vault path and sphere", () => {
    const args = ["--vault", "/path/to/vault", "--sphere", "work"];
    const result = parseCliArgs(args);

    expect(result.vaultPath).toBe("/path/to/vault");
    expect(result.sphere).toBe("work");
  });

  it("should parse arguments in different order", () => {
    const args = ["--sphere", "work", "--vault", "/path/to/vault"];
    const result = parseCliArgs(args);

    expect(result.vaultPath).toBe("/path/to/vault");
    expect(result.sphere).toBe("work");
  });

  it("should throw error for empty argument array", () => {
    const args: string[] = [];

    expect(() => parseCliArgs(args)).toThrow("--vault is required");
  });

  it("should throw error if vault path missing", () => {
    const args = ["--sphere", "work"];

    expect(() => parseCliArgs(args)).toThrow("--vault is required");
  });

  it("should throw error if sphere missing", () => {
    const args = ["--vault", "/path/to/vault"];

    expect(() => parseCliArgs(args)).toThrow("--sphere is required");
  });

  it("should throw error if vault argument has no value", () => {
    const args = ["--vault"];

    expect(() => parseCliArgs(args)).toThrow("--vault is required");
  });

  it("should throw error if sphere argument has no value", () => {
    const args = ["--vault", "/path/to/vault", "--sphere"];

    expect(() => parseCliArgs(args)).toThrow("--sphere is required");
  });

  it("should throw error if vault is last argument without value", () => {
    const args = ["--sphere", "work", "--vault"];

    expect(() => parseCliArgs(args)).toThrow("--vault is required");
  });
});

describe("Plugin settings loading", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should load settings from Obsidian plugin data.json", () => {
    const mockSettings = {
      llmProvider: "anthropic",
      anthropicApiKey: "test-key",
      anthropicModel: "claude-sonnet-4-20250514",
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

    const result = loadPluginSettings("/path/to/vault");

    expect(fs.readFileSync).toHaveBeenCalledWith(
      "/path/to/vault/.obsidian/plugins/flow/data.json",
      "utf-8"
    );
    expect(result.llmProvider).toBe("anthropic");
    expect(result.anthropicApiKey).toBe("test-key");
  });

  it("should throw error if settings file does not exist", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    expect(() => loadPluginSettings("/path/to/vault")).toThrow("Plugin settings not found");
  });

  it("should throw error if Anthropic API key is missing", () => {
    const mockSettings = {
      llmProvider: "anthropic",
      anthropicModel: "claude-sonnet-4-20250514",
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

    expect(() => loadPluginSettings("/path/to/vault")).toThrow("API key not configured");
  });

  it("should throw error if OpenAI-compatible API key is missing", () => {
    const mockSettings = {
      llmProvider: "openai-compatible",
      openaiBaseUrl: "https://api.openai.com/v1",
      openaiModel: "gpt-4",
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

    expect(() => loadPluginSettings("/path/to/vault")).toThrow("API key not configured");
  });

  it("should throw error if settings file contains malformed JSON", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("{ invalid json }");

    expect(() => loadPluginSettings("/path/to/vault")).toThrow();
  });
});

describe("System prompt generation", () => {
  it("should include warning for paused projects and instruction not to add actions to them", () => {
    const liveProject: FlowProject = {
      file: "Projects/Active Task.md",
      title: "Active Task",
      description: "Currently active project",
      priority: 1,
      tags: ["project/work"],
      status: "live",
      nextActions: ["Complete the report"],
    };

    const pausedProject: FlowProject = {
      file: "Projects/Paused Task.md",
      title: "Paused Task",
      description: "On hold for now",
      priority: 2,
      tags: ["project/work"],
      status: "hold",
      nextActions: ["Resume when ready"],
    };

    const gtdContext: GTDContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };

    const prompt = buildSystemPrompt([liveProject, pausedProject], "work", gtdContext);

    // Verify the prompt includes an instruction not to add actions to non-live projects
    expect(prompt).toContain("only add actions to projects with status 'live'");

    // Verify paused projects are marked with a warning
    expect(prompt).toMatch(/Paused Task[\s\S]*?⚠️.*?paused.*?do not add actions/i);
  });

  it("should not include warning for live projects", () => {
    const liveProject: FlowProject = {
      file: "Projects/Active Task.md",
      title: "Active Task",
      description: "Currently active project",
      priority: 1,
      tags: ["project/work"],
      status: "live",
      nextActions: ["Complete the report"],
    };

    const gtdContext: GTDContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };

    const prompt = buildSystemPrompt([liveProject], "work", gtdContext);

    // Verify live projects don't have the paused warning
    expect(prompt).not.toMatch(/Active Task[\s\S]*?⚠️.*?paused/i);
  });
});
