// ABOUTME: Confirms selecting an existing file as the focus list.
// ABOUTME: Cancelling or dismissing the dialog preserves the current location.

import { App, Modal } from "obsidian";

export function confirmExistingFocusFile(app: App, path: string): Promise<boolean> {
  return new Promise((resolve) => new FocusFileConfirmModal(app, path, resolve).open());
}

class FocusFileConfirmModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private path: string,
    private resolve: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Use existing focus file?" });
    this.contentEl.createEl("p", {
      text: `${this.path} already exists. Use its contents as your focus list? Your current file will stay where it is. Neither file will be overwritten or merged.`,
    });
    const buttons = this.contentEl.createDiv({ cls: "flow-gtd-modal-buttons" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    buttons
      .createEl("button", { text: "Use existing file", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.confirmed = true;
        this.close();
      });
  }

  onClose(): void {
    this.resolve(this.confirmed);
    this.contentEl.empty();
  }
}
