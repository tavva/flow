import { App, TFile, TFolder } from "obsidian";
import { PluginSettings } from "./types";

export interface InboxItem {
  type: "line" | "note";
  content: string;
  sourceFile: TFile;
  lineNumber?: number; // Only for type 'line'
}

export class InboxScanner {
  private app: App;
  private settings: PluginSettings;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  async getAllInboxItems(): Promise<InboxItem[]> {
    const items: InboxItem[] = [];

    // Get line-by-line items first
    const lineItems = await this.getLineItems();
    items.push(...lineItems);

    // Then get note-by-note items
    const noteItems = await this.getNoteItems();
    items.push(...noteItems);

    return items;
  }

  private async getLineItems(): Promise<InboxItem[]> {
    const items: InboxItem[] = [];
    const folder = this.app.vault.getAbstractFileByPath(
      this.settings.inboxFilesFolderPath
    ) as TFolder;

    if (!folder) {
      return items;
    }

    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(folder.path));

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine !== "") {
          items.push({
            type: "line",
            content: trimmedLine,
            sourceFile: file,
            lineNumber: index + 1,
          });
        }
      });
    }

    return items;
  }

  private async getNoteItems(): Promise<InboxItem[]> {
    const items: InboxItem[] = [];
    const folder = this.app.vault.getAbstractFileByPath(this.settings.inboxFolderPath) as TFolder;

    if (!folder) {
      return items;
    }

    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(folder.path));

    for (const file of files) {
      const content = await this.app.vault.read(file);
      items.push({
        type: "note",
        content: content,
        sourceFile: file,
      });
    }

    return items;
  }

  async deleteInboxItem(item: InboxItem): Promise<void> {
    if (item.type === "line" && item.lineNumber !== undefined) {
      const content = await this.app.vault.read(item.sourceFile);
      const lines = content.split("\n");

      // lineNumber is 1-based line number in the file, convert to 0-based index
      const lineIndex = item.lineNumber - 1;

      // Check bounds and delete the line
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        await this.app.vault.modify(item.sourceFile, lines.join("\n"));
      }
    } else if (item.type === "note") {
      // Delete the entire file
      await this.app.vault.delete(item.sourceFile);
    }
  }

  async getInboxCount(): Promise<{ lineCount: number; noteCount: number }> {
    const lineItems = await this.getLineItems();
    const noteItems = await this.getNoteItems();

    return {
      lineCount: lineItems.length,
      noteCount: noteItems.length,
    };
  }
}
