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
import { TFile, App, CachedMetadata, Vault, MetadataCache } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";

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

// Mock Obsidian App for CLI usage
class MockVault {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  getMarkdownFiles(): TFile[] {
    const files: TFile[] = [];
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip .obsidian and other hidden directories
          if (!entry.name.startsWith(".")) {
            walkDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const relativePath = path.relative(this.vaultPath, fullPath);
          const stats = fs.statSync(fullPath);
          // Create mock TFile
          files.push({
            path: relativePath,
            basename: entry.name.replace(".md", ""),
            extension: "md",
            stat: {
              mtime: stats.mtimeMs,
            },
          } as TFile);
        }
      }
    };

    walkDir(this.vaultPath);
    return files;
  }

  async read(file: TFile): Promise<string> {
    const fullPath = path.join(this.vaultPath, file.path);
    return fs.readFileSync(fullPath, "utf-8");
  }
}

class MockMetadataCache {
  private vault: MockVault;

  constructor(vault: MockVault) {
    this.vault = vault;
  }

  getFileCache(file: TFile): CachedMetadata | null {
    try {
      // Read file synchronously to extract frontmatter
      const fullPath = path.join((this.vault as any).vaultPath, file.path);
      const content = fs.readFileSync(fullPath, "utf-8");
      const frontmatter = this.extractFrontmatter(content);

      return {
        frontmatter: frontmatter || undefined,
      } as CachedMetadata;
    } catch (error) {
      return null;
    }
  }

  private extractFrontmatter(content: string): Record<string, any> | null {
    const lines = content.split("\n");
    if (lines[0] !== "---") {
      return null;
    }

    const frontmatterLines: string[] = [];
    let foundEnd = false;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        foundEnd = true;
        break;
      }
      frontmatterLines.push(lines[i]);
    }

    if (!foundEnd) {
      return null;
    }

    // Parse YAML frontmatter (simple key: value format)
    const frontmatter: Record<string, any> = {};
    for (const line of frontmatterLines) {
      const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value: any = match[2].trim();

        // Parse arrays
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v: string) => v.trim());
        }
        // Parse numbers
        else if (!isNaN(Number(value))) {
          value = Number(value);
        }

        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }
}

class MockApp {
  vault: MockVault;
  metadataCache: MockMetadataCache;

  constructor(vaultPath: string) {
    this.vault = new MockVault(vaultPath);
    this.metadataCache = new MockMetadataCache(this.vault);
  }
}

export async function main() {
  try {
    // Parse arguments
    const args = parseCliArgs(process.argv.slice(2));

    // Validate vault path exists
    if (!fs.existsSync(args.vaultPath)) {
      console.error(`Error: Vault path does not exist: ${args.vaultPath}`);
      process.exit(1);
    }

    // Load plugin settings
    const settings = loadPluginSettings(args.vaultPath);

    // Scan vault for projects
    const mockApp = new MockApp(args.vaultPath);
    const scanner = new FlowProjectScanner(mockApp as any);
    const allProjects = await scanner.scanProjects();

    // Filter by sphere
    const projects = allProjects.filter((project) =>
      project.tags.some((tag) => tag === `project/${args.sphere}`)
    );

    if (projects.length === 0) {
      console.warn(`Warning: No projects found for sphere "${args.sphere}"`);
      console.warn("Continuing anyway - you can discuss why projects might be missing.\n");
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(projects, args.sphere);

    // Create language model
    const languageModelClient = createLanguageModelClient(settings);
    const model = getModelForSettings(settings);

    // Run REPL
    await runREPL(languageModelClient, model, systemPrompt, projects.length, args.sphere);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
