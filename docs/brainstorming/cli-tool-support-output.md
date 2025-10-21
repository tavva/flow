# CLI Tool Support - Brainstorming Output

**Date:** 15 October 2025  
**Status:** Design complete, ready for implementation planning

## Context

The CLI GTD coach is currently read-only. We want to enable it to suggest and apply modifications to projects and next actions with user approval. This document captures the complete design ready for implementation.

## Use Cases

- User asks CLI to review projects/actions, CLI suggests improvements (e.g., renaming vague actions)
- User asks "what should I focus on?", CLI suggests moving specific action to hotlist
- User discusses a project, CLI suggests it should be archived or split into sub-projects
- User approves suggestions inline ("yes") or in batch ("apply 1,3,5")

## Design Decision: Approach 1 - Native Tool Support

After evaluating options (Google ADK vs native tool calling), we chose **native tool support** in existing LLM clients because:

1. Structured approval pattern (yes/no, numbered selections) doesn't need full agentic reasoning
2. Minimal new dependencies - extends existing `AnthropicClient` and `OpenAICompatibleClient`
3. Lower complexity for the specific use case
4. Preserves existing abstraction layer

## Initial Tool Scope (MVP)

Starting with 4 tools to validate the pattern:

1. **`move_to_hotlist`** - Add action to hotlist for today
2. **`update_next_action`** - Rename/improve an existing action
3. **`add_next_action_to_project`** - Add new action to project
4. **`update_project_status`** - Archive or change project status

Future expansion can add: `create_project`, `move_action_to_project`, `update_project_priority`, `delete_next_action`, `merge_projects`, etc.

## Architecture Overview

### New Components

1. **Tool Definitions** (`src/cli-tools.ts`)
   - TypeScript schemas for each tool
   - `ToolExecutor` class that executes approved tools
   - Routes to appropriate `FileWriter` and vault operations

2. **Tool-Aware LLM Interface** (`src/language-model.ts`)
   - Extends `LanguageModelClient` with optional `sendMessageWithTools()` method
   - New types: `ToolDefinition`, `ToolCall`, `ToolResult`, `ToolCallResponse`
   - Backward compatible (optional method)

3. **Approval Handler** (`src/cli-approval.ts`)
   - Presents tool calls to user for approval
   - Supports inline mode (one at a time) and batch mode (numbered list)
   - Returns array of approved tool call IDs

### Modified Components

4. **AnthropicClient** (`src/anthropic-client.ts`)
   - Implement `sendMessageWithTools()` using Anthropic's native tools API
   - Parse `tool_use` content blocks from response
   - Send `tool_result` blocks back in follow-up messages

5. **OpenAICompatibleClient** (`src/openai-compatible-client.ts`)
   - Implement `sendMessageWithTools()` using OpenAI's tools parameter
   - Parse `tool_calls` from response message
   - Send tool results as `role: "tool"` messages

6. **CLI REPL** (`src/cli.ts`)
   - Detect tool calls in LLM response
   - Call approval handler
   - Execute approved tools via `ToolExecutor`
   - Send tool results back to LLM for final response
   - Handle multi-turn tool conversations

7. **System Prompt** (`src/cli.ts`)
   - Update from "read-only" to "can suggest and apply changes with approval"
   - List available tools and when to use them

8. **Hotlist Support** (FileWriter or new helper)
   - Add `addToHotlist(file, lineContent, sphere)` method
   - Reuse logic from `hotlist-view.ts`

## Detailed Design

### 1. Type Definitions

