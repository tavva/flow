// ABOUTME: CLI entry point for conversational GTD coaching across all GTD aspects.
// ABOUTME: Loads Flow projects and GTD context from vault and provides AI-powered advice via REPL with Ink input.

import * as fs from "fs";
import * as path from "path";
import { PluginSettings, FlowProject } from "./types";
import { GTDContext, GTDContextScanner } from "./gtd-context-scanner";
import { buildProjectHierarchy, flattenHierarchy } from "./project-hierarchy";
import { render } from "ink";
import { InboxApp } from "./components/InboxApp";
import type { TFile, App, CachedMetadata } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { LanguageModelClient, ChatMessage, ToolCallResponse } from "./language-model";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { withRetry } from "./network-retry";
import { presentToolCallsForApproval } from "./cli-approval";
import { CLI_TOOLS, ToolExecutor } from "./cli-tools";
import { FileWriter } from "./file-writer";

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
  const settingsPath = path.join(vaultPath, ".obsidian", "plugins", "flow", "data.json");

  if (!fs.existsSync(settingsPath)) {
    throw new Error(
      "Plugin settings not found. Please configure the Flow plugin in Obsidian first."
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
  // Build hierarchy to get correct count including all sub-projects
  const hierarchy = buildProjectHierarchy(projects);
  const flattenedHierarchy = flattenHierarchy(hierarchy);
  const projectCount = flattenedHierarchy.length;

  const nextActionsCount = gtdContext.nextActions.length;
  const somedayCount = gtdContext.somedayItems.length;
  const inboxCount = gtdContext.inboxItems.length;

  let prompt = `You are Flow, a GTD (Getting Things Done) coach for the ${sphere} sphere.\n\n`;
  prompt += `You have context on the user's complete GTD system:\n`;
  prompt += `- ${projectCount} active projects (including sub-projects) with their next actions and priorities\n`;
  prompt += `- ${nextActionsCount} next actions from the central next actions file\n`;
  prompt += `- ${somedayCount} items in someday/maybe\n`;
  prompt += `- ${inboxCount} unprocessed inbox items\n\n`;

  prompt += `Your role is to provide expert GTD advice:\n`;
  prompt += `- Help prioritise projects and actions based on goals, context, energy, and time\n`;
  prompt += `- Review project quality: Are outcomes clear? Are next actions specific and actionable?\n`;
  prompt += `- Coach on GTD processes: weekly reviews, inbox processing, project planning\n`;
  prompt += `- Answer methodology questions about GTD principles and best practices\n`;
  prompt += `- Identify issues: projects with no next actions, vague actions, unclear outcomes\n\n`;

  prompt += `You can suggest and apply changes to help improve the GTD system:\n`;
  prompt += `- Move important actions to the hotlist for today\n`;
  prompt += `- Improve vague or unclear next actions to be more specific\n`;
  prompt += `- Add missing next actions to projects\n`;
  prompt += `- Update project status (archive completed projects, etc.)\n\n`;
  prompt += `When you identify improvements, use the available tools to suggest changes. `;
  prompt += `The user will review and approve each suggestion before it's applied.\n\n`;

  prompt += `Communication Style:\n`;
  prompt += `- Ask questions only when the current instructions are ambiguous or incomplete\n`;
  prompt += `- Never ask open-ended, reflective, or rapport-building questions\n`;
  prompt += `- Focus on providing actionable GTD advice based on the data\n\n`;

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
    prompt += `Projects are shown hierarchically with sub-projects indented under their parents.\n\n`;

    for (const node of flattenedHierarchy) {
      const project = node.project;
      const indent = "  ".repeat(node.depth);

      prompt += `${indent}### ${project.title}\n`;
      prompt += `${indent}Description: ${project.description || "No description"}\n`;
      prompt += `${indent}Priority: ${project.priority} (1=highest, 3=lowest)\n`;
      prompt += `${indent}Status: ${project.status}\n`;

      if (node.depth > 0) {
        prompt += `${indent}(Sub-project at depth ${node.depth})\n`;
      }

      if (project.milestones) {
        prompt += `${indent}Milestones:\n`;
        const milestoneLines = project.milestones.split("\n");
        for (const line of milestoneLines) {
          prompt += `${indent}${line}\n`;
        }
      }

      if (project.nextActions && project.nextActions.length > 0) {
        prompt += `${indent}Next Actions (${project.nextActions.length}):\n`;
        for (const action of project.nextActions) {
          prompt += `${indent}- ${action}\n`;
        }
      } else {
        prompt += `${indent}⚠️ Next Actions: None defined (project may be stalled)\n`;
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

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  assistant: "\x1b[35m", // Magenta for assistant
  dim: "\x1b[2m", // Dim for thinking indicator
};

async function handleToolCalls(
  response: ToolCallResponse,
  messages: ChatMessage[],
  mockApp: App,
  settings: PluginSettings
): Promise<void> {
  const { content, toolCalls } = response;

  // Present tools for approval
  const approval = await presentToolCallsForApproval(toolCalls!, content);

  // Create FileWriter instance
  const fileWriter = new FileWriter(mockApp, settings);

  // Execute approved tools
  const toolExecutor = new ToolExecutor(mockApp, fileWriter, settings);

  for (const toolCall of toolCalls!) {
    if (approval.approvedToolIds.includes(toolCall.id)) {
      const result = await toolExecutor.executeTool(toolCall);

      // Show result to user
      if (result.is_error) {
        console.log(`  ✗ ${result.content}`);
      } else {
        console.log(`  ${result.content}`);
      }
    }
  }

  // Acknowledge tool execution
  const summary = `Completed ${approval.approvedToolIds.length} of ${toolCalls!.length} suggested changes.`;
  messages.push({ role: "assistant", content: summary });
  console.log(`\n${colors.assistant}Coach:${colors.reset} ${summary}\n`);
}

export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  gtdContext: GTDContext,
  projectCount: number,
  sphere: string,
  mockApp: App,
  settings: PluginSettings
): Promise<void> {
  const messages: ChatMessage[] = [];

  // Check if client supports tools
  const supportsTools = typeof languageModelClient.sendMessageWithTools === "function";

  if (!supportsTools) {
    console.log("Note: Tool support not available with current LLM provider.\n");
  }

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
  marked.setOptions({ async: false });

  console.log(`\nFlow - ${sphere} sphere`);
  console.log(`  ${projectCount} projects`);
  console.log(`  ${gtdContext.nextActions.length} next actions`);
  console.log(`  ${gtdContext.somedayItems.length} someday items`);
  console.log(`  ${gtdContext.inboxItems.length} inbox items\n`);
  console.log(`Type 'exit' to quit, 'reset' to start fresh conversation\n`);

  // Initial system message
  messages.push({
    role: "system",
    content: systemPrompt,
  });

  // REPL loop
  while (true) {
    // Get user input via Ink
    const userInput = await new Promise<string>((resolve) => {
      const { unmount } = render(
        <InboxApp
          onComplete={(text) => {
            unmount();
            resolve(text);
          }}
        />
      );
    });

    const input = userInput.trim();

    if (input === "exit" || input === "quit") {
      console.log("Goodbye!");
      process.exit(0);
    }

    if (input === "reset") {
      messages.length = 0;
      messages.push({
        role: "system",
        content: systemPrompt,
      });
      console.log("Conversation reset.\n");
      continue;
    }

    if (input === "") {
      continue;
    }

    // Add user message
    messages.push({
      role: "user",
      content: input,
    });

    try {
      // Show thinking indicator
      process.stdout.write(`${colors.dim}Thinking...${colors.reset}`);

      let response: string | ToolCallResponse;

      if (supportsTools) {
        response = await withRetry(
          () =>
            languageModelClient.sendMessageWithTools!(
              { model, maxTokens: 4000, messages },
              CLI_TOOLS
            ),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 },
          (attempt, delayMs) => {
            process.stdout.write("\r");
            const delaySec = (delayMs / 1000).toFixed(1);
            process.stdout.write(
              `${colors.dim}Network error. Retrying in ${delaySec}s... (attempt ${attempt}/5)${colors.reset}`
            );
          }
        );
      } else {
        response = await withRetry(
          () =>
            languageModelClient.sendMessage({
              model,
              maxTokens: 4000,
              messages,
            }),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 },
          (attempt, delayMs) => {
            process.stdout.write("\r");
            const delaySec = (delayMs / 1000).toFixed(1);
            process.stdout.write(
              `${colors.dim}Network error. Retrying in ${delaySec}s... (attempt ${attempt}/5)${colors.reset}`
            );
          }
        );
      }

      // Clear thinking indicator
      process.stdout.write("\r");
      process.stdout.clearLine(0);

      // Handle tool response
      if (typeof response !== "string" && response.toolCalls) {
        await handleToolCalls(response, messages, mockApp, settings);
      } else {
        // Regular text response
        const text = typeof response === "string" ? response : response.content || "";
        messages.push({ role: "assistant", content: text });

        // Render markdown response
        let rendered = marked.parse(text) as string;

        // Workaround for marked-terminal bug: bold/italic not processed in list items
        rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "\x1b[1m$1\x1b[22m"); // bold
        rendered = rendered.replace(/\*([^*]+)\*/g, "\x1b[3m$1\x1b[23m"); // italic (single asterisk)
        rendered = rendered.replace(/_([^_]+)_/g, "\x1b[3m$1\x1b[23m"); // italic (underscore)

        console.log(`${colors.assistant}Coach:${colors.reset}\n${rendered}`);
      }
    } catch (error) {
      // Clear thinking indicator on error
      process.stdout.write("\r");
      process.stdout.clearLine(0);

      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      // Remove the user message that caused the error
      messages.pop();
    }
  }
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

  getAbstractFileByPath(filePath: string): TFile | null {
    const fullPath = path.join(this.vaultPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const stats = fs.statSync(fullPath);
    const basename = filePath.split("/").pop()?.replace(".md", "") || "";
    return {
      path: filePath,
      basename: basename,
      extension: "md",
      stat: {
        mtime: stats.mtimeMs,
      },
    } as TFile;
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

    // Scan GTD context
    const gtdScanner = new GTDContextScanner(mockApp as any, settings);
    const gtdContext = await gtdScanner.scanContext();

    // Build system prompt
    const systemPrompt = buildSystemPrompt(projects, args.sphere, gtdContext);

    // Create language model
    const languageModelClient = createLanguageModelClient(settings);
    const model = getModelForSettings(settings);

    // Run REPL
    await runREPL(
      languageModelClient,
      model,
      systemPrompt,
      gtdContext,
      projects.length,
      args.sphere,
      mockApp as any,
      settings
    );
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
