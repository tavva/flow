import { parseCliArgs, loadPluginSettings, buildSystemPrompt, runREPL } from "../src/cli";
import { FlowProject } from "../src/types";
import { GTDContext } from "../src/gtd-context-scanner";
import { LanguageModelClient } from "../src/language-model";
import * as fs from "fs";

jest.mock("fs");
jest.mock("readline");

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
      "/path/to/vault/.obsidian/plugins/flow-coach/data.json",
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
  it("should build prompt with project context", () => {
    const projects: FlowProject[] = [
      {
        title: "Mobile App",
        description: "Rebuild mobile app with React Native",
        priority: 1,
        status: "live",
        tags: ["project/work"],
        nextActions: ["Set up React Native development environment", "Design authentication flow"],
        file: "Projects/Mobile App.md",
      },
      {
        title: "Hiring",
        description: "Hire senior designer for product team",
        priority: 2,
        status: "live",
        tags: ["project/work"],
        nextActions: ["Review candidate portfolios", "Schedule interviews"],
        file: "Projects/Hiring.md",
      },
    ];

    const gtdContext: GTDContext = {
      nextActions: ["Call dentist", "Email John about meeting"],
      somedayItems: ["Learn Spanish", "Write a book"],
      inboxItems: ["Random note from yesterday"],
    };

    const prompt = buildSystemPrompt(projects, "work", gtdContext);

    expect(prompt).toContain("Mobile App");
    expect(prompt).toContain("Rebuild mobile app with React Native");
    expect(prompt).toContain("Priority: 1");
    expect(prompt).toContain("Set up React Native development environment");
    expect(prompt).toContain("Hiring");
    expect(prompt).toContain("2 active projects");
  });

  it("should mention sphere in prompt", () => {
    const projects: FlowProject[] = [];
    const gtdContext: GTDContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };

    const prompt = buildSystemPrompt(projects, "work", gtdContext);

    expect(prompt).toContain("work sphere");
  });
});

describe("REPL network retry", () => {
  let mockClient: LanguageModelClient;
  let originalStdout: any;
  let stdoutOutput: string[];
  let mockRl: any;
  let lineHandler: any;

  beforeEach(() => {
    stdoutOutput = [];
    originalStdout = process.stdout.write;
    process.stdout.write = jest.fn((chunk: any) => {
      stdoutOutput.push(chunk.toString());
      return true;
    }) as any;

    // Create a mock readline interface
    lineHandler = null;
    mockRl = {
      prompt: jest.fn(),
      on: jest.fn((event: string, handler: any) => {
        if (event === "line") {
          lineHandler = handler;
        }
        return mockRl;
      }),
      close: jest.fn(),
      clearLine: jest.fn(),
      cursorTo: jest.fn(),
    };

    const readline = require("readline");
    readline.createInterface = jest.fn(() => mockRl);
    readline.clearLine = jest.fn();
    readline.cursorTo = jest.fn();
  });

  afterEach(() => {
    process.stdout.write = originalStdout;
    jest.clearAllMocks();
  });

  it("should retry on network errors with user feedback", async () => {
    mockClient = {
      sendMessage: jest
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("Test response"),
    };

    const gtdContext: GTDContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };

    // Run REPL (doesn't return, so we don't await)
    runREPL(mockClient, "test-model", "test prompt", gtdContext, 0, "work");

    // Wait for REPL to set up
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate user input
    if (lineHandler) {
      await lineHandler("test question");
    }

    // Wait for async operations to complete (including retry delay)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
    const output = stdoutOutput.join("");
    expect(output).toContain("Network error");
    expect(output).toContain("Retrying");
  });
});
