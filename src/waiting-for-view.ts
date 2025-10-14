// ABOUTME: Leaf view displaying all waiting-for items aggregated from across the vault.
// ABOUTME: Allows marking items complete or converting back to regular actions.

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { WaitingForScanner, WaitingForItem } from "./waiting-for-scanner";

export const WAITING_FOR_VIEW_TYPE = "flow-gtd-waiting-for-view";

interface GroupedItems {
  [filePath: string]: WaitingForItem[];
}

export class WaitingForView extends ItemView {
  private scanner: WaitingForScanner;
  private rightPaneLeaf: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.scanner = new WaitingForScanner(this.app);
  }

  getViewType(): string {
    return WAITING_FOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Waiting For";
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-waiting-for-view");

    const loadingEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
    loadingEl.setText("Loading waiting for items...");

    // Load items asynchronously after view is visible
    setTimeout(async () => {
      try {
        const items = await this.scanner.scanWaitingForItems();
        loadingEl.remove();
        this.renderContent(container as HTMLElement, items);
      } catch (error) {
        console.error("Failed to load waiting for view", error);
        loadingEl.setText(
          "Unable to load waiting for items. Check the console for more information."
        );
      }
    }, 0);
  }

  async onClose() {
    // Cleanup if needed
  }

  private renderContent(container: HTMLElement, items: WaitingForItem[]) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-waiting-for-title" });
    titleEl.setText("Waiting For");

    if (items.length === 0) {
      this.renderEmptyMessage(container);
      return;
    }

    const grouped = this.groupItemsByFile(items);
    this.renderGroupedItems(container, grouped);
  }

  private groupItemsByFile(items: WaitingForItem[]): GroupedItems {
    const grouped: GroupedItems = {};

    items.forEach((item) => {
      if (!grouped[item.file]) {
        grouped[item.file] = [];
      }
      grouped[item.file].push(item);
    });

    return grouped;
  }

  private renderGroupedItems(container: HTMLElement, grouped: GroupedItems) {
    const sortedFiles = Object.keys(grouped).sort();

    sortedFiles.forEach((filePath) => {
      const items = grouped[filePath];
      const fileSection = container.createDiv({ cls: "flow-gtd-waiting-for-file-section" });

      const fileHeader = fileSection.createEl("h3", { cls: "flow-gtd-waiting-for-file-header" });
      const fileLink = fileHeader.createEl("a", {
        text: items[0].fileName,
        cls: "flow-gtd-waiting-for-file-link",
      });
      fileLink.style.cursor = "pointer";
      fileLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openFile(filePath);
      });

      const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-waiting-for-items" });

      items.forEach((item) => {
        this.renderItem(itemsList, item);
      });
    });
  }

  private renderItem(container: HTMLElement, item: WaitingForItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-waiting-for-item" });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-waiting-for-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-waiting-for-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-waiting-for-action-btn",
      text: "✓",
    });
    completeBtn.title = "Mark as complete (changes [w] to [x])";
    completeBtn.addEventListener("click", async () => {
      await this.toggleItemComplete(item);
      itemEl.remove();
    });

    const convertBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-waiting-for-action-btn",
      text: "←",
    });
    convertBtn.title = "Convert back to regular action (changes [w] to [ ])";
    convertBtn.addEventListener("click", async () => {
      await this.convertToAction(item);
      itemEl.remove();
    });
  }

  private renderEmptyMessage(container: HTMLElement) {
    container
      .createDiv({ cls: "flow-gtd-waiting-for-empty" })
      .setText("No waiting for items found.");
  }

  private async openFile(filePath: string, lineNumber?: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    try {
      if (!this.rightPaneLeaf) {
        this.rightPaneLeaf = this.app.workspace.getLeaf("split", "vertical");
      }
      await this.rightPaneLeaf.openFile(file);

      if (lineNumber !== undefined) {
        const view = this.rightPaneLeaf.view;
        if (view && "editor" in view) {
          const editor = (view as any).editor;
          if (editor) {
            editor.setCursor({ line: lineNumber - 1, ch: 0 });
            editor.scrollIntoView(
              { from: { line: lineNumber - 1, ch: 0 }, to: { line: lineNumber - 1, ch: 0 } },
              true
            );
          }
        }
      }
    } catch (error) {
      console.error(`Failed to open file: ${filePath}`, error);
    }
  }

  private async toggleItemComplete(item: WaitingForItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = item.lineNumber - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, "[x]");
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }

  private async convertToAction(item: WaitingForItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = item.lineNumber - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, "[ ]");
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }
}
