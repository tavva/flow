// ABOUTME: Scans vault for waiting-for items (tasks marked with [w] checkbox status).
// ABOUTME: Returns array of waiting-for items with file location and line numbers for editing.

import { App, TFile } from "obsidian";
import { getAPI } from "obsidian-dataview";

export interface WaitingForItem {
  file: string;
  fileName: string;
  lineNumber: number;
  text: string;
}

export class WaitingForScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async scanWaitingForItems(): Promise<WaitingForItem[]> {
    // Try to use Dataview if available (much faster)
    try {
      const dv = getAPI(this.app);
      if (dv) {
        return this.scanWithDataview(dv);
      }
    } catch (error) {
      // Dataview not available or not properly initialized, fall back to manual scanning
    }

    // Fall back to manual scanning
    return this.scanManually();
  }

  private scanWithDataview(dv: any): WaitingForItem[] {
    const items: WaitingForItem[] = [];

    // Query all tasks with status 'w' (case insensitive)
    const tasks = dv.pages().file.tasks.where((t: any) => {
      return t.status.toLowerCase() === "w";
    });

    for (const task of tasks) {
      items.push({
        file: task.path,
        fileName: task.link.path.split("/").pop()?.replace(".md", "") || task.path,
        lineNumber: task.line,
        text: task.text,
      });
    }

    return items;
  }

  private async scanManually(): Promise<WaitingForItem[]> {
    const files = this.app.vault.getMarkdownFiles();
    const items: WaitingForItem[] = [];

    for (const file of files) {
      // Use metadata cache to skip files without list items (if available)
      if (this.app.metadataCache) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache && (!cache.listItems || cache.listItems.length === 0)) {
          continue;
        }
      }

      const fileItems = await this.scanFile(file);
      items.push(...fileItems);
    }

    return items;
  }

  private async scanFile(file: TFile): Promise<WaitingForItem[]> {
    const items: WaitingForItem[] = [];
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    const waitingForPattern = /^[-*]\s*\[w\]\s*(.+)$/i;

    lines.forEach((line, index) => {
      const match = line.match(waitingForPattern);
      if (match) {
        const text = match[1].replace(/\s{2,}/g, " ").trim();
        items.push({
          file: file.path,
          fileName: file.basename,
          lineNumber: index + 1,
          text,
        });
      }
    });

    return items;
  }
}
