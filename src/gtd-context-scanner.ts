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

  async scanSomedayItems(): Promise<string[]> {
    try {
      const content = await this.readFile(this.settings.somedayFilePath);
      return this.extractListItems(content);
    } catch (error) {
      return [];
    }
  }

  async scanInboxItems(): Promise<string[]> {
    try {
      const files = this.app.vault.getMarkdownFiles();
      const inboxFiles: string[] = [];

      for (const file of files) {
        if (this.isInInboxFolder(file.path)) {
          const folderName = this.getInboxFolderName(file.path);
          inboxFiles.push(`${file.basename} (${folderName})`);
        }
      }

      return inboxFiles;
    } catch (error) {
      return [];
    }
  }

  async scanContext(): Promise<GTDContext> {
    const [nextActions, somedayItems, inboxItems] = await Promise.all([
      this.scanNextActions(),
      this.scanSomedayItems(),
      this.scanInboxItems(),
    ]);

    return {
      nextActions,
      somedayItems,
      inboxItems,
    };
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

  private extractListItems(content: string): string[] {
    const lines = content.split("\n");
    const items: string[] = [];

    for (const line of lines) {
      // Match regular list items: "- item"
      const regularMatch = line.match(/^- ([^\[].+)$/);
      if (regularMatch) {
        items.push(regularMatch[1].trim());
        continue;
      }

      // Match unchecked checkbox items: "- [ ] item"
      const checkboxMatch = line.match(/^- \[ \] (.+)$/);
      if (checkboxMatch) {
        items.push(checkboxMatch[1].trim());
      }
    }

    return items;
  }

  private isInInboxFolder(path: string): boolean {
    return (
      path.startsWith(this.settings.inboxFolderPath + "/") ||
      path.startsWith(this.settings.inboxFilesFolderPath + "/")
    );
  }

  private getInboxFolderName(path: string): string {
    if (path.startsWith(this.settings.inboxFolderPath + "/")) {
      return this.settings.inboxFolderPath;
    }
    return this.settings.inboxFilesFolderPath;
  }
}
