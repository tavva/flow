// ABOUTME: Modal for creating a new person note with name and optional first discussion item.
// ABOUTME: Provides a simple interface for quick person creation outside the inbox flow.

import { App, Modal, Setting } from "obsidian";
import { PluginSettings } from "./types";
import { FileWriter } from "./file-writer";
import { sanitizeFileName } from "./validation";

interface NewPersonData {
  name: string;
  discussionItem: string;
}

export class NewPersonModal extends Modal {
  private settings: PluginSettings;
  private fileWriter: FileWriter;
  private data: NewPersonData;

  constructor(app: App, settings: PluginSettings) {
    super(app);
    this.settings = settings;
    this.fileWriter = new FileWriter(app, settings);
    this.data = {
      name: "",
      discussionItem: "",
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-gtd-new-person-modal");

    this.render();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Create New Person" });

    // Person name
    let nameInput: HTMLInputElement | null = null;
    new Setting(contentEl)
      .setName("Name")
      .setDesc("The person's name")
      .addText((text) => {
        text
          .setPlaceholder("Enter name...")
          .setValue(this.data.name)
          .onChange((value) => {
            this.data.name = value;
          });
        nameInput = text.inputEl;
      });

    // Focus the name input after the modal is fully rendered
    requestAnimationFrame(() => {
      nameInput?.focus();
    });

    // First discussion item (optional)
    new Setting(contentEl)
      .setName("First discussion item")
      .setDesc("Optional topic to discuss with this person")
      .addText((text) =>
        text
          .setPlaceholder("Enter discussion item...")
          .setValue(this.data.discussionItem)
          .onChange((value) => {
            this.data.discussionItem = value;
          })
      );

    // Action buttons
    const buttonContainer = contentEl.createDiv({ cls: "flow-gtd-modal-buttons" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => this.close());

    const createButton = buttonContainer.createEl("button", {
      text: "Create Person",
      cls: "mod-cta",
    });
    createButton.addEventListener("click", () => this.createPerson());
  }

  private async createPerson() {
    // Validate required fields
    if (!this.data.name.trim()) {
      this.showError("Person name is required");
      return;
    }

    // Validate and sanitize the name for file system
    const sanitizedName = sanitizeFileName(this.data.name.trim());
    if (sanitizedName.length === 0) {
      this.showError(
        "Person name contains only invalid characters. Please use letters, numbers, or spaces."
      );
      return;
    }

    try {
      const discussionItem = this.data.discussionItem.trim();
      const person = await this.fileWriter.createPerson(this.data.name.trim(), discussionItem);

      this.close();

      // Open the newly created person file
      const file = this.app.vault.getAbstractFileByPath(person.file);
      if (file) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file as import("obsidian").TFile);
      }
    } catch (error) {
      console.error("Failed to create person:", error);
      this.showError(
        `Failed to create person: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private showError(message: string) {
    const { contentEl } = this;
    const existingError = contentEl.querySelector(".flow-gtd-modal-error");
    if (existingError) {
      existingError.remove();
    }

    const errorEl = contentEl.createDiv({ cls: "flow-gtd-modal-error" });
    errorEl.style.color = "var(--text-error)";
    errorEl.style.marginTop = "8px";
    errorEl.style.padding = "8px";
    errorEl.style.backgroundColor = "var(--background-modifier-error)";
    errorEl.style.borderRadius = "4px";
    errorEl.setText(message);
  }
}
