// ABOUTME: CLI entry point for conversational GTD coaching across all GTD aspects.
// ABOUTME: Loads Flow projects and GTD context from vault and provides AI-powered advice via REPL.

import * as fs from "fs";
import * as path from "path";
import { PluginSettings, FlowProject } from "./types";
import { GTDContext, GTDContextScanner } from "./gtd-context-scanner";
import { buildProjectHierarchy, flattenHierarchy } from "./project-hierarchy";

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

import * as readline from "readline";
import { LanguageModelClient, ChatMessage, ToolCallResponse, ToolResult } from "./language-model";
import type { TFile, App, CachedMetadata, Vault, MetadataCache } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { withRetry } from "./network-retry";
import { presentToolCallsForApproval } from "./cli-approval";
import { CLI_TOOLS, ToolExecutor } from "./cli-tools";
import { FileWriter } from "./file-writer";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  user: "\x1b[1m\x1b[36m", // Bold cyan for user
  userMessage: "\x1b[3m\x1b[36m", // Italic cyan for user message text
  assistant: "\x1b[35m", // Magenta for assistant
  dim: "\x1b[2m", // Dim for thinking indicator
};

async function handleToolCalls(
  response: ToolCallResponse,
  messages: ChatMessage[],
  client: LanguageModelClient,
  model: string,
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

  // For now, just acknowledge tool execution
  // TODO: Send tool results back to LLM in next iteration (multi-turn support)
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
  console.log(`Press Enter to submit, Shift+Enter for newline`);
  console.log(`Type 'exit' to quit, 'reset' to start fresh conversation, Ctrl+C to exit\n`);

  // Initial system message
  messages.push({
    role: "system",
    content: systemPrompt,
  });

  // Multiline input handling
  let inputBuffer = "";
  let cursorPosition = 0;

  // Enable raw mode for character-by-character input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding("utf8");

  const showPrompt = () => {
    const lines = inputBuffer.split("\n");
    const currentLineIndex = inputBuffer.substring(0, cursorPosition).split("\n").length - 1;
    const cursorInLine =
      cursorPosition - inputBuffer.substring(0, cursorPosition).lastIndexOf("\n") - 1;

    // For multiline: we need to track where we started
    // For single line: just update in place

    if (lines.length === 1) {
      // Simple case: single line
      // Move to start of current line, clear it, rewrite
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`${colors.user}You: ${colors.reset}${lines[0] || ""}`);
      // Position cursor at correct column
      readline.cursorTo(process.stdout, 5 + cursorInLine);
    } else {
      // Multiline case: need to redraw all lines
      // Clear from cursor to end of screen
      readline.clearScreenDown(process.stdout);
      readline.cursorTo(process.stdout, 0);

      // Write all lines
      process.stdout.write(`${colors.user}You: ${colors.reset}${lines[0] || ""}`);
      for (let i = 1; i < lines.length; i++) {
        process.stdout.write(`\n${colors.user}...  ${colors.reset}${lines[i] || ""}`);
      }

      // Move cursor to correct position
      // Go back to start of first line, then move down to current line, then to column
      const visualColumn = 5 + cursorInLine;
      readline.cursorTo(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -(lines.length - 1 - currentLineIndex));
      readline.cursorTo(process.stdout, visualColumn);
    }
  };

  const handleSubmit = async () => {
    const input = inputBuffer.trim();
    inputBuffer = "";
    cursorPosition = 0;

    // Move to end and add newlines
    process.stdout.write("\n\n");

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
      showPrompt();
      return;
    }

    if (input === "list") {
      console.log('Use your initial prompt to see project list, or ask "list all projects"\n');
      showPrompt();
      return;
    }

    if (input === "") {
      showPrompt();
      return;
    }

    // Echo user message in italic
    console.log(`${colors.userMessage}${input}${colors.reset}\n`);

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
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
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
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            const delaySec = (delayMs / 1000).toFixed(1);
            process.stdout.write(
              `${colors.dim}Network error. Retrying in ${delaySec}s... (attempt ${attempt}/5)${colors.reset}`
            );
          }
        );
      }

      // Clear any indicator (thinking or retry)
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      // Handle tool response
      if (typeof response !== "string" && response.toolCalls) {
        await handleToolCalls(response, messages, languageModelClient, model, mockApp, settings);
      } else {
        // Regular text response
        const text = typeof response === "string" ? response : response.content || "";
        messages.push({ role: "assistant", content: text });

        // Render markdown response
        let rendered = marked.parse(text) as string;

        // Workaround for marked-terminal bug #371: bold/italic not processed in list items
        // Manually convert **text** to bold and *text* or _text_ to italic
        rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "\x1b[1m$1\x1b[22m"); // bold
        rendered = rendered.replace(/\*([^*]+)\*/g, "\x1b[3m$1\x1b[23m"); // italic (single asterisk)
        rendered = rendered.replace(/_([^_]+)_/g, "\x1b[3m$1\x1b[23m"); // italic (underscore)

        console.log(`${colors.assistant}Coach:${colors.reset}\n${rendered}`);
      }
    } catch (error) {
      // Clear any indicator on error
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      // Remove the user message that caused the error
      messages.pop();
    }

    showPrompt();
  };

  showPrompt();

  // Track if we're in an escape sequence for Shift+Enter detection
  let escapeBuffer = "";
  let escapeTimeout: NodeJS.Timeout | null = null;

  process.stdin.on("data", async (key: string) => {
    // Handle escape sequences with buffering
    if (escapeBuffer) {
      escapeBuffer += key;

      // Check for Shift+Enter patterns (adds newline in chat mode)
      // Different terminals send different sequences:
      // - Some: ESC + \r or ESC + \n
      // - Some: ESC[13;2~
      // - Some: ESC[27;5;13~
      if (
        escapeBuffer === "\x1b\r" ||
        escapeBuffer === "\x1b\n" ||
        escapeBuffer.includes("[13;2~") ||
        escapeBuffer.includes("[27;5;13~")
      ) {
        if (escapeTimeout) clearTimeout(escapeTimeout);
        escapeBuffer = "";
        // Shift+Enter adds newline (chat pattern)
        inputBuffer =
          inputBuffer.slice(0, cursorPosition) + "\n" + inputBuffer.slice(cursorPosition);
        cursorPosition++;
        showPrompt();
        return;
      }

      // If we have a complete escape sequence that's not Shift+Enter, process it
      if (key === "~" || (escapeBuffer.length >= 3 && !escapeBuffer.includes("["))) {
        if (escapeTimeout) clearTimeout(escapeTimeout);

        // Arrow keys
        if (
          escapeBuffer === "\x1b[A" ||
          escapeBuffer === "\x1b[B" ||
          escapeBuffer === "\x1b[C" ||
          escapeBuffer === "\x1b[D"
        ) {
          // Ignore arrow keys for now
          escapeBuffer = "";
          return;
        }

        // Unknown escape sequence, ignore
        escapeBuffer = "";
        return;
      }

      // Reset timeout - wait for complete sequence
      if (escapeTimeout) clearTimeout(escapeTimeout);
      escapeTimeout = setTimeout(() => {
        escapeBuffer = "";
      }, 100);
      return;
    }

    const byte = key.charCodeAt(0);

    // Ctrl+C
    if (byte === 3) {
      console.log("\nGoodbye!");
      process.exit(0);
    }

    // Ctrl+D (EOF - exit gracefully if buffer empty, otherwise ignore)
    if (byte === 4) {
      if (inputBuffer.trim() === "") {
        console.log("\nGoodbye!");
        process.exit(0);
      }
      return;
    }

    // Backspace or Delete
    if (byte === 127 || byte === 8) {
      if (cursorPosition > 0) {
        inputBuffer = inputBuffer.slice(0, cursorPosition - 1) + inputBuffer.slice(cursorPosition);
        cursorPosition--;
        showPrompt();
      }
      return;
    }

    // ESC - start escape sequence
    if (byte === 27) {
      escapeBuffer = key;
      escapeTimeout = setTimeout(() => {
        escapeBuffer = "";
      }, 100);
      return;
    }

    // Regular Enter (submit in chat pattern) - byte 13 is \r, byte 10 is \n
    if (byte === 13 || byte === 10) {
      await handleSubmit();
      return;
    }

    // Regular printable characters
    if (byte >= 32 && byte <= 126) {
      inputBuffer = inputBuffer.slice(0, cursorPosition) + key + inputBuffer.slice(cursorPosition);
      cursorPosition += key.length;
      showPrompt();
      return;
    }

    // Handle other printable UTF-8 characters
    if (byte > 126) {
      inputBuffer = inputBuffer.slice(0, cursorPosition) + key + inputBuffer.slice(cursorPosition);
      cursorPosition += key.length;
      showPrompt();
      return;
    }
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
