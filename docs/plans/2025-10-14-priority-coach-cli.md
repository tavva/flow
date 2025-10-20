# Priority Coach CLI Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build a standalone Node.js CLI REPL that loads Flow projects from a specified sphere and provides conversational AI-powered prioritization advice.

**Architecture:** Reuse existing vault scanning and LLM client infrastructure. CLI loads plugin settings from Obsidian's data.json, scans vault for projects in specified sphere, builds system prompt with project context, and runs a REPL loop maintaining conversation history across turns.

**Tech Stack:** Node.js, TypeScript, readline, existing flow-scanner.ts, anthropic-client.ts, llm-factory.ts

---

## Task 1: CLI argument parsing and settings loading

**Files:**

- Create: `src/cli.ts`
- Read: `src/types.ts` (for FlowGTDSettings interface)

**Step 1: Write failing test for argument parsing**

Create `tests/cli.test.ts`:

```typescript
import { parseCliArgs } from "../src/cli";

describe("CLI argument parsing", () => {
  it("should parse vault path and sphere", () => {
    const args = ["--vault", "/path/to/vault", "--sphere", "work"];
    const result = parseCliArgs(args);

    expect(result.vaultPath).toBe("/path/to/vault");
    expect(result.sphere).toBe("work");
  });

  it("should throw error if vault path missing", () => {
    const args = ["--sphere", "work"];

    expect(() => parseCliArgs(args)).toThrow("--vault is required");
  });

  it("should throw error if sphere missing", () => {
    const args = ["--vault", "/path/to/vault"];

    expect(() => parseCliArgs(args)).toThrow("--sphere is required");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- cli.test`
Expected: FAIL with "Cannot find module '../src/cli'"

**Step 3: Write minimal implementation**

Create `src/cli.ts`:

```typescript
// ABOUTME: CLI entry point for conversational project prioritization.
// ABOUTME: Loads Flow projects from vault and provides AI-powered advice via REPL.

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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- cli.test`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add tests/cli.test.ts src/cli.ts
git commit -m "feat: add CLI argument parsing for vault path and sphere"
```

---

## Task 2: Settings loading from Obsidian plugin data

**Files:**

- Modify: `src/cli.ts`
- Create: `tests/cli.test.ts` (add new test cases)

**Step 1: Write failing test for settings loading**

Add to `tests/cli.test.ts`:

```typescript
import { loadPluginSettings } from "../src/cli";
import * as fs from "fs";

jest.mock("fs");

