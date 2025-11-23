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
      fs.writeFileSync(settingsFile, JSON.stringify({ cliInboxFile: "inbox.md" }));

      const settings = readPluginSettings(testVaultDir);
      expect(settings.cliInboxFile).toBe("Flow Inbox Files/inbox.md");
    });

    it("should throw error if vault does not exist", () => {
      expect(() => readPluginSettings("/nonexistent/vault")).toThrow("Vault not found");
    });

    it("should throw error if .obsidian folder missing", () => {
      fs.mkdirSync(testVaultDir, { recursive: true });

      expect(() => readPluginSettings(testVaultDir)).toThrow("Not a valid Obsidian vault");
    });

    it("should throw error if Flow plugin not installed", () => {
      fs.mkdirSync(obsidianDir, { recursive: true });

      expect(() => readPluginSettings(testVaultDir)).toThrow("Flow plugin not installed");
    });

    it("should throw error if settings file unreadable", () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, "invalid json");

      expect(() => readPluginSettings(testVaultDir)).toThrow("Could not read Flow plugin settings");
    });

    it("should throw error if cliInboxFile not configured", () => {
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify({ otherSetting: "value" }));

      expect(() => readPluginSettings(testVaultDir)).toThrow("cliInboxFile not configured");
    });

    it("should expand ~ to home directory", () => {
      const homeDir = process.env.HOME || "";
      const testVaultName = ".test-vault-tilde";
      const vaultPath = path.join(homeDir, testVaultName);

      // Create vault structure
      const pluginDir = path.join(vaultPath, ".obsidian", "plugins", "flow");
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginDir, "data.json"),
        JSON.stringify({ cliInboxFile: "inbox.md" })
      );

      try {
        // Test with ~ prefix
        const settings = readPluginSettings(`~/${testVaultName}`);
        expect(settings.cliInboxFile).toBe("Flow Inbox Files/inbox.md");
      } finally {
        // Cleanup
        fs.rmSync(vaultPath, { recursive: true });
      }
    });
  });
});
