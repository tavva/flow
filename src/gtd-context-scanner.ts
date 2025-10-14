// ABOUTME: Scans vault for GTD context files (next actions, someday, inbox).
// ABOUTME: Provides comprehensive GTD system state to the CLI coach.

import { App, TFile } from "obsidian";
import { PluginSettings } from "./types";

export interface GTDContext {
  nextActions: string[];
  somedayItems: string[];
  inboxItems: string[];
}

export class GTDContextScanner {
  constructor(
    private app: App,
    private settings: PluginSettings
  ) {}

  async scanNextActions(): Promise<string[]> {
    try {
      const content = await this.readFile(this.settings.nextActionsFilePath);
      return this.extractCheckboxItems(content);
    } catch (error) {
      return [];
    }
  }

  private async readFile(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return await this.app.vault.read(file as TFile);
  }

  private extractCheckboxItems(content: string): string[] {
    const lines = content.split("\n");
    const items: string[] = [];

    for (const line of lines) {
      const match = line.match(/^- \[ \] (.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }

    return items;
  }
}