describe("Plugin settings loading", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should load settings from Obsidian plugin data.json", () => {
    const mockSettings = {
      provider: "anthropic",
      anthropicApiKey: "test-key",
      anthropicModel: "claude-sonnet-4-20250514",
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

    const result = loadPluginSettings("/path/to/vault");

    expect(fs.readFileSync).toHaveBeenCalledWith(
      "/path/to/vault/.obsidian/plugins/flow-gtd-coach/data.json",
      "utf-8"
    );
    expect(result.provider).toBe("anthropic");
    expect(result.anthropicApiKey).toBe("test-key");
  });

  it("should throw error if settings file does not exist", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    expect(() => loadPluginSettings("/path/to/vault")).toThrow("Plugin settings not found");
  });

  it("should throw error if API key is missing", () => {
    const mockSettings = {
      provider: "anthropic",
      anthropicModel: "claude-sonnet-4-20250514",
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

    expect(() => loadPluginSettings("/path/to/vault")).toThrow("API key not configured");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- cli.test`
Expected: FAIL with "loadPluginSettings is not a function"

**Step 3: Write minimal implementation**

Add to `src/cli.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import { FlowGTDSettings } from "./types";

export function loadPluginSettings(vaultPath: string): FlowGTDSettings {
  const settingsPath = path.join(vaultPath, ".obsidian", "plugins", "flow-gtd-coach", "data.json");

  if (!fs.existsSync(settingsPath)) {
    throw new Error(
      "Plugin settings not found. Please configure the Flow GTD Coach plugin in Obsidian first."
    );
  }

  const settingsJson = fs.readFileSync(settingsPath, "utf-8");
  const settings = JSON.parse(settingsJson) as FlowGTDSettings;

  // Validate API key is present
  if (settings.provider === "anthropic" && !settings.anthropicApiKey) {
    throw new Error("API key not configured. Please set API key in plugin settings.");
  }

  if (settings.provider === "openai-compatible" && !settings.openaiApiKey) {
    throw new Error("API key not configured. Please set API key in plugin settings.");
  }

  return settings;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- cli.test`
Expected: PASS (6 tests total)

**Step 5: Commit**

```bash
git add tests/cli.test.ts src/cli.ts
git commit -m "feat: add plugin settings loader for CLI"
```

---

## Task 3: System prompt builder with project context

**Files:**

- Modify: `src/cli.ts`
- Read: `src/types.ts` (for FlowProject interface)

**Step 1: Write failing test for system prompt generation**

Add to `tests/cli.test.ts`:

```typescript
import { buildSystemPrompt } from "../src/cli";
import { FlowProject } from "../src/types";

describe("System prompt generation", () => {
  it("should build prompt with project context", () => {
    const projects: FlowProject[] = [
      {
        title: "Mobile App",
        description: "Rebuild mobile app with React Native",
        priority: 1,
        status: "live",
        tags: ["project/work"],
        nextActions: ["Set up React Native development environment", "Design authentication flow"],
        filePath: "Projects/Mobile App.md",
      },
      {
        title: "Hiring",
        description: "Hire senior designer for product team",
        priority: 2,
        status: "live",
        tags: ["project/work"],
        nextActions: ["Review candidate portfolios", "Schedule interviews"],
        filePath: "Projects/Hiring.md",
      },
    ];

    const prompt = buildSystemPrompt(projects, "work");

    expect(prompt).toContain("Mobile App");
    expect(prompt).toContain("Rebuild mobile app with React Native");
    expect(prompt).toContain("Priority: 1");
    expect(prompt).toContain("Set up React Native development environment");
    expect(prompt).toContain("Hiring");
    expect(prompt).toContain("2 projects");
  });

  it("should mention sphere in prompt", () => {
    const projects: FlowProject[] = [];
    const prompt = buildSystemPrompt(projects, "work");

    expect(prompt).toContain("work sphere");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- cli.test`
Expected: FAIL with "buildSystemPrompt is not a function"

**Step 3: Write minimal implementation**

Add to `src/cli.ts`:

```typescript
import { FlowProject } from "./types";

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
    prompt += `**Description:** ${project.description || "No description"}\n`;
    prompt += `**Priority:** ${project.priority}\n`;
    prompt += `**Status:** ${project.status}\n`;

    if (project.nextActions && project.nextActions.length > 0) {
      prompt += `**Next Actions:**\n`;
      for (const action of project.nextActions) {
        prompt += `- ${action}\n`;
      }
    } else {
      prompt += `**Next Actions:** None defined\n`;
    }

    prompt += `\n`;
  }

  return prompt;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- cli.test`
Expected: PASS (8 tests total)

**Step 5: Commit**

```bash
git add tests/cli.test.ts src/cli.ts
git commit -m "feat: add system prompt builder with project context"
```

---

## Task 4: REPL loop with conversation history

**Files:**

- Modify: `src/cli.ts`

**Step 1: Write REPL implementation (no test - integration testing manually)**

Add to `src/cli.ts`:

```typescript
import * as readline from "readline";
import { LanguageModel, Message } from "./language-model";

export async function runREPL(
  languageModel: LanguageModel,
  systemPrompt: string,
  projectCount: number,
  sphere: string
): Promise<void> {
  const messages: Message[] = [];

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
      const response = await languageModel.sendMessage(messages);

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
```

**Step 2: Manual verification (after Task 5 complete)**

Will verify REPL functionality when running the complete CLI.

**Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add REPL loop with conversation history"
```

---

## Task 5: Main CLI entry point and execution

**Files:**

- Modify: `src/cli.ts`
- Modify: `package.json`

**Step 1: Write main CLI function**

Add to `src/cli.ts`:

```typescript
import { TFile } from "obsidian";
import { FlowScanner } from "./flow-scanner";
import { createLanguageModel } from "./llm-factory";

// Mock Obsidian vault for CLI usage
class MockVault {
  constructor(private vaultPath: string) {}

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
          // Create mock TFile
          files.push({
            path: path.relative(this.vaultPath, fullPath),
            basename: entry.name.replace(".md", ""),
            extension: "md",
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
    const mockVault = new MockVault(args.vaultPath);
    const scanner = new FlowScanner(mockVault as any);
    const allProjects = await scanner.scanVault();

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
    const languageModel = createLanguageModel(settings);

    // Run REPL
    await runREPL(languageModel, systemPrompt, projects.length, args.sphere);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
```

**Step 2: Add CLI script to package.json**

Modify `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "lint": "tsc -noEmit -skipLibCheck",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "evaluate": "ts-node -P evaluation/tsconfig.json evaluation/run-evaluation.ts",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "priority-coach": "ts-node src/cli.ts"
  }
}
```

**Step 3: Run type check**

Run: `npm run lint`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/cli.ts package.json
git commit -m "feat: add main CLI entry point and npm script"
```

---

## Task 6: Manual end-to-end testing

**Files:**

- None (testing only)

**Step 1: Test with valid vault**

Run: `npm run priority-coach -- --vault /path/to/your/vault --sphere work`

Expected:

- Loads projects successfully
- Shows project count
- REPL prompt appears
- Can ask questions and get responses

**Step 2: Test conversation flow**

In REPL, test:

1. Ask "what projects do I have?"
2. Ask "my priorities this month are X and Y, what should I focus on?"
3. Ask follow-up questions
4. Verify conversation context is maintained
5. Test 'reset' command
6. Test 'exit' command

**Step 3: Test error handling**

Test invalid scenarios:

- Missing --vault argument
- Missing --sphere argument
- Non-existent vault path
- Vault without plugin settings
- Vault with missing API key

**Step 4: Document any issues found**

If issues found, create follow-up tasks to fix them.

---

## Task 7: Add CLI documentation

**Files:**

- Modify: `CLAUDE.md`
- Create: `docs/priority-coach-cli.md`

**Step 1: Create CLI documentation**

Create `docs/priority-coach-cli.md`:

````markdown
# Priority Coach CLI

A conversational CLI tool for AI-powered project prioritisation using your Flow vault data.

## Overview

The Priority Coach CLI loads your Flow projects from a specified sphere and provides an interactive REPL where you can have conversations with an AI assistant about prioritising your work.

## Installation

No separate installation needed - the CLI is part of the Flow GTD Coach plugin repository.

## Usage

```bash
npm run priority-coach -- --vault /path/to/vault --sphere work
```
````

**Required arguments:**

- `--vault` - Path to your Obsidian vault
- `--sphere` - Sphere to filter projects (e.g., 'work', 'personal')

## Configuration

The CLI uses the same API key and model configuration as the Obsidian plugin. Configure these in Obsidian via Settings → Flow GTD Coach before using the CLI.

## REPL Commands

- `exit` or `quit` - Exit the CLI
- `reset` - Start a fresh conversation (clears history)
- `list` - Reminder to ask the AI to list projects

## Example Session

```
$ npm run priority-coach -- --vault ~/my-vault --sphere work

Flow Priority Coach - work sphere (15 projects loaded)
Type 'exit' to quit, 'reset' to start fresh conversation, 'list' to show projects

> my priorities this month are shipping the mobile app and hiring a designer

Based on your priorities, I'd recommend focusing on:

1. **Mobile App** (Priority 1) - This aligns directly with your goal...
[conversation continues]

> which project should I tackle first this week?

[AI responds with specific recommendation]

> exit
Goodbye!
```

## Conversation Context

The CLI maintains conversation history across turns, so you can have natural back-and-forth discussions. The AI remembers your stated priorities and previous questions within the session.

## Project Context Provided

For each project, the AI sees:

- Project name
- Description
- Priority level (1-3)
- Status
- Next actions

## Tips

- Be specific about your constraints (time, resources, dependencies)
- Mention deadlines or time horizons when relevant
- Ask follow-up questions to drill into specific projects
- Use 'reset' if you want to start a fresh prioritisation conversation

````

**Step 2: Update CLAUDE.md**

Add CLI section to `CLAUDE.md` in "Common Commands":

```markdown
### Priority Coach CLI

```bash
# Interactive prioritisation coaching for a specific sphere
npm run priority-coach -- --vault /path/to/vault --sphere work
````

See `docs/priority-coach-cli.md` for full CLI documentation.

````

**Step 3: Commit**

```bash
git add docs/priority-coach-cli.md CLAUDE.md
git commit -m "docs: add Priority Coach CLI documentation"
````

---

## Task 8: Run full test suite and format check

**Files:**

- All modified files

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (165+ tests)

**Step 2: Run format check**

Run: `npm run format:check`
Expected: All files properly formatted

**Step 3: Format if needed**

If format check fails:
Run: `npm run format`

**Step 4: Run type check**

Run: `npm run lint`
Expected: No type errors

**Step 5: Final commit if formatting applied**

```bash
git add -A
git commit -m "chore: apply formatting"
```

---

## Completion Checklist

- [ ] CLI argument parsing implemented and tested
- [ ] Plugin settings loading implemented and tested
- [ ] System prompt builder implemented and tested
- [ ] REPL loop with conversation history implemented
- [ ] Main CLI entry point complete
- [ ] npm script added to package.json
- [ ] Manual end-to-end testing completed
- [ ] CLI documentation written
- [ ] All tests passing
- [ ] Code formatted
- [ ] Type check passing

## Future Enhancements (Not in Scope)

- Add deadline/target date support to projects
- Support filtering by project status
- Add command to refresh project data mid-session
- Export conversation transcripts
- Support for custom system prompt templates
