// ABOUTME: CLI entry point for conversational GTD coaching across all GTD aspects.
// ABOUTME: Loads Flow projects and GTD context from vault and provides AI-powered advice via REPL with Ink input.

import * as fs from "fs";
import * as path from "path";
import React from "react";
import { PluginSettings, FlowProject } from "./types";
import { GTDContext, GTDContextScanner } from "./gtd-context-scanner";
import { buildProjectHierarchy, flattenHierarchy } from "./project-hierarchy";
import { render } from "ink";
import { InboxApp } from "./components/InboxApp";
import type { App, CachedMetadata } from "obsidian";
import { TFile } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { LanguageModelClient, ChatMessage, ToolCallResponse } from "./language-model";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { withRetry } from "./network-retry";
import { presentToolCallsForApproval } from "./cli-approval";
import { COACH_TOOLS, ToolExecutor } from "./coach-tools";
import { FileWriter } from "./file-writer";
import wrapAnsi from 'wrap-ansi';
import { SystemAnalyzer, SystemIssues } from "./system-analyzer";
import { scanReviewProtocols } from './protocol-scanner';
import { matchProtocolsForTime } from './protocol-matcher';
import { ReviewProtocol } from './types';

/**
 * Wraps text to terminal width whilst preserving ANSI color codes.
 * Uses process.stdout.columns with 80-column fallback.
 */
