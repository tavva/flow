// ABOUTME: Core type definitions for Flow CLI
// ABOUTME: Config and PluginSettings interfaces

export interface Config {
  defaultVault: string;
}

export interface PluginSettings {
  cliInboxFile: string;
  [key: string]: unknown;
}
