// ABOUTME: File and folder suggesters for settings UI
// ABOUTME: Provides autocomplete for file/folder path inputs

import { AbstractInputSuggest, App, TFile, TFolder } from "obsidian";

type TriggerableInput = HTMLInputElement & {
  trigger?: (eventType: string) => void;
};

function notifyInputChanged(inputEl: TriggerableInput): void {
  if (typeof inputEl.trigger === "function") {
    inputEl.trigger("input");
    inputEl.trigger("change");
    return;
  }

  const EventCtor = inputEl.ownerDocument.defaultView?.Event ?? Event;
  inputEl.dispatchEvent(new EventCtor("input", { bubbles: true }));
  inputEl.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

/**
 * Folder path suggester for settings inputs.
 * Allows selecting existing folders while also accepting typed paths for folders that don't exist yet.
 */
export class FolderPathSuggest extends AbstractInputSuggest<TFolder> {
  private readonly inputEl: TriggerableInput;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    const folders = this.app.vault.getAllFolders(false);
    const lowerQuery = query.toLowerCase();

    return folders
      .filter((folder) => folder.path.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        const aLower = a.path.toLowerCase();
        const bLower = b.path.toLowerCase();
        const aStartsWith = aLower.startsWith(lowerQuery);
        const bStartsWith = bLower.startsWith(lowerQuery);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return aLower.localeCompare(bLower);
      })
      .slice(0, 100);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
    this.setValue(folder.path);
    notifyInputChanged(this.inputEl);
    this.close();
  }
}

/**
 * File path suggester for settings inputs.
 * Allows selecting existing files while also accepting typed paths for files that don't exist yet.
 */
export class FilePathSuggest extends AbstractInputSuggest<TFile> {
  private extensions?: string[];
  private readonly inputEl: TriggerableInput;

  constructor(app: App, inputEl: HTMLInputElement, extensions?: string[]) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.extensions = extensions;
  }

  getSuggestions(query: string): TFile[] {
    const files = this.app.vault.getFiles();
    const lowerQuery = query.toLowerCase();

    return files
      .filter((file) => {
        if (this.extensions && !this.extensions.includes(file.extension)) {
          return false;
        }
        return file.path.toLowerCase().includes(lowerQuery);
      })
      .sort((a, b) => {
        const aLower = a.path.toLowerCase();
        const bLower = b.path.toLowerCase();
        const aStartsWith = aLower.startsWith(lowerQuery);
        const bStartsWith = bLower.startsWith(lowerQuery);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return aLower.localeCompare(bLower);
      })
      .slice(0, 100);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.setValue(file.path);
    notifyInputChanged(this.inputEl);
    this.close();
  }
}
