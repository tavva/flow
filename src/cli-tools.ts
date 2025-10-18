// ABOUTME: Defines 4 CLI tools for LLM to suggest vault modifications
// ABOUTME: ToolExecutor routes tool calls to appropriate file operations
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
