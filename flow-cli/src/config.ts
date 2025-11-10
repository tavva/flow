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

export function writeConfig(config: Config, configPath?: string): void {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
