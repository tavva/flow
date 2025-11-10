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
