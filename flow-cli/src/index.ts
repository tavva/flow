// ABOUTME: CLI entry point for Flow quick capture
// ABOUTME: Orchestrates config reading, plugin settings, and file capture

import { readConfig, writeConfig, getConfigPath, promptForVaultPath } from "./config";
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