function wrapForTerminal(text: string): string {
  const width = process.stdout.columns || 80;
  return wrapAnsi(text, width, { hard: false, trim: false });
}

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
  gtdContext: GTDContext,
  protocol?: ReviewProtocol
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

  prompt += `The Flow System:\n`;
  prompt += `Flow is a GTD implementation for Obsidian with specific conventions:\n\n`;
  prompt += `Spheres:\n`;
  prompt += `- Life areas for categorising projects (work, personal, etc.)\n`;
  prompt += `- Projects belong to one sphere via their tags (project/work, project/personal)\n`;
  prompt += `- You are currently coaching in the ${sphere} sphere\n\n`;
  prompt += `File Organisation:\n`;
  prompt += `- Projects folder: Individual project files\n`;
  prompt += `- Next actions file: Central list for actions not tied to specific projects\n`;
  prompt += `- Someday file: Future aspirations and maybes\n`;
  prompt += `- Inbox: Unprocessed items awaiting GTD categorisation\n\n`;
  prompt += `Project Structure:\n`;
  prompt += `- Projects are Markdown files with frontmatter (tags, priority, status, creation-date)\n`;
  prompt += `- Sub-projects reference parents using parent-project: "[[Parent Name]]" in frontmatter\n`;
  prompt += `- Next actions are Markdown checkboxes under "## Next actions" heading\n`;
  prompt += `- Projects should have clear outcomes (what does "done" look like?)\n`;
  prompt += `- Priority: 1-5 scale (1=highest priority, 5=lowest priority)\n\n`;
  prompt += `Project Statuses:\n`;
  prompt += `- live: Active projects with ongoing work\n`;
  prompt += `- hold: Paused projects (waiting on external factors)\n`;
  prompt += `- archived: Completed or cancelled projects\n`;
  prompt += `- someday: Projects not yet committed to\n\n`;

  prompt += `Your role is to provide expert GTD advice:\n`;
  prompt += `- Help prioritise projects and actions based on goals, context, energy, and time\n`;
  prompt += `- Review project quality: Are outcomes clear? Are next actions specific and actionable?\n`;
  prompt += `- Coach on GTD processes: weekly reviews, inbox processing, project planning\n`;
  prompt += `- Answer methodology questions about GTD principles and best practices\n`;
  prompt += `- Identify issues: projects with no next actions, vague actions, unclear outcomes\n\n`;

  prompt += `You can suggest and apply changes to help improve the GTD system:\n`;
  prompt += `- Move important actions to the focus for today\n`;
  prompt += `- Improve vague or unclear next actions to be more specific\n`;
  prompt += `- Add missing next actions to projects\n`;
  prompt += `- Update project status (archive completed projects, etc.)\n\n`;
  prompt += `When you identify improvements, use the available tools to suggest changes. `;
  prompt += `The user will review and approve each suggestion before it's applied.\n\n`;
  prompt += `IMPORTANT: You should only add actions to projects with status 'live'. `;
  prompt += `Projects with other statuses (hold, archived, etc.) are not active and should not have new actions added.\n\n`;

  prompt += `Communication Style:\n`;
  prompt += `- Ask questions only when the current instructions are ambiguous or incomplete\n`;
  prompt += `- Never ask open-ended, reflective, or rapport-building questions\n`;
  prompt += `- Focus on providing actionable GTD advice based on the data\n\n`;

  prompt += `Opening Message Format:\n`;
  prompt += `- When asked to provide an opening summary, be brief and data-driven\n`;
  prompt += `- State what you observe (e.g., "5 projects are stalled")\n`;
  prompt += `- Always provide exactly 3 numbered options for what to work on\n`;
  prompt += `- Use high-level counts only, never list specific project names in the opening\n`;
  prompt += `- If system is healthy, note this positively and suggest proactive actions\n\n`;

  prompt += `GTD Quality Standards:\n`;
  prompt += `- Next actions must start with a verb, be specific, and completable in one sitting\n`;
  prompt += `- Project outcomes should be clear and measurable (what does "done" look like?)\n`;
  prompt += `- Projects need at least one next action to maintain momentum\n\n`;

  prompt += `Weekly Review Protocol:\n`;
  prompt += `When the user asks for help with a weekly review, guide them through these steps:\n`;
  prompt += `1. Process inbox to zero\n`;
  prompt += `2. Review projects (identify stalled, suggest improvements)\n`;
  prompt += `3. Review next actions (improve clarity, suggest focus items)\n`;
  prompt += `4. Review someday/maybe (activate items, prune irrelevant)\n`;
  prompt += `5. Review waiting-for (identify follow-ups)\n`;
  prompt += `6. Set weekly focus\n\n`;
  prompt += `For each step:\n`;
  prompt += `- Present relevant data using the context you have\n`;
  prompt += `- Highlight issues (stalled projects, vague actions, overdue items)\n`;
  prompt += `- Suggest improvements using available tools\n`;
  prompt += `- Wait for acknowledgment before proceeding\n`;
  prompt += `- Accept questions or requests to skip steps\n\n`;

  // Add custom review protocol if provided
  if (protocol) {
    prompt += `Custom Review in Progress:\n`;
    prompt += `The user has selected the "${protocol.name}" review. Follow the protocol below:\n\n`;
    prompt += `---\n${protocol.content}\n---\n\n`;
    prompt += `Follow this protocol step-by-step. After presenting each section or completing each task, `;
    prompt += `wait for the user to acknowledge before moving to the next step.\n\n`;
  }

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
      prompt += `${indent}File: ${project.file}\n`;
      prompt += `${indent}Description: ${project.description || "No description"}\n`;
      prompt += `${indent}Priority: ${project.priority} (1=highest, 5=lowest)\n`;
      prompt += `${indent}Status: ${project.status}\n`;

      if (node.depth > 0) {
        prompt += `${indent}(Sub-project at depth ${node.depth})\n`;
      }

      // Warn about non-live projects
      if (project.status !== "live") {
        prompt += `${indent}⚠️ Project is paused - do not add actions to this project\n`;
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
  user: "\x1b[36m", // Cyan for user
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
        console.log(`  ✗ ${wrapForTerminal(result.content)}`);
      } else {
        console.log(`  ${wrapForTerminal(result.content)}`);
      }
    }
  }

  // Acknowledge tool execution
  const summary = `Completed ${approval.approvedToolIds.length} of ${toolCalls!.length} suggested changes.`;
  messages.push({ role: "assistant", content: summary });
  console.log(`\n${colors.assistant}Coach:${colors.reset} ${wrapForTerminal(summary)}\n`);
}

