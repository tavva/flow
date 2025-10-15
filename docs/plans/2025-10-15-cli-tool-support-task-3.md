# CLI Tool Support - Task 3: Create Tool Definitions and Executor

**Goal:** Define the 4 MVP tools and create executor class that routes to appropriate file operations

**Architecture:** Static tool definitions array + ToolExecutor class with method per tool. Stubs for now, full implementation comes later.

**Tech Stack:** TypeScript, Obsidian App API, FileWriter

---

### Step 1: Write failing test for tool definitions

**File:** `tests/cli-tools.test.ts`

```typescript
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
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
      path: "Projects/Test.md",
    } as TFile);

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
    const mockFile = { path: "Projects/Test.md" } as TFile;
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.vault.read as jest.Mock).mockResolvedValue(
      "## Next actions\n- [ ] Do something"
    );

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
    const mockFile = { path: "Projects/Test.md" } as TFile;
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
```

### Step 2: Run test to verify it fails

Run: `npm test -- cli-tools.test.ts`

Expected: FAIL with "Cannot find module '../src/cli-tools'"

### Step 3: Implement tool definitions and executor

**File:** `src/cli-tools.ts`

```typescript
import { App, TFile } from "obsidian";
import { FileWriter } from "./file-writer";
import { PluginSettings, FlowProject } from "./types";
import { ToolDefinition, ToolCall, ToolResult } from "./language-model";

export const CLI_TOOLS: ToolDefinition[] = [
  {
    name: "move_to_hotlist",
    description: "Add a next action to the hotlist for immediate focus today",
    input_schema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "File path to the project containing the action",
        },
        action_text: {
          type: "string",
          description: "Full text of the action to add to hotlist (without checkbox)",
        },
      },
      required: ["project_path", "action_text"],
    },
  },
  {
    name: "update_next_action",
    description: "Rename or improve the wording of an existing next action",
    input_schema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "File path to the project containing the action",
        },
        old_action: {
          type: "string",
          description: "Current text of the action to update",
        },
        new_action: {
          type: "string",
          description: "Improved text for the action",
        },
      },
      required: ["project_path", "old_action", "new_action"],
    },
  },
  {
    name: "add_next_action_to_project",
    description: "Add a new next action to a project",
    input_schema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "File path to the project",
        },
        action_text: {
          type: "string",
          description: "Text of the new next action",
        },
        is_waiting: {
          type: "boolean",
          description: "Whether this is a waiting-for action (default false)",
        },
      },
      required: ["project_path", "action_text"],
    },
  },
  {
    name: "update_project_status",
    description: "Change the status of a project (e.g., archive, hold, live)",
    input_schema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "File path to the project",
        },
        new_status: {
          type: "string",
          description: "New status value (archived, hold, live, etc.)",
        },
      },
      required: ["project_path", "new_status"],
    },
  },
];

export class ToolExecutor {
  constructor(
    private app: App,
    private fileWriter: FileWriter,
    private settings: PluginSettings
  ) {}

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case "move_to_hotlist":
          return await this.moveToHotlist(toolCall);
        case "update_next_action":
          return await this.updateNextAction(toolCall);
        case "add_next_action_to_project":
          return await this.addNextActionToProject(toolCall);
        case "update_project_status":
          return await this.updateProjectStatus(toolCall);
        default:
          return {
            tool_use_id: toolCall.id,
            content: `Unknown tool: ${toolCall.name}`,
            is_error: true,
          };
      }
    } catch (error) {
      return {
        tool_use_id: toolCall.id,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  private async moveToHotlist(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, action_text } = toolCall.input as {
      project_path: string;
      action_text: string;
    };

    // Validate file exists
    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // TODO: Implement hotlist addition (Task 4)
    // For now, return success stub

    return {
      tool_use_id: toolCall.id,
      content: `✓ Added "${action_text}" to hotlist`,
    };
  }

  private async updateNextAction(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, old_action, new_action } = toolCall.input as {
      project_path: string;
      old_action: string;
      new_action: string;
    };

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // TODO: Implement action update (Task 4)
    // For now, just validate file exists

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated action in ${project_path}`,
    };
  }

  private async addNextActionToProject(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, action_text, is_waiting } = toolCall.input as {
      project_path: string;
      action_text: string;
      is_waiting?: boolean;
    };

    // TODO: Implement via FileWriter (Task 4)
    // For now, return success stub

    return {
      tool_use_id: toolCall.id,
      content: `✓ Added action to ${project_path}`,
    };
  }

  private async updateProjectStatus(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, new_status } = toolCall.input as {
      project_path: string;
      new_status: string;
    };

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // TODO: Implement frontmatter update (Task 4)
    // For now, just validate file exists

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated ${project_path} status to ${new_status}`,
    };
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- cli-tools.test.ts`

Expected: PASS - all tool definition and executor tests pass

### Step 5: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 6: Commit

```bash
git add src/cli-tools.ts tests/cli-tools.test.ts
git commit -m "feat: add CLI tool definitions and executor skeleton"
```

---

## Acceptance Criteria

- [x] 4 tools defined with proper schemas
- [x] ToolExecutor class instantiates with App, FileWriter, Settings
- [x] executeTool() routes to correct method by name
- [x] Unknown tool names return error result
- [x] Exceptions caught and returned as error results
- [x] Each tool method validates inputs and returns stub success
- [x] Test coverage ≥80%
