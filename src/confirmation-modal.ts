// ABOUTME: Modal for confirming actions like restarting inbox processing
// ABOUTME: Provides a consistent UI for yes/no confirmation dialogs
import { App, Modal } from "obsidian";

export class ConfirmationModal extends Modal {
  private message: string;
  private description: string;
  private onConfirm: () => void;
  private onCancel: () => void;

  constructor(
    app: App,
    message: string,
    description: string,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.message = message;
    this.description = description;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.message });
    contentEl.createEl("p", { text: this.description });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => {
      this.close();
      this.onCancel();
    });

    const confirmButton = buttonContainer.createEl("button", {
      text: "Restart",
      cls: "mod-warning",
    });
    confirmButton.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