**Add to `src/language-model.ts`:**

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ToolCallResponse {
  content?: string; // Text response from LLM
  toolCalls?: ToolCall[]; // Tools the LLM wants to call
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

export interface LanguageModelClient {
  sendMessage(request: LanguageModelRequest): Promise<string>;

  // Optional - for tool support
  sendMessageWithTools?(
    request: LanguageModelRequest,
    tools: ToolDefinition[]
  ): Promise<ToolCallResponse>;
}
```

### 2. Tool Definitions (`src/cli-tools.ts`)

```typescript
import { App, TFile } from "obsidian";
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

    // Implementation: Add to hotlist using FileWriter or new helper
    // Extract sphere from project tags
    // Return success message

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

    // Implementation: Read project file, find old action, replace with new
    // Use similar logic to review-modal.ts updateNextAction method

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

    // Implementation: Use FileWriter.addNextActionToProject
    // Need to construct minimal FlowProject object from path

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

    // Implementation: Update frontmatter status field
    // Use similar logic to review-modal.ts updateProjectStatus method

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated ${project_path} status to ${new_status}`,
    };
  }
}
```

### 3. Approval Handler (`src/cli-approval.ts`)

```typescript
import * as readline from "readline";
import { ToolCall } from "./language-model";

export interface ApprovalResult {
  approvedToolIds: string[];
}

export async function presentToolCallsForApproval(
  toolCalls: ToolCall[],
  contextText?: string
): Promise<ApprovalResult> {
  if (toolCalls.length === 0) {
    return { approvedToolIds: [] };
  }

  // Show context from LLM if provided
  if (contextText) {
    console.log(`\n${contextText}\n`);
  }

  if (toolCalls.length === 1) {
    return await inlineApproval(toolCalls[0]);
  } else {
    return await batchApproval(toolCalls);
  }
}

async function inlineApproval(toolCall: ToolCall): Promise<ApprovalResult> {
  console.log(`Coach suggests: ${formatToolCallDescription(toolCall)}\n`);

  const answer = await promptUser("Apply this change? (y/n/skip): ");

  if (answer === "y" || answer === "yes") {
    return { approvedToolIds: [toolCall.id] };
  }

  return { approvedToolIds: [] };
}

async function batchApproval(toolCalls: ToolCall[]): Promise<ApprovalResult> {
  console.log(`\nCoach suggests ${toolCalls.length} improvements:\n`);

  toolCalls.forEach((toolCall, index) => {
    console.log(`${index + 1}. ${formatToolCallDescription(toolCall)}\n`);
  });

  const answer = await promptUser("Enter numbers to apply (e.g., '1,3' or 'all' or 'none'): ");

  if (answer === "all") {
    return { approvedToolIds: toolCalls.map((tc) => tc.id) };
  }

  if (answer === "none" || answer === "") {
    return { approvedToolIds: [] };
  }

  // Parse comma-separated numbers
  const selectedIndices = answer
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < toolCalls.length);

  return {
    approvedToolIds: selectedIndices.map((i) => toolCalls[i].id),
  };
}

function formatToolCallDescription(toolCall: ToolCall): string {
  switch (toolCall.name) {
    case "move_to_hotlist":
      return `Move to hotlist: "${toolCall.input.action_text}"\n  (from ${toolCall.input.project_path})`;
    case "update_next_action":
      return `Rename action in ${toolCall.input.project_path}\n  Current: "${toolCall.input.old_action}"\n  Suggested: "${toolCall.input.new_action}"`;
    case "add_next_action_to_project":
      return `Add action to ${toolCall.input.project_path}\n  Action: "${toolCall.input.action_text}"`;
    case "update_project_status":
      return `Update project status: ${toolCall.input.project_path}\n  New status: ${toolCall.input.new_status}`;
    default:
      return `${toolCall.name}(${JSON.stringify(toolCall.input)})`;
  }
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}
```

### 4. REPL Modifications (`src/cli.ts`)

Key changes to `runREPL` function:

```typescript
export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  gtdContext: GTDContext,
  projectCount: number,
  sphere: string,
  mockApp: App, // Need to pass through for ToolExecutor
  settings: PluginSettings // Need to pass through for ToolExecutor
): Promise<void> {
  const messages: ChatMessage[] = [];

  // Check if client supports tools
  const supportsTools = typeof languageModelClient.sendMessageWithTools === "function";

  if (!supportsTools) {
    console.log("Note: Tool support not available with current LLM provider.\n");
  }

  // ... existing REPL setup ...

  const handleSubmit = async () => {
    // ... existing input handling ...

    try {
      process.stdout.write(`${colors.dim}Thinking...${colors.reset}`);

      let response: string | ToolCallResponse;

      if (supportsTools) {
        response = await withRetry(
          () =>
            languageModelClient.sendMessageWithTools!(
              { model, maxTokens: 4000, messages },
              CLI_TOOLS
            )
          // ... retry config ...
        );
      } else {
        response = await withRetry(
          () => languageModelClient.sendMessage({ model, maxTokens: 4000, messages })
          // ... retry config ...
        );
      }

      // Clear thinking indicator
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      // Handle tool response
      if (typeof response !== "string" && response.toolCalls) {
        await handleToolCalls(response, messages, languageModelClient, model);
      } else {
        // Regular text response
        const text = typeof response === "string" ? response : response.content || "";
        messages.push({ role: "assistant", content: text });
        console.log(`${colors.assistant}Coach:${colors.reset}\n${marked.parse(text)}`);
      }
    } catch (error) {
      // ... error handling ...
    }

    showPrompt();
  };

  // ... rest of REPL ...
}

async function handleToolCalls(
  response: ToolCallResponse,
  messages: ChatMessage[],
  client: LanguageModelClient,
  model: string
): Promise<void> {
  const { content, toolCalls } = response;

  // Present tools for approval
  const approval = await presentToolCallsForApproval(toolCalls!, content);

  // Execute approved tools
  const toolExecutor = new ToolExecutor(mockApp, fileWriter, settings);
  const toolResults: ToolResult[] = [];

  for (const toolCall of toolCalls!) {
    if (approval.approvedToolIds.includes(toolCall.id)) {
      const result = await toolExecutor.executeTool(toolCall);
      toolResults.push(result);

      // Show result to user
      if (result.is_error) {
        console.log(`  ✗ ${result.content}`);
      } else {
        console.log(`  ${result.content}`);
      }
    } else {
      // Tool was rejected by user
      toolResults.push({
        tool_use_id: toolCall.id,
        content: "User declined this change",
        is_error: false,
      });
    }
  }

  // Send tool results back to LLM for final response
  // This requires storing tool calls and results in message history
  // Format depends on provider (Anthropic vs OpenAI)

  // ... implementation to send tool results and get final response ...
}
```

### 5. System Prompt Updates

Change in `buildSystemPrompt`:

```typescript
// OLD:
prompt += `Important: You are read-only. Provide advice and recommendations, but you cannot edit files.\n\n`;

// NEW:
prompt += `You can suggest and apply changes to help improve the GTD system:\n`;
prompt += `- Move important actions to the hotlist for today\n`;
prompt += `- Improve vague or unclear next actions to be more specific\n`;
prompt += `- Add missing next actions to projects\n`;
prompt += `- Update project status (archive completed projects, etc.)\n\n`;
prompt += `When you identify improvements, use the available tools to suggest changes. `;
prompt += `The user will review and approve each suggestion before it's applied.\n\n`;
```

### 6. Anthropic Client Changes

In `src/anthropic-client.ts`, add to `AnthropicLanguageModelClient`:

```typescript
async sendMessageWithTools(
  request: LanguageModelRequest,
  tools: ToolDefinition[]
): Promise<ToolCallResponse> {
  // Convert messages and system prompt
  const systemMessages: string[] = [];
  const anthropicMessages = request.messages
    .filter((message) => {
      if (message.role === "system") {
        systemMessages.push(message.content);
        return false;
      }
      return true;
    })
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  // Convert tools to Anthropic format
  const anthropicTools = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }));

  const response = await this.client.createMessage({
    model: request.model,
    max_tokens: request.maxTokens,
    messages: anthropicMessages,
    system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
    tools: anthropicTools
  });

  // Parse response for tool calls
  const textContent: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      textContent.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>
      });
    }
  }

  return {
    content: textContent.join("\n"),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn"
  };
}
```

### 7. OpenAI Client Changes

In `src/openai-compatible-client.ts`, add:

```typescript
async sendMessageWithTools(
  request: LanguageModelRequest,
  tools: ToolDefinition[]
): Promise<ToolCallResponse> {
  // Convert tools to OpenAI format
  const openaiTools = tools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));

  const body = JSON.stringify({
    model: request.model,
    max_tokens: request.maxTokens,
    messages: request.messages,
    tools: openaiTools
  });

  // ... fetch logic similar to sendMessage ...

  const data = await response.json() as ChatCompletionResponse;
  const choice = data.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new Error("OpenAI response did not include a message");
  }

  // Parse tool calls if present
  const toolCalls: ToolCall[] = [];
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments)
      });
    }
  }

  const content = typeof message.content === "string"
    ? message.content
    : message.content?.filter(p => p.type === "text").map(p => p.text).join("\n");

  return {
    content: content || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn"
  };
}
```

## Data Flow Example

**User:** "Can you review my next actions and suggest improvements?"

1. **REPL → LLM** with system prompt + user message + tools
2. **LLM Response:**
   - Text: "I notice several actions could be more specific. Here are my suggestions:"
   - Tool Calls: [
     `update_next_action(...)`,
     `update_next_action(...)`
     ]
3. **Approval Handler** shows batch UI:

   ```
   Coach suggests 2 improvements:

   1. Rename "gym" → "Call gym at 555-9999..."
   2. Rename "fix bug" → "Fix login timeout..."

   Apply which? (1,2 or 'all'): 1,2
   ```

4. **Tool Executor** executes tools #1 and #2, returns results
5. **REPL → LLM** with tool results
6. **LLM Final Response:** "Great! I've updated both actions..."
7. **REPL** displays final response to user

## Implementation Notes

### Multi-turn Tool Conversations

Need to properly format message history for each provider:

**Anthropic format:**

```
[user message] →
[assistant with tool_use blocks] →
[user with tool_result blocks] →
[assistant final response]
```

**OpenAI format:**

```
[user message] →
[assistant with tool_calls] →
[tool messages with results] →
[assistant final response]
```

### Error Handling

- Tool execution errors should be sent back to LLM as error results
- LLM can then apologize/explain to user
- Network errors during tool execution should be handled gracefully
- Invalid tool parameters should be caught and reported

### Testing Strategy

1. **Unit tests** for ToolExecutor - mock FileWriter, verify each tool works
2. **Unit tests** for approval handler - test parsing of user input
3. **Integration tests** for clients - verify tool call round-trip
4. **Manual testing** for full flow - verify UX and file modifications

### Hotlist Integration

Review `src/hotlist-view.ts` for:

- `HotlistItem` structure (file, lineNumber, lineContent, text, sphere, addedAt)
- Validation logic for checking if action exists at line number
- How hotlist is stored in settings and persisted

Implement similar logic in tool executor or extend FileWriter with `addToHotlist` method.

## Open Questions for Implementation

1. **Hotlist method location:** Add to FileWriter or create separate HotlistManager?
2. **Project object construction:** How to create minimal FlowProject from file path in CLI context?
3. **Sphere extraction:** How to determine sphere for hotlist from project tags in CLI?
4. **Tool result message history:** Exact format for storing tool calls/results in messages array?

## Success Criteria

- CLI can suggest and apply 4 types of modifications
- User can approve/reject individual suggestions or in batch
- Changes persist correctly to vault files
- Graceful degradation if tool support unavailable
- Test coverage ≥80% for new code
- Documentation updated with examples

## Next Steps

Hand off to writing-plans chat mode to create detailed implementation plan with:

- Exact code snippets for each change
- Test specifications
- Dependency order and parallelization opportunities
- Acceptance criteria for each task
