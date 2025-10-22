// ABOUTME: Defines 4 CLI tools for LLM to suggest vault modifications
// ABOUTME: ToolExecutor routes tool calls to appropriate file operations
import type { App } from "obsidian";
import { TFile } from "obsidian";
import { FileWriter } from "./file-writer";
import { PluginSettings, FlowProject, HotlistItem } from "./types";
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

    // Read file to find action and its line number
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    let lineNumber: number | null = null;
    let lineContent: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match uncompleted action checkboxes with the action text
      if (line.match(/^- \[ \]/) && line.includes(action_text)) {
        lineNumber = i + 1; // 1-indexed
        lineContent = line;
        break;
      }
    }

    if (lineNumber === null || lineContent === null) {
      throw new Error(`Action "${action_text}" not found in ${project_path}`);
    }

    // Extract sphere from project tags
    const cache = this.app.metadataCache.getFileCache(file);
    const tags = cache?.frontmatter?.tags || [];
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    const sphereTag = tagsArray.find((tag: string) => tag.startsWith("project/"));
    const sphere = sphereTag ? sphereTag.replace("project/", "") : "personal";

    // Check for duplicates before adding
    const alreadyExists = this.settings.hotlist.some(
      (item) => item.file === project_path && item.text === action_text
    );
    if (alreadyExists) {
      throw new Error(`Action "${action_text}" is already in hotlist`);
    }

    // Add to hotlist
    this.settings.hotlist.push({
      file: project_path,
      lineNumber,
      lineContent,
      text: action_text,
      sphere,
      isGeneral: false,
      addedAt: Date.now(),
    });

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

    let content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match checkbox lines - extract just the action text for exact matching
      const checkboxMatch = line.match(/^- \[(?: |w|x)\] (.+)$/);
      if (checkboxMatch) {
        const actionTextInLine = checkboxMatch[1];
        // Exact match on action text (ignoring trailing tags like #sphere/work)
        const actionWithoutTags = actionTextInLine.replace(/#\w+\/\w+\s*$/, "").trim();
        if (actionWithoutTags === old_action || actionTextInLine === old_action) {
          // Replace old action with new action, preserving checkbox and tags
          lines[i] = line.replace(old_action, new_action);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      throw new Error(`Action "${old_action}" not found in ${project_path}`);
    }

    content = lines.join("\n");
    await this.app.vault.modify(file, content);

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

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // Construct minimal FlowProject object for FileWriter
    const project: FlowProject = {
      file: project_path,
      title: file.basename,
      description: "",
      priority: 2,
      tags: [],
      status: "live",
      nextActions: [],
    };

    await this.fileWriter.addNextActionToProject(project, action_text, [is_waiting || false]);

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

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = new_status;
    });

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated ${project_path} status to ${new_status}`,
    };
  }
}
