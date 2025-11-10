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
      fs.writeFileSync(testConfigPath, JSON.stringify({ defaultVault: "/test/vault" }));

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
      fs.writeFileSync(testConfigPath, JSON.stringify({ defaultVault: "/old/vault" }));

      const config = { defaultVault: "/new/vault" };
      writeConfig(config, testConfigPath);

      const written = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
      expect(written.defaultVault).toBe("/new/vault");
    });
  });
});
