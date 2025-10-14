// ABOUTME: Scans vault for waiting-for items (tasks marked with [w] checkbox status).
// ABOUTME: Returns array of waiting-for items with file location and line numbers for editing.

import { App, TFile } from "obsidian";

export interface WaitingForItem {
  file: string;
  fileName: string;
  lineNumber: number;
  text: string;
  isCompleted: boolean;
}

export class WaitingForScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async scanWaitingForItems(): Promise<WaitingForItem[]> {
    const files = this.app.vault.getMarkdownFiles();
    const items: WaitingForItem[] = [];

    for (const file of files) {
      const fileItems = await this.scanFile(file);
      items.push(...fileItems);
    }

    return items;
  }

  private async scanFile(file: TFile): Promise<WaitingForItem[]> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const items: WaitingForItem[] = [];

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
          isCompleted: false,
        });
      }
    });

    return items;
  }
}
