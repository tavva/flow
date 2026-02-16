// ABOUTME: Modal for creating a person note with name input.
// ABOUTME: Uses FileWriter.createPerson to scaffold the note and opens it afterwards.

import { App, Modal, Setting } from "obsidian";
import { PluginSettings } from "./types";
import { FileWriter } from "./file-writer";
import { sanitizeFileName } from "./validation";

interface NewPersonData {
  name: string;
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
    };
  }

  async onOpen() {
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

    contentEl.createEl("h2", { text: "Create Person" });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("The person's name")
      .addText((text) =>
        text
          .setPlaceholder("Enter name...")
          .setValue(this.data.name)
          .onChange((value) => {
            this.data.name = value;
          })
      );

    const buttonContainer = contentEl.createDiv({
      cls: "flow-gtd-modal-buttons",
    });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
    });
    cancelButton.addEventListener("click", () => this.close());

    const createButton = buttonContainer.createEl("button", {
      text: "Create Person",
      cls: "mod-cta",
    });
    createButton.addEventListener("click", () => this.createPerson());
  }

  private async createPerson() {
    if (!this.data.name.trim()) {
      this.showError("Person name is required");
      return;
    }

    const sanitizedName = sanitizeFileName(this.data.name.trim());
    if (sanitizedName.length === 0) {
      this.showError(
        "Name contains only invalid characters. Please use letters, numbers, or spaces."
      );
      return;
    }

    try {
      const file = await this.fileWriter.createPerson(this.data.name.trim());
      this.close();

      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
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
