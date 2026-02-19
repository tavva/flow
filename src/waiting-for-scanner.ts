// ABOUTME: Scans vault for waiting-for items (tasks marked with [w] checkbox status).
// ABOUTME: Returns array of waiting-for items with file location and line numbers for editing.

import { App, TFile } from "obsidian";
import { getAPI } from "obsidian-dataview";
import { extractContexts } from "./context-tags";
import { PluginSettings } from "./types";

export interface WaitingForItem {
  file: string;
  fileName: string;
  lineNumber: number;
  lineContent: string; // Full line content for validation
  text: string;
  sphere?: string; // Sphere extracted from inline tag or project tag
  contexts: string[]; // GTD context tags (#context/X) from the action line
}

export class WaitingForScanner {
  private app: App;
  private settings: PluginSettings;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  private extractSphere(lineContent: string, filePath: string): string | undefined {
    // First check for inline #sphere/X tag
    const sphereTagMatch = lineContent.match(/#sphere\/([^\s]+)/i);
    if (sphereTagMatch) {
      return sphereTagMatch[1];
    }

    // Fall back to checking project tags from frontmatter
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.tags) {
        const tags = Array.isArray(cache.frontmatter.tags)
          ? cache.frontmatter.tags
          : [cache.frontmatter.tags];

        for (const tag of tags) {
          const match = tag.match(/^project\/(.+)$/);
          if (match) {
            return match[1];
          }
        }
      }
    }

    return undefined;
  }

  async scanWaitingForItems(): Promise<WaitingForItem[]> {
    // Try to use Dataview if available (much faster)
    try {
      const dv = getAPI(this.app);
      if (dv) {
        return await this.scanWithDataview(dv);
      }
    } catch (error) {
      // Dataview not available or not properly initialized, fall back to manual scanning
    }

    // Fall back to manual scanning
    return this.scanManually();
  }

  private async scanWithDataview(dv: any): Promise<WaitingForItem[]> {
    const items: WaitingForItem[] = [];

    // Query all tasks with status 'w' (case insensitive)
    const tasks = dv.pages().file.tasks.where((t: any) => {
      return t.status.toLowerCase() === "w";
    });

    // Read all files once to avoid re-reading for each task
    const fileContents = new Map<string, string[]>();

    for (const task of tasks) {
      // Get or cache file content
      if (!fileContents.has(task.path)) {
        const file = this.app.vault.getAbstractFileByPath(task.path);
        if (file instanceof TFile) {
          const content = await this.app.vault.read(file);
          fileContents.set(task.path, content.split(/\r?\n/));
        }
      }

      const lines = fileContents.get(task.path);
      let lineContent = "";
      let actualLineNumber = task.line;

      if (lines) {
        // Dataview's task.line is 0-indexed (position in array)
        const lineIndex = task.line;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lineContent = lines[lineIndex];
          actualLineNumber = lineIndex + 1; // Convert to 1-indexed for storage
        }
      }

      items.push({
        file: task.path,
        fileName: task.link.path.split("/").pop()?.replace(".md", "") || task.path,
        lineNumber: actualLineNumber,
        lineContent,
        text: task.text,
        sphere: this.extractSphere(lineContent, task.path),
        contexts: extractContexts(lineContent, this.settings.contextTagPrefix),
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
          lineContent: line,
          text,
          sphere: this.extractSphere(line, file.path),
          contexts: extractContexts(line, this.settings.contextTagPrefix),
        });
      }
    });

    return items;
  }
}