export function buildAnalysisPrompt(issues: SystemIssues): string {
  let prompt = "Based on the system context you have, provide a brief opening summary.\n\n";

  if (issues.hasIssues) {
    prompt += "Issues detected:\n";
    if (issues.stalledProjects > 0) {
      prompt += `- ${issues.stalledProjects} projects have no next actions (stalled)\n`;
    }
    if (issues.inboxNeedsAttention) {
      prompt += `- ${issues.inboxCount} inbox items need processing\n`;
    }
    prompt +=
      "\nProvide a brief summary of these issues and suggest 3 numbered options to address them.\n";
  } else {
    prompt +=
      "The system looks healthy - no stalled projects, inbox is under control.\n\n";
    prompt +=
      "Provide a brief positive summary and suggest 3 numbered options for proactive work.\n";
  }

  prompt += "\nFormat: Brief observation paragraph, then numbered list of 3 options.\n";
  prompt += "Keep it concise. High-level counts only, no specific project names or examples.";

  return prompt;
}

function detectProtocolInvocation(input: string, protocols: ReviewProtocol[]): ReviewProtocol | null {
  const lowerInput = input.toLowerCase();

  // Check for review/protocol invocation patterns
  const patterns = [
    /(?:run|start|do|begin)\s+(?:the\s+)?(.+?)\s+(?:review|protocol)/i,
    /(?:review|protocol):\s*(.+)/i,
    /^(.+?)\s+review$/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const searchTerm = match[1].trim().toLowerCase();

      // Try to find matching protocol
      const protocol = protocols.find(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.filename.toLowerCase().includes(searchTerm)
      );

      if (protocol) {
        return protocol;
      }
    }
  }

  return null;
}

export async function runREPL(
  languageModelClient: LanguageModelClient,
  model: string,
  systemPrompt: string,
  gtdContext: GTDContext,
  projects: FlowProject[],
  projectCount: number,
  sphere: string,
  mockApp: App,
  settings: PluginSettings,
  protocols: ReviewProtocol[]
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

  // Auto-send opening analysis
  const issues = SystemAnalyzer.analyze(gtdContext, projects);
  const analysisPrompt = buildAnalysisPrompt(issues);

  messages.push({
    role: "user",
    content: analysisPrompt,
  });

  try {
    // Show thinking indicator
    process.stdout.write(`${colors.dim}Processing...${colors.reset}`);

    // Get AI's formatted opening
    const openingResponse = await withRetry(
      () =>
        languageModelClient.sendMessage({
          model,
          maxTokens: 500,
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

    // Clear thinking indicator
    process.stdout.write("\r");
    if (typeof process.stdout.clearLine === "function") {
      process.stdout.clearLine(0);
    }

    // Render markdown opening
    let rendered = marked.parse(openingResponse) as string;
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "\x1b[1m$1\x1b[22m");
    rendered = rendered.replace(/\*([^*]+)\*/g, "\x1b[3m$1\x1b[23m");
    rendered = rendered.replace(/_([^_]+)_/g, "\x1b[3m$1\x1b[23m");

    console.log(`${colors.assistant}Coach:${colors.reset}\n${wrapForTerminal(rendered)}`);

    messages.push({ role: "assistant", content: openingResponse });
  } catch (error) {
    // Clear thinking indicator on error
    process.stdout.write("\r");
    if (typeof process.stdout.clearLine === "function") {
      process.stdout.clearLine(0);
    }

    console.error(
      `\nError generating opening message: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Continuing to REPL...\n");
  }

  // REPL loop
  while (true) {
    // Get user input via Ink
    const userInput = await new Promise<string>((resolve) => {
      const { unmount } = render(
        <InboxApp
          onComplete={(text) => {
            unmount();
            // Echo user message immediately after unmounting so it stays visible
            console.log(`${colors.user}You:${colors.reset} ${text.trim()}\n`);
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

    // Check for protocol invocation
    const invokedProtocol = detectProtocolInvocation(input, protocols);
    if (invokedProtocol) {
      console.log(`Loading ${invokedProtocol.name}...\n`);

      // Add protocol content as a system message
      messages.push({
        role: "system",
        content: `The user has requested the "${invokedProtocol.name}" review. Follow the protocol below:\n\n---\n${invokedProtocol.content}\n---\n\nFollow this protocol step-by-step. After presenting each section or completing each task, wait for the user to acknowledge before moving to the next step.`,
      });

      // Add confirmation message from user
      messages.push({
        role: "user",
        content: `Let's do the ${invokedProtocol.name}.`,
      });
    } else {
      // Add user message as normal
      messages.push({
        role: "user",
        content: input,
      });
    }

    try {
      // Show thinking indicator
      process.stdout.write(`${colors.dim}Thinking...${colors.reset}`);

      let response: string | ToolCallResponse;

      if (supportsTools) {
        response = await withRetry(
          () =>
            languageModelClient.sendMessageWithTools!(
              { model, maxTokens: 4000, messages },
              COACH_TOOLS
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
      if (typeof process.stdout.clearLine === 'function') {
        process.stdout.clearLine(0);
      }

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

        console.log(`${colors.assistant}Coach:${colors.reset}\n${wrapForTerminal(rendered)}`);
      }
    } catch (error) {
      // Clear thinking indicator on error
      process.stdout.write("\r");
      if (typeof process.stdout.clearLine === 'function') {
        process.stdout.clearLine(0);
      }

      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      // Remove the user message that caused the error
      messages.pop();
    }
  }
}

// Mock TFile for CLI usage (cannot instantiate real TFile outside Obsidian)
class MockTFile {
  path: string = "";
  basename: string = "";
  extension: string = "";
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  } = { ctime: 0, mtime: 0, size: 0 };
}

// Mock Obsidian App for CLI usage
class MockVault {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  getMarkdownFiles(): MockTFile[] {
    const files: MockTFile[] = [];
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
          const tfile = new MockTFile();
          tfile.path = relativePath;
          tfile.basename = entry.name.replace(".md", "");
          tfile.extension = "md";
          tfile.stat = {
            ctime: stats.ctimeMs,
            mtime: stats.mtimeMs,
            size: stats.size,
          };
          files.push(tfile);
        }
      }
    };

    walkDir(this.vaultPath);
    return files;
  }

  async read(file: MockTFile): Promise<string> {
    const fullPath = path.join(this.vaultPath, file.path);
    return fs.readFileSync(fullPath, "utf-8");
  }

  async modify(file: MockTFile, data: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, file.path);
    fs.writeFileSync(fullPath, data, "utf-8");
  }

  getAbstractFileByPath(filePath: string): MockTFile | null {
    const fullPath = path.join(this.vaultPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const stats = fs.statSync(fullPath);
    const basename = filePath.split("/").pop()?.replace(".md", "") || "";
    const tfile = new MockTFile();
    tfile.path = filePath;
    tfile.basename = basename;
    tfile.extension = "md";
    tfile.stat = {
      ctime: stats.ctimeMs,
      mtime: stats.mtimeMs,
      size: stats.size,
    };
    return tfile;
  }
}

