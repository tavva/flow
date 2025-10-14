// ABOUTME: CLI entry point for conversational project prioritization.
// ABOUTME: Loads Flow projects from vault and provides AI-powered advice via REPL.

import * as fs from "fs";
import * as path from "path";
import { PluginSettings, FlowProject } from "./types";

export interface CliArgs {
  vaultPath: string;
  sphere: string;
}

export function parseCliArgs(args: string[]): CliArgs {
  const vaultIndex = args.indexOf("--vault");
  const sphereIndex = args.indexOf("--sphere");

  if (vaultIndex === -1 || vaultIndex + 1 >= args.length) {
    throw new Error("--vault is required");
  }

  if (sphereIndex === -1 || sphereIndex + 1 >= args.length) {
    throw new Error("--sphere is required");
  }

  return {
    vaultPath: args[vaultIndex + 1],
    sphere: args[sphereIndex + 1],
  };
}

export function loadPluginSettings(vaultPath: string): PluginSettings {
  const settingsPath = path.join(vaultPath, ".obsidian", "plugins", "flow-gtd-coach", "data.json");

  if (!fs.existsSync(settingsPath)) {
    throw new Error(
      "Plugin settings not found. Please configure the Flow GTD Coach plugin in Obsidian first."
    );
  }

  const settingsJson = fs.readFileSync(settingsPath, "utf-8");
  const settings = JSON.parse(settingsJson) as PluginSettings;

  // Validate API key is present
  if (settings.llmProvider === "anthropic" && !settings.anthropicApiKey) {
    throw new Error("API key not configured. Please set API key in plugin settings.");
  }

  if (settings.llmProvider === "openai-compatible" && !settings.openaiApiKey) {
    throw new Error("API key not configured. Please set API key in plugin settings.");
  }

  return settings;
}

export function buildSystemPrompt(projects: FlowProject[], sphere: string): string {
  const projectCount = projects.length;

  let prompt = `You are a prioritisation coach helping with GTD project management for the ${sphere} sphere.\n\n`;
  prompt += `You have context on ${projectCount} projects. Your role is to:\n`;
  prompt += `- Help prioritise which projects to focus on based on stated goals and constraints\n`;
  prompt += `- Ask clarifying questions about urgency, dependencies, and impact\n`;
  prompt += `- Provide actionable recommendations\n`;
  prompt += `- Consider project priority levels (1 = highest, 3 = lowest)\n`;
  prompt += `- Consider the number and nature of next actions (more specific actions = more momentum)\n\n`;

  if (projectCount === 0) {
    prompt += `No projects found in this sphere.\n`;
    return prompt;
  }

  prompt += `## Projects\n\n`;

  for (const project of projects) {
    prompt += `### ${project.title}\n`;
    prompt += `Description: ${project.description || "No description"}\n`;
    prompt += `Priority: ${project.priority}\n`;
    prompt += `Status: ${project.status}\n`;

    if (project.nextActions && project.nextActions.length > 0) {
      prompt += `Next Actions:\n`;
      for (const action of project.nextActions) {
        prompt += `- ${action}\n`;
      }
    } else {
      prompt += `Next Actions: None defined\n`;
    }

    prompt += `\n`;
  }

  return prompt;
}

import * as readline from "readline";
import { LanguageModelClient, ChatMessage } from "./language-model";

export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  projectCount: number,
  sphere: string
): Promise<void> {
  const messages: ChatMessage[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  console.log(`\nFlow Priority Coach - ${sphere} sphere (${projectCount} projects loaded)`);
  console.log(
    `Type 'exit' to quit, 'reset' to start fresh conversation, 'list' to show projects\n`
  );

  // Initial system message
  messages.push({
    role: "system",
    content: systemPrompt,
  });

  rl.prompt();

  rl.on("line", async (input: string) => {
    const trimmed = input.trim();

    if (trimmed === "exit" || trimmed === "quit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    if (trimmed === "reset") {
      messages.length = 0;
      messages.push({
        role: "system",
        content: systemPrompt,
      });
      console.log("Conversation reset.\n");
      rl.prompt();
      return;
    }

    if (trimmed === "list") {
      console.log('Use your initial prompt to see project list, or ask "list all projects"\n');
      rl.prompt();
      return;
    }

    if (trimmed === "") {
      rl.prompt();
      return;
    }

    // Add user message
    messages.push({
      role: "user",
      content: trimmed,
    });

    try {
      // Get AI response
      const response = await languageModelClient.sendMessage({
        model,
        maxTokens: 4000,
        messages,
      });

      // Add assistant message
      messages.push({
        role: "assistant",
        content: response,
      });

      console.log(`\n${response}\n`);
    } catch (error) {
      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      // Remove the user message that caused the error
      messages.pop();
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
