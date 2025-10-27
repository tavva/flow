// ABOUTME: Validates and resolves focus items when files or line numbers change.
// ABOUTME: Uses exact match first, then searches file for matching content.

import { App, TFile } from "obsidian";
import { FocusItem } from "./types";

export interface ValidationResult {
  found: boolean;
  updatedLineNumber?: number;
  currentContent?: string;
  error?: string;
}

export class FocusValidator {
  constructor(private app: App) {}

  async validateItem(item: FocusItem): Promise<ValidationResult> {
    // Check if file exists
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return { found: false, error: "File not found" };
    }

    // Read file content
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Check if line number matches
    const lineIndex = item.lineNumber - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      if (lines[lineIndex] === item.lineContent) {
        return { found: true };
      }
    }

    // Search for matching line
    const foundIndex = lines.findIndex((line) => line === item.lineContent);
    if (foundIndex !== -1) {
      return {
        found: true,
        updatedLineNumber: foundIndex + 1,
        currentContent: lines[foundIndex],
      };
    }

    return { found: false, error: "Line not found" };
  }
}