class MockMetadataCache {
  private vault: MockVault;
  private cache: Map<string, CachedMetadata | null> = new Map();

  constructor(vault: MockVault) {
    this.vault = vault;
  }

  getFileCache(file: MockTFile): CachedMetadata | null {
    // Check cache first
    if (this.cache.has(file.path)) {
      return this.cache.get(file.path)!;
    }

    try {
      // Quick check: only files starting with "---" have frontmatter
      const fullPath = path.join((this.vault as any).vaultPath, file.path);
      const fd = fs.openSync(fullPath, "r");
      const startBuffer = Buffer.alloc(3);
      fs.readSync(fd, startBuffer, 0, 3, 0);

      if (startBuffer.toString() !== "---") {
        // No frontmatter, cache and return null
        fs.closeSync(fd);
        this.cache.set(file.path, null);
        return null;
      }

      // Read full file for frontmatter parsing
      const stats = fs.fstatSync(fd);
      const fullBuffer = Buffer.alloc(stats.size);
      fs.readSync(fd, fullBuffer, 0, stats.size, 0);
      fs.closeSync(fd);

      const content = fullBuffer.toString("utf-8");
      const frontmatter = this.extractFrontmatter(content);

      const metadata = {
        frontmatter: frontmatter || undefined,
      } as CachedMetadata;

      this.cache.set(file.path, metadata);
      return metadata;
    } catch (error) {
      this.cache.set(file.path, null);
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

function getCurrentTimeDescription(): string {
  const now = new Date();
  const hour = now.getHours();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[now.getDay()];

  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 18) {
    timeOfDay = 'afternoon';
  } else if (hour >= 18 || hour < 5) {
    timeOfDay = 'evening';
  }

  return `${day} ${timeOfDay}`;
}

export async function main() {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    // Clear the current line to remove any rendered cursor
    process.stdout.write('\r\x1b[K');
    console.log('\nGoodbye!');
    process.exit(0);
  });

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

