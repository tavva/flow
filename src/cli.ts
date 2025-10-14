// ABOUTME: CLI entry point for conversational project prioritization.
// ABOUTME: Loads Flow projects from vault and provides AI-powered advice via REPL.

import * as fs from "fs";
import * as path from "path";
import { PluginSettings, FlowProject } from "./types";
import { GTDContext } from "./gtd-context-scanner";

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
  const settingsPath = path.join(vaultPath, ".obsidian", "plugins", "flow-coach", "data.json");

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

export function buildSystemPrompt(
  projects: FlowProject[],
  sphere: string,
  gtdContext: GTDContext
): string {
  const projectCount = projects.length;
  const nextActionsCount = gtdContext.nextActions.length;
  const somedayCount = gtdContext.somedayItems.length;
  const inboxCount = gtdContext.inboxItems.length;

  let prompt = `You are a GTD (Getting Things Done) coach for the ${sphere} sphere.\n\n`;
  prompt += `You have context on the user's complete GTD system:\n`;
  prompt += `- ${projectCount} active projects with their next actions and priorities\n`;
  prompt += `- ${nextActionsCount} next actions from the central next actions file\n`;
  prompt += `- ${somedayCount} items in someday/maybe\n`;
  prompt += `- ${inboxCount} unprocessed inbox items\n\n`;

  prompt += `Your role is to provide expert GTD advice:\n`;
  prompt += `- Help prioritise projects and actions based on goals, context, energy, and time\n`;
  prompt += `- Review project quality: Are outcomes clear? Are next actions specific and actionable?\n`;
  prompt += `- Coach on GTD processes: weekly reviews, inbox processing, project planning\n`;
  prompt += `- Answer methodology questions about GTD principles and best practices\n`;
  prompt += `- Identify issues: projects with no next actions, vague actions, unclear outcomes\n\n`;

  prompt += `Important: You are read-only. Provide advice and recommendations, but you cannot edit files.\n\n`;

  prompt += `GTD Quality Standards:\n`;
  prompt += `- Next actions must start with a verb, be specific, and completable in one sitting\n`;
  prompt += `- Project outcomes should be clear and measurable (what does "done" look like?)\n`;
  prompt += `- Projects need at least one next action to maintain momentum\n\n`;

  if (projectCount === 0 && nextActionsCount === 0 && somedayCount === 0 && inboxCount === 0) {
    prompt += `No GTD data found. You can still answer general GTD methodology questions.\n`;
    return prompt;
  }

  prompt += `---\n\n`;

  if (projectCount > 0) {
    prompt += `## Projects (${projectCount})\n\n`;
    for (const project of projects) {
      prompt += `### ${project.title}\n`;
      prompt += `Description: ${project.description || "No description"}\n`;
      prompt += `Priority: ${project.priority} (1=highest, 3=lowest)\n`;
      prompt += `Status: ${project.status}\n`;

      if (project.nextActions && project.nextActions.length > 0) {
        prompt += `Next Actions (${project.nextActions.length}):\n`;
        for (const action of project.nextActions) {
          prompt += `- ${action}\n`;
        }
      } else {
        prompt += `⚠️ Next Actions: None defined (project may be stalled)\n`;
      }

      prompt += `\n`;
    }
  }

  if (nextActionsCount > 0) {
    prompt += `## Central Next Actions (${nextActionsCount})\n\n`;
    for (const action of gtdContext.nextActions) {
      prompt += `- ${action}\n`;
    }
    prompt += `\n`;
  }

  if (somedayCount > 0) {
    prompt += `## Someday/Maybe (${somedayCount})\n\n`;
    for (const item of gtdContext.somedayItems) {
      prompt += `- ${item}\n`;
    }
    prompt += `\n`;
  }

  if (inboxCount > 0) {
    prompt += `## Inbox Items (${inboxCount} unprocessed)\n\n`;
    for (const item of gtdContext.inboxItems) {
      prompt += `- ${item}\n`;
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
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  user: "\x1b[1m\x1b[36m", // Bold cyan for user
  userMessage: "\x1b[3m\x1b[36m", // Italic cyan for user message text
  assistant: "\x1b[35m", // Magenta for assistant
  dim: "\x1b[2m", // Dim for thinking indicator
};

export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  projectCount: number,
  sphere: string
): Promise<void> {
  const messages: ChatMessage[] = [];

  // Configure markdown renderer
  const marked = new Marked();
  marked.use(
    markedTerminal({
      // Use functions for color customization
      heading: (s: string) => `${colors.assistant}${s}${colors.reset}`,
      code: (s: string) => `${colors.dim}${s}${colors.reset}`,
      blockquote: (s: string) => `${colors.dim}${s}${colors.reset}`,
      strong: (s: string) => `\x1b[1m${s}\x1b[22m`, // Bold
      em: (s: string) => `\x1b[3m${s}\x1b[23m`, // Italic
    }) as any
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.user}You: ${colors.reset}`,
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

    // Echo user message in italic
    console.log(`${colors.userMessage}${trimmed}${colors.reset}\n`);

    // Add user message
    messages.push({
      role: "user",
      content: trimmed,
    });

    try {
      // Show thinking indicator
      process.stdout.write(`${colors.dim}Thinking...${colors.reset}`);

      // Get AI response
      const response = await languageModelClient.sendMessage({
        model,
        maxTokens: 4000,
        messages,
      });

      // Clear thinking indicator
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      // Add assistant message
      messages.push({
        role: "assistant",
        content: response,
      });

      // Render markdown response
      const rendered = marked.parse(response) as string;
      console.log(`${colors.assistant}Coach:${colors.reset}\n${rendered}`);
    } catch (error) {
      // Clear thinking indicator on error
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

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
    // TODO: Task 8 will add GTDContextScanner here
    const emptyGtdContext: GTDContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };
    const systemPrompt = buildSystemPrompt(projects, args.sphere, emptyGtdContext);

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
