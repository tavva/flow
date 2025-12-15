// ABOUTME: Modal for quick capture of items to the Flow inbox.
// ABOUTME: Provides a simple text input that appends to the inbox file.

import { App, Modal, TFile, normalizePath } from "obsidian";
import { PluginSettings } from "./types";

export class AddToInboxModal extends Modal {
  private settings: PluginSettings;
  private inputValue: string = "";
  private warningEl: HTMLElement | null = null;

  constructor(app: App, settings: PluginSettings) {
    super(app);
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-add-to-inbox-modal");

    contentEl.createEl("h2", { text: "Capture to inbox" });

    const inputEl = contentEl.createEl("input", {
      type: "text",
      placeholder: "What do you want to capture?",
    });
    inputEl.style.width = "100%";
    inputEl.style.padding = "8px";
    inputEl.style.marginBottom = "12px";

    inputEl.addEventListener("input", (e) => {
      this.inputValue = (e.target as HTMLInputElement).value;
      if (this.warningEl) {
        this.warningEl.textContent = "";
      }
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      }
    });

    this.warningEl = contentEl.createDiv({ cls: "flow-modal-warning" });
    this.warningEl.style.color = "var(--text-error)";
    this.warningEl.style.marginBottom = "12px";

    const buttonContainer = contentEl.createDiv({ cls: "flow-modal-buttons" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => this.close());

    const captureButton = buttonContainer.createEl("button", {
      text: "Capture",
      cls: "mod-cta",
    });
    captureButton.addEventListener("click", () => this.submit());

    // Focus the input
    inputEl.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async submit() {
    const content = this.inputValue.trim();

    if (!content) {
      if (this.warningEl) {
        this.warningEl.textContent = "Please enter something to capture";
      }
      return;
    }

    try {
      const inboxFile = await this.getOrCreateInboxFile();
      const existingContent = await this.app.vault.read(inboxFile);

      const newContent = existingContent ? existingContent + "\n" + content + "\n" : content + "\n";

      await this.app.vault.modify(inboxFile, newContent);
      this.close();
    } catch (error) {
      console.error("Failed to save to inbox:", error);
      if (this.warningEl) {
        this.warningEl.textContent = "Failed to save to inbox";
      }
    }
  }

  private async getOrCreateInboxFile(): Promise<TFile> {
    const inboxPath = normalizePath(
      `${this.settings.inboxFilesFolderPath}/${this.settings.cliInboxFile}`
    );

    let inboxFile = this.app.vault.getAbstractFileByPath(inboxPath);

    if (!inboxFile) {
      await this.ensureFolderExists(this.settings.inboxFilesFolderPath);
      await this.app.vault.create(inboxPath, "");
      inboxFile = this.app.vault.getAbstractFileByPath(inboxPath);
    }

    if (!inboxFile || !(inboxFile instanceof TFile)) {
      throw new Error("Could not create or find inbox file");
    }

    return inboxFile;
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (existing) {
      return;
    }

    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    if (lastSlashIndex > 0) {
      const parentPath = normalizedPath.slice(0, lastSlashIndex);
      await this.ensureFolderExists(parentPath);
    }

    await this.app.vault.createFolder(normalizedPath);
  }
}
