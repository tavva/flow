// ABOUTME: Scans the inbox folders for line and note items awaiting processing.
// ABOUTME: Removes processed items: deletes matching lines and archives notes.
import { App, TFile, TFolder } from "obsidian";
import { PluginSettings } from "./types";

export interface InboxItem {
  type: "line" | "note";
  content: string;
  sourceFile: TFile;
  lineNumber?: number; // Only for type 'line'
}

// Finds the line whose trimmed text is the item's content. The file may have changed since it
// was scanned, so the recorded index is only a hint for choosing between duplicate lines.
function findLineIndex(
  lines: string[],
  content: string,
  recordedIndex: number
): number | undefined {
  let nearest: number | undefined;
  lines.forEach((line, index) => {
    if (line.trim() !== content) return;
    if (
      nearest === undefined ||
      Math.abs(index - recordedIndex) < Math.abs(nearest - recordedIndex)
    ) {
      nearest = index;
    }
  });
  return nearest;
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
    const folder = this.app.vault.getAbstractFileByPath(this.settings.inboxFilesFolderPath);

    if (!(folder instanceof TFolder)) {
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
    const folder = this.app.vault.getAbstractFileByPath(this.settings.inboxFolderPath);

    if (!(folder instanceof TFolder)) {
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

  async deleteInboxItem(item: InboxItem): Promise<string | undefined> {
    if (item.type === "line" && item.lineNumber !== undefined) {
      const content = await this.app.vault.read(item.sourceFile);
      const lines = content.split("\n");
      const lineIndex = findLineIndex(lines, item.content, item.lineNumber - 1);

      if (lineIndex === undefined) {
        throw new Error(
          `Could not find "${item.content}" in ${item.sourceFile.path}. It may have been changed or removed elsewhere, so nothing was deleted. Reopen the inbox to rescan it.`
        );
      }

      lines.splice(lineIndex, 1);
      await this.app.vault.modify(item.sourceFile, lines.join("\n"));
      return undefined;
    } else if (item.type === "note") {
      // Archive the note instead of deleting it
      const processedFolder = this.settings.processedInboxFolderPath;

      // Ensure the processed folder exists
      const folder = this.app.vault.getAbstractFileByPath(processedFolder);
      if (!folder) {
        await this.app.vault.createFolder(processedFolder);
      }

      // Move the file to the processed folder
      const newPath = `${processedFolder}/${item.sourceFile.name}`;
      await this.app.fileManager.renameFile(item.sourceFile, newPath);

      // Return wikilink to archived note (without .md extension)
      const baseName = item.sourceFile.basename;
      return `[[${baseName}|source]]`;
    }
    return undefined;
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
