// ABOUTME: Presents tool calls to user for approval via readline interface
// ABOUTME: Supports inline mode (single tool) and batch mode (multiple tools)
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
  // Restore stdin to cooked mode - Ink leaves it in raw mode
  // With terminal: false, readline expects stdin in cooked mode for line buffering
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }

  // Resume stdin to ensure it's flowing
  process.stdin.resume();

  // Keep process alive while waiting for input
  process.stdin.ref();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // Don't modify terminal settings
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdin.unref();
      resolve(answer.trim().toLowerCase());
    });
  });
}