    // Check if AI is enabled
    if (!settings.aiEnabled) {
      console.error("Error: AI features are disabled in plugin settings.");
      console.error(
        "Please enable AI features in Obsidian → Settings → Flow GTD Coach → Enable AI features"
      );
      process.exit(1);
    }

    // Scan for review protocols
    const protocols = scanReviewProtocols(args.vaultPath);
    const matchedProtocols = matchProtocolsForTime(protocols, new Date());

    // If protocols matched, offer to run one
    let selectedProtocol: ReviewProtocol | null = null;
    if (matchedProtocols.length > 0) {
      console.log('\nI found these reviews for ' + getCurrentTimeDescription() + ':');
      matchedProtocols.forEach((protocol, index) => {
        console.log(`${index + 1}. ${protocol.name}`);
      });
      console.log('\nWould you like to run one? (type number, name, or "no")\n');

      // Get user selection
      const selection = await new Promise<string>((resolve) => {
        const { unmount } = render(
          <InboxApp
            onComplete={(text) => {
              unmount();
              console.log(`${colors.user}You:${colors.reset} ${text.trim()}\n`);
              resolve(text);
            }}
          />
        );
      });

      const trimmed = selection.trim().toLowerCase();

      // Parse selection
      if (trimmed !== 'no' && trimmed !== '') {
        // Try to parse as number
        const index = parseInt(trimmed, 10);
        if (!isNaN(index) && index >= 1 && index <= matchedProtocols.length) {
          selectedProtocol = matchedProtocols[index - 1];
        } else {
          // Try to match by name (case-insensitive partial match)
          const match = matchedProtocols.find(p =>
            p.name.toLowerCase().includes(trimmed) ||
            p.filename.toLowerCase().includes(trimmed)
          );
          if (match) {
            selectedProtocol = match;
          } else {
            console.log(`Could not find review matching "${selection}". Continuing without review.\n`);
          }
        }
      }

      if (selectedProtocol) {
        console.log(`Starting ${selectedProtocol.name}...\n`);
      }
    }

    // Scan vault for projects
    const mockApp = new MockApp(args.vaultPath);
    const scanner = new FlowProjectScanner(mockApp as any);
    const allProjects = await scanner.scanProjects();

    // Determine which spheres to include
    let spheresToInclude: string[];
    let sphereLabel: string;

    if (selectedProtocol && selectedProtocol.spheres && selectedProtocol.spheres.length > 0) {
      // Protocol specifies spheres - use those instead
      spheresToInclude = selectedProtocol.spheres;
      sphereLabel = spheresToInclude.join(', ');
    } else {
      // Use CLI argument sphere
      spheresToInclude = [args.sphere];
      sphereLabel = args.sphere;
    }

    // Filter projects by sphere(s)
    const projects = allProjects.filter((project) =>
      project.tags.some((tag) =>
        spheresToInclude.some(sphere => tag === `project/${sphere}`)
      )
    );

    if (projects.length === 0) {
      console.warn(`Warning: No projects found for sphere(s) "${sphereLabel}"`);
      console.warn("Continuing anyway - you can discuss why projects might be missing.\n");
    }

    // Scan GTD context
    const gtdScanner = new GTDContextScanner(mockApp as any, settings);
    const gtdContext = await gtdScanner.scanContext();

    // Build system prompt with protocol if selected
    const systemPrompt = buildSystemPrompt(
      projects,
      sphereLabel,
      gtdContext,
      selectedProtocol ?? undefined
    );

    // Create language model
    const languageModelClient = createLanguageModelClient(settings);
    if (!languageModelClient) {
      console.error("Error: Failed to create language model client.");
      console.error("Please check your API key settings in the Flow GTD Coach plugin.");
      process.exit(1);
    }

    const model = getModelForSettings(settings);

    // Run REPL
    await runREPL(
      languageModelClient,
      model,
      systemPrompt,
      gtdContext,
      projects,
      projects.length,
      sphereLabel,
      mockApp as any,
      settings,
      protocols
    );
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// NOTE: Entry point logic moved to cli-entry.mts to avoid import.meta parse errors in Jest
// This allows tests to import functions from cli.tsx without triggering syntax errors
