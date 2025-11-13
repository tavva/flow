// ABOUTME: Leaf view displaying all waiting-for items aggregated from across the vault.
// ABOUTME: Allows marking items complete or converting back to regular actions.

import { ItemView, WorkspaceLeaf, TFile, EventRef, setIcon } from "obsidian";
import { getAPI } from "obsidian-dataview";
import { WaitingForScanner, WaitingForItem } from "./waiting-for-scanner";
import { WaitingForValidator } from "./waiting-for-validator";
import { PluginSettings } from "./types";

export const WAITING_FOR_VIEW_TYPE = "flow-gtd-waiting-for-view";

interface GroupedItems {
  [filePath: string]: WaitingForItem[];
}

export class WaitingForView extends ItemView {
  private settings: PluginSettings;
  private scanner: WaitingForScanner;
  private validator: WaitingForValidator;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private modifyEventRef: EventRef | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private hasDataview: boolean = false;
  private saveSettings: () => Promise<void>;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.scanner = new WaitingForScanner(this.app);
    this.validator = new WaitingForValidator(this.app);
    this.saveSettings = saveSettings;

    // Check if Dataview is available for fast refreshes
    try {
      this.hasDataview = !!getAPI(this.app);
    } catch {
      this.hasDataview = false;
    }
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
    // Register event listener for metadata cache changes (fires after file is indexed)
    this.modifyEventRef = this.app.metadataCache.on("changed", (file) => {
      // Check if file has list items (tasks) that might be waiting-for items
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.listItems && cache.listItems.length > 0) {
        this.scheduleRefresh();
      }
    });

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
    // Unregister event listener
    if (this.modifyEventRef) {
      this.app.metadataCache.offref(this.modifyEventRef);
      this.modifyEventRef = null;
    }

    // Clear any pending refresh
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  private scheduleRefresh() {
    // Use short debounce with Dataview (fast), longer without (slow file scanning)
    const debounceTime = this.hasDataview ? 500 : 15000;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = setTimeout(async () => {
      await this.refresh();
      this.refreshTimeout = null;
    }, debounceTime);
  }

  private async refresh() {
    // Prevent concurrent refreshes
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;

    try {
      const container = this.containerEl.children[1];

      // Only show loading message for slow manual scans, not for fast Dataview queries
      let loadingEl: HTMLElement | null = null;
      if (!this.hasDataview) {
        container.empty();
        loadingEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
        loadingEl.setText("Refreshing...");
      }

      const items = await this.scanner.scanWaitingForItems();

      // Clear and render
      container.empty();
      this.renderContent(container as HTMLElement, items);
    } catch (error) {
      console.error("Failed to refresh waiting for view", error);
      const container = this.containerEl.children[1];
      container.empty();
      const errorEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
      errorEl.setText("Unable to refresh. Check the console for more information.");
    } finally {
      this.isRefreshing = false;
    }
  }

  private renderSphereFilter(container: HTMLElement) {
    if (this.settings.spheres.length === 0) {
      return;
    }

    const filterContainer = container.createDiv({ cls: "flow-gtd-waiting-for-sphere-filter" });

    this.settings.spheres.forEach((sphere) => {
      const isSelected = this.settings.waitingForFilterSpheres.includes(sphere);
      const button = filterContainer.createEl("button", {
        cls: isSelected
          ? "flow-gtd-sphere-filter-btn flow-gtd-sphere-filter-btn-selected"
          : "flow-gtd-sphere-filter-btn",
        text: sphere,
      });

      button.addEventListener("click", async () => {
        await this.toggleSphereFilter(sphere);
        // Re-render the entire view
        const items = await this.scanner.scanWaitingForItems();
        const viewContainer = this.containerEl.children[1];
        viewContainer.empty();
        this.renderContent(viewContainer as HTMLElement, items);
      });
    });
  }

  private async toggleSphereFilter(sphere: string) {
    const index = this.settings.waitingForFilterSpheres.indexOf(sphere);
    if (index === -1) {
      this.settings.waitingForFilterSpheres.push(sphere);
    } else {
      this.settings.waitingForFilterSpheres.splice(index, 1);
    }
    await this.saveSettings();
  }

  private filterItemsBySphere(items: WaitingForItem[]): WaitingForItem[] {
    // If no spheres selected, show all items
    if (this.settings.waitingForFilterSpheres.length === 0) {
      return items;
    }

    // Filter to items matching selected spheres
    return items.filter((item) => {
      if (!item.sphere) {
        return false;
      }
      return this.settings.waitingForFilterSpheres.includes(item.sphere);
    });
  }

  private renderContent(container: HTMLElement, items: WaitingForItem[]) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-waiting-for-title" });
    titleEl.setText("Waiting For");

    // Render sphere filter buttons
    this.renderSphereFilter(container);

    // Apply filter
    const filteredItems = this.filterItemsBySphere(items);

    if (filteredItems.length === 0) {
      this.renderEmptyMessage(container);
      return;
    }

    const grouped = this.groupItemsByFile(filteredItems);
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
        this.renderItem(itemsList, item, fileSection);
      });
    });
  }

  private renderItem(container: HTMLElement, item: WaitingForItem, fileSection: HTMLElement) {
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
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.toggleItemComplete(item);
      this.removeItemAndCleanup(itemEl, container, fileSection);
    });

    const convertBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-waiting-for-action-btn",
      text: "▶",
    });
    convertBtn.title = "Convert back to regular action";
    convertBtn.addEventListener("click", async () => {
      await this.convertToAction(item);
      this.removeItemAndCleanup(itemEl, container, fileSection);
    });
  }

  private removeItemAndCleanup(
    itemEl: HTMLElement,
    itemsList: HTMLElement,
    fileSection: HTMLElement
  ) {
    itemEl.remove();

    // Check if the items list is now empty
    if (itemsList.children.length === 0) {
      fileSection.remove();
    }
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
      // Always get a fresh leaf - the cached leaf may have been closed or detached
      const leaf = this.app.workspace.getLeaf("split", "vertical");
      await leaf.openFile(file);
      this.rightPaneLeaf = leaf;

      if (lineNumber !== undefined) {
        const view = leaf.view;
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
    const validation = await this.validator.validateItem(item);
    if (!validation.found) {
      console.error("Cannot mark item complete: item not found");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];

      // Replace [w] with [x] and add completion date
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, `[x]`) + ` ✅ ${dateStr}`;

      await this.app.vault.modify(file, lines.join("\n"));
    }
  }

  private async convertToAction(item: WaitingForItem): Promise<void> {
    const validation = await this.validator.validateItem(item);
    if (!validation.found) {
      console.error("Cannot convert item: item not found");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(item.file);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(/\[w\]/i, "[ ]");
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }
}
