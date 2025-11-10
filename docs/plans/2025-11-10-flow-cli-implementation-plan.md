# Flow CLI Quick Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build standalone CLI tool that captures text to Flow inbox file configured in plugin settings.

**Architecture:** Standalone npm package with zero runtime dependencies. Reads config from `~/.config/flow-cli/config.json` for vault path, reads plugin settings from vault's `.obsidian/plugins/flow/data.json` for inbox file path, appends text to inbox file.

**Tech Stack:** TypeScript, esbuild, Jest, Node.js built-ins (fs, path, readline)

---

## Phase 1: Project Setup

### Task 1: Create CLI Package Structure

**Files:**
- Create: `flow-cli/package.json`
- Create: `flow-cli/tsconfig.json`
- Create: `flow-cli/.prettierrc.json`
- Create: `flow-cli/.gitignore`
- Create: `flow-cli/README.md`
- Create: `flow-cli/src/.gitkeep`
- Create: `flow-cli/tests/.gitkeep`

**Step 1: Create package directory**

```bash
mkdir -p flow-cli/src flow-cli/tests flow-cli/dist
cd flow-cli
```

**Step 2: Write package.json**

```json
{
  "name": "@flow/cli",
  "version": "0.1.0",
  "description": "Quick capture CLI for Flow GTD",
  "main": "dist/index.js",
  "bin": {
    "flow": "./dist/index.js"
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "dev": "node esbuild.config.mjs --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,md}\""
  },
  "keywords": ["flow", "gtd", "cli", "quick-capture"],
  "author": "Ben",
  "license": "MIT",
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.19",
    "esbuild": "^0.25.0",
    "jest": "^29.7.0",
    "prettier": "^3.6.2",
    "ts-jest": "^29.1.2",
    "typescript": "^5.3.3"
  }
}
```

**Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Write .prettierrc.json**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

**Step 5: Write .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
coverage/
.idea/
.vscode/
```

**Step 6: Write README.md**

```markdown
# Flow CLI

Quick capture CLI for Flow GTD.

## Installation

```bash
npm install -g @flow/cli
```

## Usage

```bash
flow "buy milk"
```

## Configuration

First run will prompt for vault path. Configure manually with:

```bash
flow --config
```
```

**Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize flow-cli package structure"
```

---

### Task 2: Set Up Build Configuration

**Files:**
- Create: `flow-cli/esbuild.config.mjs`

**Step 1: Write esbuild config**

```javascript
import esbuild from "esbuild";

const production = process.argv.includes("production");

const context = await esbuild.context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node16",
  outfile: "dist/index.js",
  format: "cjs",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [],
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  console.log("Watching for changes...");
  await context.watch();
}
```

**Step 2: Commit**

```bash
git add esbuild.config.mjs
git commit -m "chore: add esbuild configuration"
```

---

### Task 3: Set Up Jest Configuration

**Files:**
- Create: `flow-cli/jest.config.js`

**Step 1: Write Jest config**

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**Step 2: Install dependencies**

Run: `npm install`

Expected: All devDependencies installed successfully

**Step 3: Commit**

```bash
git add jest.config.js package-lock.json
git commit -m "chore: add Jest configuration and install dependencies"
```

---

## Phase 2: Core Types

### Task 4: Define TypeScript Types

**Files:**
- Create: `flow-cli/src/types.ts`
- Create: `flow-cli/tests/types.test.ts`

**Step 1: Write failing test**

```typescript
// tests/types.test.ts
// ABOUTME: Tests for core type definitions
// ABOUTME: Validates Config and PluginSettings structure

import { Config, PluginSettings } from "../src/types";

describe("Types", () => {
  describe("Config", () => {
    it("should have defaultVault property", () => {
      const config: Config = {
        defaultVault: "/path/to/vault",
      };
      expect(config.defaultVault).toBe("/path/to/vault");
    });
  });

  describe("PluginSettings", () => {
    it("should have cliInboxFile property", () => {
      const settings: PluginSettings = {
        cliInboxFile: "inbox.md",
      };
      expect(settings.cliInboxFile).toBe("inbox.md");
    });

    it("should allow additional properties", () => {
      const settings: PluginSettings = {
        cliInboxFile: "inbox.md",
        otherSetting: "value",
      };
      expect(settings.otherSetting).toBe("value");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/types'

**Step 3: Write minimal implementation**

```typescript
// src/types.ts
// ABOUTME: Core type definitions for Flow CLI
// ABOUTME: Config and PluginSettings interfaces

