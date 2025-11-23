// ABOUTME: Integration tests for CLI entry point
// ABOUTME: Tests argument parsing, orchestration, and error messages

import * as fs from "fs";
import * as path from "path";
import * as config from "../src/config";

// Test paths
const testConfigDir = path.join(__dirname, ".test-config");
const testConfigPath = path.join(testConfigDir, "config.json");
const testVaultDir = path.join(__dirname, ".test-vault");

// Mock console methods
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();
const mockProcessExit = jest.spyOn(process, "exit").mockImplementation();

// Mock specific config functions
const mockGetConfigPath = jest.spyOn(config, "getConfigPath");
const mockPromptForVaultPath = jest.spyOn(config, "promptForVaultPath");

// Set up mocks with default implementations
mockGetConfigPath.mockReturnValue(testConfigPath);
mockPromptForVaultPath.mockResolvedValue(testVaultDir);

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

  describe("main", () => {
    const obsidianDir = path.join(testVaultDir, ".obsidian");
    const pluginDir = path.join(obsidianDir, "plugins", "flow");
    const settingsFile = path.join(pluginDir, "data.json");
    const inboxFile = path.join(testVaultDir, "Flow Inbox Files", "inbox.md");

    beforeEach(() => {
      // Clear mock call history
      jest.clearAllMocks();

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
        JSON.stringify({
          settings: { cliInboxFile: "inbox.md", inboxFilesFolderPath: "Flow Inbox Files" },
        })
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
      // Mock process.argv with explicit vault path to avoid using real config
      process.argv = ["node", "flow", "--vault", testVaultDir, "buy milk"];

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

    it("should show error if vault not found", async () => {
      process.argv = ["node", "flow", "--vault", "/nonexistent", "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Vault not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should show usage if no text provided", async () => {
      process.argv = ["node", "flow"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Please provide text to capture")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle invalid vault error", async () => {
      // Clean up the valid vault that beforeEach created
      if (fs.existsSync(testVaultDir)) {
        fs.rmSync(testVaultDir, { recursive: true });
      }
      // Create vault dir but not .obsidian dir
      fs.mkdirSync(testVaultDir, { recursive: true });
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error: Not a valid Obsidian vault (missing .obsidian folder): " + testVaultDir
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle plugin not installed error", async () => {
      // Clean up the valid vault that beforeEach created
      if (fs.existsSync(testVaultDir)) {
        fs.rmSync(testVaultDir, { recursive: true });
      }
      // Create .obsidian dir but not plugin dir
      fs.mkdirSync(obsidianDir, { recursive: true });
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error: Flow plugin not installed at " + pluginDir
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle missing cliInboxFile setting", async () => {
      // Clean up and recreate vault with empty settings
      if (fs.existsSync(testVaultDir)) {
        fs.rmSync(testVaultDir, { recursive: true });
      }
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify({ settings: {} }));
      process.argv = ["node", "flow", "--vault", testVaultDir, "test"];

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("cliInboxFile not configured")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
