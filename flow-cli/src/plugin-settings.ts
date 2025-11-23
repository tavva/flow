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
    throw new Error(`Not a valid Obsidian vault (missing .obsidian folder): ${expandedPath}`);
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
          "Please open Obsidian and configure: Settings → Flow → CLI Inbox File"
      );
    }

    // Prepend inbox files folder to create full path
    const inboxFilesFolder = settings.inboxFilesFolderPath || "Flow Inbox Files";
    settings.cliInboxFile = `${inboxFilesFolder}/${settings.cliInboxFile}`;

    return settings;
  } catch (error) {
    if (error instanceof Error && error.message.includes("cliInboxFile")) {
      throw error;
    }
    throw new Error("Could not read Flow plugin settings");
  }
}
