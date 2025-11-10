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
