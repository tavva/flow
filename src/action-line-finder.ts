// ABOUTME: Finds exact line numbers for actions in files by searching file content.
// ABOUTME: Used when adding actions to focus to get accurate line references.

import { App, TFile } from "obsidian";
import { isCheckboxLine } from "./checkbox-utils";

export interface ActionLineResult {
  found: boolean;
  lineNumber?: number;
  lineContent?: string;
  error?: string;
}

export class ActionLineFinder {
  constructor(private app: App) {}

  async findActionLine(filePath: string, actionText: string): Promise<ActionLineResult> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return { found: false, error: "File not found" };
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Search for line containing the action text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match checkbox lines containing the action text
      if (isCheckboxLine(line) && line.includes(actionText)) {
        return {
          found: true,
          lineNumber: i + 1,
          lineContent: line,
        };
      }
    }

    return { found: false, error: "Action not found in file" };
  }
}