export interface Config {
  defaultVault: string;
}

export interface PluginSettings {
  cliInboxFile: string;
  [key: string]: unknown;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add core type definitions"
```

---

## Phase 3: Config Module

### Task 5: Implement readConfig Function

**Files:**
- Create: `flow-cli/src/config.ts`
- Create: `flow-cli/tests/config.test.ts`

**Step 1: Write failing test**

```typescript
// tests/config.test.ts
// ABOUTME: Tests for CLI configuration file management
// ABOUTME: Covers reading, writing, and prompting for vault path

import * as fs from "fs";
import * as path from "path";
import { readConfig, writeConfig, getConfigPath } from "../src/config";

describe("Config", () => {
  const testConfigDir = path.join(__dirname, ".test-config");
  const testConfigPath = path.join(testConfigDir, "config.json");

  beforeEach(() => {
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true });
    }
  });

  describe("getConfigPath", () => {
    it("should return config file path", () => {
      const configPath = getConfigPath();
      expect(configPath).toContain(".config");
      expect(configPath).toContain("flow-cli");
      expect(configPath).toContain("config.json");
    });
  });

  describe("readConfig", () => {
    it("should return null if config file does not exist", () => {
      const config = readConfig(testConfigPath);
      expect(config).toBeNull();
    });

    it("should read existing config file", () => {
      // Create test config
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(
        testConfigPath,
        JSON.stringify({ defaultVault: "/test/vault" })
      );

      const config = readConfig(testConfigPath);
      expect(config).toEqual({ defaultVault: "/test/vault" });
    });

    it("should return null for invalid JSON", () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, "invalid json");

      const config = readConfig(testConfigPath);
      expect(config).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/config'

**Step 3: Write minimal implementation**

```typescript
// src/config.ts
// ABOUTME: CLI configuration file management
// ABOUTME: Handles reading and writing vault path to ~/.config/flow-cli/config.json

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Config } from "./types";

export function getConfigPath(): string {
  return path.join(os.homedir(), ".config", "flow-cli", "config.json");
}

export function readConfig(configPath?: string): Config | null {
  const filePath = configPath || getConfigPath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as Config;
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add readConfig function"
```

---

### Task 6: Implement writeConfig Function

**Files:**
- Modify: `flow-cli/src/config.ts`
- Modify: `flow-cli/tests/config.test.ts`

**Step 1: Write failing test**

```typescript
// tests/config.test.ts - add to existing describe("Config") block

  describe("writeConfig", () => {
    it("should write config to file", () => {
      const config = { defaultVault: "/test/vault" };
      writeConfig(config, testConfigPath);

      const written = fs.readFileSync(testConfigPath, "utf-8");
      expect(JSON.parse(written)).toEqual(config);
    });

    it("should create config directory if missing", () => {
      expect(fs.existsSync(testConfigDir)).toBe(false);

      const config = { defaultVault: "/test/vault" };
      writeConfig(config, testConfigPath);

      expect(fs.existsSync(testConfigDir)).toBe(true);
      expect(fs.existsSync(testConfigPath)).toBe(true);
    });

    it("should overwrite existing config", () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(
        testConfigPath,
        JSON.stringify({ defaultVault: "/old/vault" })
      );

      const config = { defaultVault: "/new/vault" };
      writeConfig(config, testConfigPath);

      const written = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
      expect(written.defaultVault).toBe("/new/vault");
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - writeConfig is not defined

**Step 3: Write minimal implementation**

```typescript
// src/config.ts - add to existing file

export function writeConfig(config: Config, configPath?: string): void {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add writeConfig function"
```

---

## Phase 4: Plugin Settings Module

### Task 7: Implement readPluginSettings Function

**Files:**
- Create: `flow-cli/src/plugin-settings.ts`
- Create: `flow-cli/tests/plugin-settings.test.ts`

**Step 1: Write failing test**

```typescript
// tests/plugin-settings.test.ts
// ABOUTME: Tests for reading Flow plugin settings from vault
// ABOUTME: Validates error handling for missing or invalid settings

import * as fs from "fs";
import * as path from "path";
import { readPluginSettings } from "../src/plugin-settings";

describe("Plugin Settings", () => {
  const testVaultDir = path.join(__dirname, ".test-vault");
  const obsidianDir = path.join(testVaultDir, ".obsidian");
  const pluginDir = path.join(obsidianDir, "plugins", "flow");
  const settingsFile = path.join(pluginDir, "data.json");

  beforeEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
  });

  describe("readPluginSettings", () => {
    it("should read plugin settings successfully", () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(
        settingsFile,
        JSON.stringify({ cliInboxFile: "inbox.md" })
      );

      const settings = readPluginSettings(testVaultDir);
      expect(settings.cliInboxFile).toBe("inbox.md");
    });

    it("should throw error if vault does not exist", () => {
      expect(() => readPluginSettings("/nonexistent/vault")).toThrow(
        "Vault not found"
      );
    });

    it("should throw error if .obsidian folder missing", () => {
      fs.mkdirSync(testVaultDir, { recursive: true });

      expect(() => readPluginSettings(testVaultDir)).toThrow(
        "Not a valid Obsidian vault"
      );
    });

    it("should throw error if Flow plugin not installed", () => {
      fs.mkdirSync(obsidianDir, { recursive: true });

      expect(() => readPluginSettings(testVaultDir)).toThrow(
        "Flow plugin not installed"
      );
    });

    it("should throw error if settings file unreadable", () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, "invalid json");

      expect(() => readPluginSettings(testVaultDir)).toThrow(
        "Could not read Flow plugin settings"
      );
    });

    it("should throw error if cliInboxFile not configured", () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify({ otherSetting: "value" }));

      expect(() => readPluginSettings(testVaultDir)).toThrow(
        "cliInboxFile not configured"
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/plugin-settings'

**Step 3: Write minimal implementation**

```typescript
// src/plugin-settings.ts
// ABOUTME: Reads Flow plugin settings from Obsidian vault
// ABOUTME: Validates vault structure and extracts cliInboxFile setting

import * as fs from "fs";
import * as path from "path";
import { PluginSettings } from "./types";

export function readPluginSettings(vaultPath: string): PluginSettings {
  // Expand ~ to home directory
  const expandedPath = vaultPath.replace(/^~/, process.env.HOME || "");

  if (!fs.existsSync(expandedPath)) {
    throw new Error(`Vault not found at ${expandedPath}`);
  }

  const obsidianDir = path.join(expandedPath, ".obsidian");
  if (!fs.existsSync(obsidianDir)) {
    throw new Error(
      `Not a valid Obsidian vault (missing .obsidian folder): ${expandedPath}`
    );
  }

  const pluginDir = path.join(obsidianDir, "plugins", "flow");
  if (!fs.existsSync(pluginDir)) {
    throw new Error(`Flow plugin not installed at ${pluginDir}`);
  }

  const settingsFile = path.join(pluginDir, "data.json");
  try {
    const content = fs.readFileSync(settingsFile, "utf-8");
    const settings = JSON.parse(content) as PluginSettings;

    if (!settings.cliInboxFile) {
      throw new Error(
        "cliInboxFile not configured in Flow plugin settings\n" +
        "Please open Obsidian and configure: Settings → Flow GTD Coach → CLI Inbox File"
      );
    }

    return settings;
  } catch (error) {
    if (error instanceof Error && error.message.includes("cliInboxFile")) {
      throw error;
    }
    throw new Error("Could not read Flow plugin settings");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugin-settings.ts tests/plugin-settings.test.ts
git commit -m "feat: add plugin settings reader"
```

---

## Phase 5: Capture Module

### Task 8: Implement Capture Function

**Files:**
- Create: `flow-cli/src/capture.ts`
- Create: `flow-cli/tests/capture.test.ts`

**Step 1: Write failing test**

```typescript
// tests/capture.test.ts
// ABOUTME: Tests for inbox file capture functionality
// ABOUTME: Covers appending text, creating files, and error handling

import * as fs from "fs";
import * as path from "path";
import { capture } from "../src/capture";

describe("Capture", () => {
  const testVaultDir = path.join(__dirname, ".test-vault");
  const inboxFile = "inbox.md";
  const inboxPath = path.join(testVaultDir, inboxFile);

  beforeEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
    fs.mkdirSync(testVaultDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
  });

  describe("capture", () => {
    it("should append text to existing file", () => {
      fs.writeFileSync(inboxPath, "existing line\n");

      capture(testVaultDir, inboxFile, "new line");

      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("existing line\nnew line\n");
    });

    it("should create new file if missing", () => {
      expect(fs.existsSync(inboxPath)).toBe(false);

      capture(testVaultDir, inboxFile, "first line");

      expect(fs.existsSync(inboxPath)).toBe(true);
      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("first line\n");
    });

    it("should create parent directories if needed", () => {
      const nestedFile = "folder/subfolder/inbox.md";
      const nestedPath = path.join(testVaultDir, nestedFile);

      capture(testVaultDir, nestedFile, "nested line");

      expect(fs.existsSync(nestedPath)).toBe(true);
      const content = fs.readFileSync(nestedPath, "utf-8");
      expect(content).toBe("nested line\n");
    });

    it("should resolve paths relative to vault", () => {
      capture(testVaultDir, inboxFile, "relative line");

      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("relative line\n");
    });

    it("should throw error if vault path invalid", () => {
      expect(() => capture("/nonexistent/vault", inboxFile, "text")).toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/capture'

**Step 3: Write minimal implementation**

```typescript
// src/capture.ts
// ABOUTME: Appends captured text to inbox file
// ABOUTME: Creates file and parent directories if needed

import * as fs from "fs";
import * as path from "path";

export function capture(vaultPath: string, inboxFile: string, text: string): void {
  // Expand ~ to home directory
  const expandedVaultPath = vaultPath.replace(/^~/, process.env.HOME || "");
  const inboxPath = path.join(expandedVaultPath, inboxFile);
  const dir = path.dirname(inboxPath);

  // Create parent directories if needed
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append text with newline
  fs.appendFileSync(inboxPath, `${text}\n`);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/capture.ts tests/capture.test.ts
git commit -m "feat: add capture function"
```

---

## Phase 6: CLI Entry Point

### Task 9: Implement Argument Parsing

**Files:**
- Create: `flow-cli/src/index.ts`
- Create: `flow-cli/tests/index.test.ts`

**Step 1: Write failing test**

```typescript
// tests/index.test.ts
// ABOUTME: Integration tests for CLI entry point
// ABOUTME: Tests argument parsing, orchestration, and error messages

import * as fs from "fs";
import * as path from "path";

// Mock console methods
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();
const mockProcessExit = jest.spyOn(process, "exit").mockImplementation();

// Import after mocking
import { parseArgs, main } from "../src/index";

describe("CLI Entry Point", () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe("parseArgs", () => {
    it("should parse text argument", () => {
      const args = parseArgs(["buy milk"]);
      expect(args.text).toBe("buy milk");
      expect(args.vault).toBeUndefined();
      expect(args.config).toBe(false);
    });

    it("should parse --vault flag", () => {
      const args = parseArgs(["--vault", "/path/to/vault", "buy milk"]);
      expect(args.text).toBe("buy milk");
      expect(args.vault).toBe("/path/to/vault");
    });

    it("should parse --config flag", () => {
      const args = parseArgs(["--config"]);
      expect(args.config).toBe(true);
      expect(args.text).toBeUndefined();
    });

    it("should throw error if no text provided", () => {
      expect(() => parseArgs([])).toThrow("Please provide text to capture");
    });

    it("should allow --config without text", () => {
      const args = parseArgs(["--config"]);
      expect(args.config).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/index'

**Step 3: Write minimal implementation**

```typescript
// src/index.ts
// ABOUTME: CLI entry point for Flow quick capture
// ABOUTME: Orchestrates config reading, plugin settings, and file capture

import { readConfig, writeConfig, getConfigPath } from "./config";
import { readPluginSettings } from "./plugin-settings";
import { capture } from "./capture";

interface ParsedArgs {
  text?: string;
  vault?: string;
  config: boolean;
}

export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    config: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vault" && i + 1 < args.length) {
      result.vault = args[i + 1];
      i++; // Skip next arg
    } else if (args[i] === "--config") {
      result.config = true;
    } else if (!result.text) {
      result.text = args[i];
    }
  }

  if (!result.text && !result.config) {
    throw new Error("Please provide text to capture");
  }

  return result;
}

export async function main(): Promise<void> {
  // Implementation in next task
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: add argument parsing"
```

---

### Task 10: Implement Main Orchestration

**Files:**
- Modify: `flow-cli/src/index.ts`
- Modify: `flow-cli/src/config.ts`
- Modify: `flow-cli/tests/index.test.ts`

**Step 1: Add promptForVaultPath to config.ts**

```typescript
// src/config.ts - add to existing file

import * as readline from "readline";

export async function promptForVaultPath(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter vault path: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
```

**Step 2: Write failing integration test**

```typescript
// tests/index.test.ts - add to existing describe block

  describe("main", () => {
    const testConfigDir = path.join(__dirname, ".test-config");
    const testConfigPath = path.join(testConfigDir, "config.json");
    const testVaultDir = path.join(__dirname, ".test-vault");
    const obsidianDir = path.join(testVaultDir, ".obsidian");
    const pluginDir = path.join(obsidianDir, "plugins", "flow");
    const settingsFile = path.join(pluginDir, "data.json");
    const inboxFile = path.join(testVaultDir, "inbox.md");

    beforeEach(() => {
      // Clean up
      if (fs.existsSync(testConfigDir)) {
        fs.rmSync(testConfigDir, { recursive: true });
      }
      if (fs.existsSync(testVaultDir)) {
        fs.rmSync(testVaultDir, { recursive: true });
      }

      // Set up vault
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(
        settingsFile,
        JSON.stringify({ cliInboxFile: "inbox.md" })
      );
    });

    afterEach(() => {
      if (fs.existsSync(testConfigDir)) {
        fs.rmSync(testConfigDir, { recursive: true });
      }
      if (fs.existsSync(testVaultDir)) {
        fs.rmSync(testVaultDir, { recursive: true });
      }
    });

    it("should capture text with existing config", async () => {
      // Set up config
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(
        testConfigPath,
        JSON.stringify({ defaultVault: testVaultDir })
      );

      // Mock process.argv
      process.argv = ["node", "flow", "buy milk"];

      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith('Captured: "buy milk"');
      const content = fs.readFileSync(inboxFile, "utf-8");
      expect(content).toBe("buy milk\n");
    });

    it("should handle --vault override", async () => {
      process.argv = ["node", "flow", "--vault", testVaultDir, "buy milk"];

      await main();

      expect(mockConsoleLog).toHaveBeenCalledWith('Captured: "buy milk"');
      const content = fs.readFileSync(inboxFile, "utf-8");
      expect(content).toBe("buy milk\n");
    });

    it("should exit with error if no vault configured", async () => {
      process.argv = ["node", "flow", "buy milk"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("No default vault configured")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
```

**Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - main() not implemented

**Step 4: Write implementation**

```typescript
// src/index.ts - replace main function

export async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));

    // Handle --config flag
    if (args.config) {
      const vaultPath = await promptForVaultPath();
      writeConfig({ defaultVault: vaultPath });
      console.log(`Saved default vault to ${getConfigPath()}`);
      if (!args.text) {
        return;
      }
    }

    // Determine vault path
    let vaultPath = args.vault;
    if (!vaultPath) {
      const config = readConfig();
      if (!config) {
        console.error("No default vault configured.");
        const newVaultPath = await promptForVaultPath();
        console.error(`Saving default vault to ${getConfigPath()}`);
        writeConfig({ defaultVault: newVaultPath });
        vaultPath = newVaultPath;
      } else {
        vaultPath = config.defaultVault;
      }
    }

    // Read plugin settings
    const settings = readPluginSettings(vaultPath);

    // Capture text
    if (args.text) {
      capture(vaultPath, settings.cliInboxFile, args.text);
      console.log(`Captured: "${args.text}"`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`

Expected: PASS (may need to adjust mocks for readline)

**Step 6: Commit**

```bash
git add src/index.ts src/config.ts tests/index.test.ts
git commit -m "feat: implement main CLI orchestration"
```

---

### Task 11: Add Error Message Tests

**Files:**
- Modify: `flow-cli/tests/index.test.ts`

**Step 1: Write error message tests**

```typescript
// tests/index.test.ts - add to main describe block

    it("should show usage if no text provided", async () => {
      process.argv = ["node", "flow"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Please provide text to capture")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle vault not found error", async () => {
      process.argv = ["node", "flow", "--vault", "/nonexistent", "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Vault not found")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle invalid vault error", async () => {
      fs.mkdirSync(testVaultDir, { recursive: true });
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Not a valid Obsidian vault")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle plugin not installed error", async () => {
      fs.mkdirSync(obsidianDir, { recursive: true });
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Flow plugin not installed")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle missing cliInboxFile setting", async () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify({}));
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("cliInboxFile not configured")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
```

**Step 2: Run tests**

Run: `npm test`

Expected: PASS (all error messages handled correctly)

**Step 3: Commit**

```bash
git add tests/index.test.ts
git commit -m "test: add comprehensive error message tests"
```

---

## Phase 7: Build and Test

### Task 12: Build CLI and Test Manually

**Files:**
- None (manual testing)

**Step 1: Build the CLI**

Run: `npm run build`

Expected: `dist/index.js` created with shebang

**Step 2: Make executable**

Run: `chmod +x dist/index.js`

Expected: File is now executable

**Step 3: Test help message**

Run: `./dist/index.js`

Expected: Error message about no text provided

**Step 4: Test with invalid vault**

Run: `./dist/index.js --vault /nonexistent "test"`

Expected: "Vault not found" error

**Step 5: Create test vault and plugin settings**

```bash
mkdir -p /tmp/test-vault/.obsidian/plugins/flow
echo '{"cliInboxFile": "inbox.md"}' > /tmp/test-vault/.obsidian/plugins/flow/data.json
```

**Step 6: Test capture**

Run: `./dist/index.js --vault /tmp/test-vault "buy milk"`

Expected:
- Output: `Captured: "buy milk"`
- File `/tmp/test-vault/inbox.md` contains `buy milk\n`

**Step 7: Test appending**

Run: `./dist/index.js --vault /tmp/test-vault "call dentist"`

Expected:
- Output: `Captured: "call dentist"`
- File `/tmp/test-vault/inbox.md` contains both lines

**Step 8: Verify and commit**

```bash
cat /tmp/test-vault/inbox.md
rm -rf /tmp/test-vault
```

```bash
git add dist/
git commit -m "build: compile CLI for manual testing"
```

---

## Phase 8: Flow Plugin Integration

### Task 13: Add cliInboxFile Setting to Plugin

**Files:**
- Modify: `src/settings-tab.ts`
- Modify: `src/types.ts`

**Step 1: Write failing test**

```typescript
// tests/settings-tab.test.ts - add to existing tests

  it("should display CLI inbox file setting", () => {
    settingsTab.display();

    const container = containerEl.querySelector(".setting-item");
    expect(container?.textContent).toContain("CLI Inbox File");
  });
```

**Step 2: Run test**

Run: `npm test`

Expected: FAIL - CLI Inbox File setting not found

**Step 3: Add to FlowSettings interface**

```typescript
// src/types.ts - add to FlowSettings interface

export interface FlowSettings {
  // ... existing settings
  cliInboxFile: string;
}
```

**Step 4: Add default value**

```typescript
// src/types.ts - add to DEFAULT_SETTINGS

export const DEFAULT_SETTINGS: FlowSettings = {
  // ... existing defaults
  cliInboxFile: "Flow CLI Inbox.md",
};
```

**Step 5: Add setting to settings tab**

```typescript
// src/settings-tab.ts - add to display() method

new Setting(containerEl)
  .setName("CLI Inbox File")
  .setDesc("Path to file for CLI quick captures (relative to vault root)")
  .addText((text) =>
    text
      .setPlaceholder("Flow CLI Inbox.md")
      .setValue(this.plugin.settings.cliInboxFile)
      .onChange(async (value) => {
        this.plugin.settings.cliInboxFile = value;
        await this.plugin.saveSettings();
      })
  );
```

**Step 6: Run tests**

Run: `npm test`

Expected: PASS

**Step 7: Commit**

```bash
git add src/settings-tab.ts src/types.ts tests/settings-tab.test.ts
git commit -m "feat: add CLI inbox file setting to plugin"
```

---

## Phase 9: Documentation

### Task 14: Update Documentation

**Files:**
- Create: `flow-cli/PUBLISHING.md`
- Modify: `README.md` (main plugin README)

**Step 1: Write CLI publishing guide**

```markdown
# Publishing Flow CLI

## Preparation

1. Update version in `flow-cli/package.json`
2. Run tests: `npm test`
3. Run build: `npm run build`
4. Verify manual test works

## Publishing to npm

```bash
cd flow-cli
npm publish --access public
```

## Installation

Users install globally:

```bash
npm install -g @flow/cli
```

## Verification

```bash
flow --version
flow --help
```
```

**Step 2: Update main README**

Add CLI section to main plugin README:

```markdown
## Flow CLI

Quick capture from the terminal:

```bash
# Install
npm install -g @flow/cli

# First run - configure vault
flow "buy milk"
# Enter vault path: ~/Obsidian/MyVault
# Captured: "buy milk"

# Subsequent captures
flow "call dentist"
# Captured: "call dentist"

# Override vault
flow --vault ~/Obsidian/Work "meeting notes"
```

### Configuration

1. Install Flow plugin in Obsidian
2. Configure CLI Inbox File in Settings → Flow GTD Coach
3. Install CLI globally: `npm install -g @flow/cli`
4. Run `flow "text"` - first run will prompt for vault path

See [flow-cli/README.md](flow-cli/README.md) for details.
```

**Step 3: Commit**

```bash
git add flow-cli/PUBLISHING.md README.md
git commit -m "docs: add CLI documentation and publishing guide"
```

---

## Verification

### Final Checks

**Run all tests:**
```bash
cd flow-cli
npm test
npm run test:coverage
```

Expected: 80%+ coverage, all tests passing

**Build and format:**
```bash
npm run build
npm run format
```

Expected: Clean build, code formatted

**Manual test:**
```bash
mkdir -p /tmp/test-vault/.obsidian/plugins/flow
echo '{"cliInboxFile": "inbox.md"}' > /tmp/test-vault/.obsidian/plugins/flow/data.json
./dist/index.js --vault /tmp/test-vault "test capture"
cat /tmp/test-vault/inbox.md
```

Expected: File contains "test capture"

**Clean up:**
```bash
rm -rf /tmp/test-vault
```

---

## Notes

- Use TDD throughout: write test, watch fail, implement, watch pass, commit
- Keep commits small and focused (one feature per commit)
- Run tests after each implementation step
- Use @superpowers:test-driven-development skill for TDD guidance
- Use @superpowers:verification-before-completion before claiming done
- Keep to YAGNI - no features beyond design scope
