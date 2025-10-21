import { CLI_TOOLS, ToolExecutor } from "../src/cli-tools";
import { ToolCall, ToolResult } from "../src/language-model";
import { App, TFile } from "obsidian";
import { FileWriter } from "../src/file-writer";
import { PluginSettings } from "../src/types";

describe("CLI Tool Definitions", () => {
  it("should export CLI_TOOLS array with 4 tools", () => {
    expect(CLI_TOOLS).toBeDefined();
    expect(Array.isArray(CLI_TOOLS)).toBe(true);
    expect(CLI_TOOLS.length).toBe(4);
  });

  it("should include move_to_hotlist tool", () => {
    const tool = CLI_TOOLS.find((t) => t.name === "move_to_hotlist");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("hotlist");
    expect(tool?.input_schema.properties.project_path).toBeDefined();
    expect(tool?.input_schema.properties.action_text).toBeDefined();
    expect(tool?.input_schema.required).toContain("project_path");
    expect(tool?.input_schema.required).toContain("action_text");
  });

  it("should include update_next_action tool", () => {
    const tool = CLI_TOOLS.find((t) => t.name === "update_next_action");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("improve");
    expect(tool?.input_schema.properties.project_path).toBeDefined();
    expect(tool?.input_schema.properties.old_action).toBeDefined();
    expect(tool?.input_schema.properties.new_action).toBeDefined();
    expect(tool?.input_schema.required).toContain("project_path");
    expect(tool?.input_schema.required).toContain("old_action");
    expect(tool?.input_schema.required).toContain("new_action");
  });

  it("should include add_next_action_to_project tool", () => {
    const tool = CLI_TOOLS.find((t) => t.name === "add_next_action_to_project");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("Add");
    expect(tool?.input_schema.properties.project_path).toBeDefined();
    expect(tool?.input_schema.properties.action_text).toBeDefined();
    expect(tool?.input_schema.properties.is_waiting).toBeDefined();
    expect(tool?.input_schema.required).toContain("project_path");
    expect(tool?.input_schema.required).toContain("action_text");
  });

  it("should include update_project_status tool", () => {
    const tool = CLI_TOOLS.find((t) => t.name === "update_project_status");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("status");
    expect(tool?.input_schema.properties.project_path).toBeDefined();
    expect(tool?.input_schema.properties.new_status).toBeDefined();
    expect(tool?.input_schema.required).toContain("project_path");
    expect(tool?.input_schema.required).toContain("new_status");
  });
});

describe("ToolExecutor", () => {
  let mockApp: App;
  let mockFileWriter: FileWriter;
  let mockSettings: PluginSettings;
  let executor: ToolExecutor;

  beforeEach(() => {
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      fileManager: {
        processFrontMatter: jest.fn(),
      },
      metadataCache: {
        getFileCache: jest.fn(),
      },
    } as any;

    mockFileWriter = {
      addNextActionToProject: jest.fn(),
    } as any;

    mockSettings = {
      hotlist: [],
    } as any;

    executor = new ToolExecutor(mockApp, mockFileWriter, mockSettings);
  });

  it("should create ToolExecutor instance", () => {
    expect(executor).toBeDefined();
  });

  it("should return error for unknown tool", async () => {
    const toolCall: ToolCall = {
      id: "call_1",
      name: "unknown_tool",
      input: {},
    };

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_1");
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });

  it("should handle move_to_hotlist tool call", async () => {
    const toolCall: ToolCall = {
      id: "call_1",
      name: "move_to_hotlist",
      input: {
        project_path: "Projects/Test.md",
        action_text: "Test action",
      },
    };

    // Mock file exists
    const mockFile = new TFile();
    mockFile.path = "Projects/Test.md";
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Test action");
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/work"] },
    });

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_1");
    expect(result.content).toContain("Added");
    expect(result.content).toContain("Test action");
  });

  it("should handle update_next_action tool call", async () => {
    const toolCall: ToolCall = {
      id: "call_2",
      name: "update_next_action",
      input: {
        project_path: "Projects/Test.md",
        old_action: "Do something",
        new_action: "Do something specific",
      },
    };

    // Mock file exists
    const mockFile = new TFile();
    mockFile.path = "Projects/Test.md";
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Do something");

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_2");
    expect(result.content).toContain("Updated action");
  });

  it("should handle add_next_action_to_project tool call", async () => {
    const toolCall: ToolCall = {
      id: "call_3",
      name: "add_next_action_to_project",
      input: {
        project_path: "Projects/Test.md",
        action_text: "New action",
        is_waiting: false,
      },
    };

    // Mock file exists
    const mockFile = new TFile();
    mockFile.path = "Projects/Test.md";
    mockFile.basename = "Test";
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_3");
    expect(result.content).toContain("Added action");
  });

  it("should handle update_project_status tool call", async () => {
    const toolCall: ToolCall = {
      id: "call_4",
      name: "update_project_status",
      input: {
        project_path: "Projects/Test.md",
        new_status: "archived",
      },
    };

    // Mock file exists
    const mockFile = new TFile();
    mockFile.path = "Projects/Test.md";
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_4");
    expect(result.content).toContain("Updated");
    expect(result.content).toContain("archived");
  });

  it("should catch and return errors", async () => {
    const toolCall: ToolCall = {
      id: "call_5",
      name: "move_to_hotlist",
      input: {
        project_path: "NonExistent.md",
        action_text: "Test",
      },
    };

    // Mock file not found
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

    const result = await executor.executeTool(toolCall);

    expect(result.tool_use_id).toBe("call_5");
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("Error");
  });
});
