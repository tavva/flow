// ABOUTME: Modal displaying keyboard shortcuts for the inbox processing view.
// ABOUTME: Shows available shortcuts and their actions in a readable format.

import { App, Modal, Platform } from "obsidian";

interface ShortcutDefinition {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutDefinition[];
}

export class KeyboardShortcutsModal extends Modal {
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(app: App) {
    super(app);
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
  }

  onOpen() {
    window.addEventListener("keydown", this.keyHandler, true);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-keyboard-shortcuts-modal");

    const ctrlKey = Platform.isMacOS ? "⌃" : "Ctrl";

    const header = contentEl.createDiv({ cls: "flow-shortcuts-header" });
    header.createEl("h2", { text: "Keyboard shortcuts" });

    const groups: ShortcutGroup[] = [
      {
        title: "Quick categorise",
        shortcuts: [
          { keys: ["N"], description: "Next Actions" },
          { keys: ["S"], description: "Someday/Maybe" },
          { keys: ["R"], description: "Reference" },
        ],
      },
      {
        title: "Navigation",
        shortcuts: [
          { keys: ["←"], description: "Previous item" },
          { keys: ["→"], description: "Next item" },
          { keys: ["Enter"], description: "Focus action input" },
        ],
      },
      {
        title: "Actions",
        shortcuts: [
          { keys: [ctrlKey, "⇧", "Enter"], description: "Save and continue" },
          { keys: [ctrlKey, "⇧", "Q"], description: "Unfocus input" },
          { keys: [ctrlKey, "⇧", "1", "–", "9"], description: "Toggle spheres" },
        ],
      },
      {
        title: "In action field",
        shortcuts: [
          { keys: [ctrlKey, "⇧", "W"], description: "Toggle waiting for" },
          { keys: [ctrlKey, "⇧", "F"], description: "Toggle focus" },
          { keys: [ctrlKey, "⇧", "D"], description: "Toggle done" },
        ],
      },
    ];

    const content = contentEl.createDiv({ cls: "flow-shortcuts-content" });

    for (const group of groups) {
      const groupEl = content.createDiv({ cls: "flow-shortcuts-group" });
      groupEl.createEl("h3", { text: group.title, cls: "flow-shortcuts-group-title" });

      const list = groupEl.createDiv({ cls: "flow-shortcuts-list" });
      for (const shortcut of this.renderShortcutGroup(list, group.shortcuts)) {
        // Rendering handled in helper
      }
    }

    const footer = contentEl.createDiv({ cls: "flow-shortcuts-footer" });
    const footerContent = footer.createDiv({ cls: "flow-shortcuts-footer-content" });
    this.renderKeys(footerContent, ["Esc"]);
    footerContent.createSpan({ text: " or ", cls: "flow-shortcuts-footer-text" });
    this.renderKeys(footerContent, ["?"]);
    footerContent.createSpan({ text: " to close", cls: "flow-shortcuts-footer-text" });
  }

  private *renderShortcutGroup(
    container: HTMLElement,
    shortcuts: ShortcutDefinition[]
  ): Generator<void> {
    for (const shortcut of shortcuts) {
      const row = container.createDiv({ cls: "flow-shortcuts-row" });
      const keysEl = row.createDiv({ cls: "flow-shortcuts-keys" });
      this.renderKeys(keysEl, shortcut.keys);
      row.createDiv({ text: shortcut.description, cls: "flow-shortcuts-desc" });
      yield;
    }
  }

  private renderKeys(container: HTMLElement, keys: string[]) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === "–") {
        container.createSpan({ text: "–", cls: "flow-shortcuts-separator" });
      } else {
        container.createEl("kbd", { text: key, cls: "flow-shortcut-key" });
      }
    }
  }

  onClose() {
    window.removeEventListener("keydown", this.keyHandler, true);
    const { contentEl } = this;
    contentEl.empty();
  }
}
