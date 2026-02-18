// ABOUTME: Leaf view displaying all waiting-for items aggregated from across the vault.
// ABOUTME: Allows marking items complete or converting back to regular actions.

import { WorkspaceLeaf, TFile, setIcon } from "obsidian";
import { getAPI } from "obsidian-dataview";
import { WaitingForScanner, WaitingForItem } from "./waiting-for-scanner";
import { WaitingForValidator } from "./waiting-for-validator";
import { PluginSettings } from "./types";
import { RefreshingView } from "./refreshing-view";

export const WAITING_FOR_VIEW_TYPE = "flow-gtd-waiting-for-view";

interface GroupedItems {
  [filePath: string]: WaitingForItem[];
}

export class WaitingForView extends RefreshingView {
  private settings: PluginSettings;
  private scanner: WaitingForScanner;
  private validator: WaitingForValidator;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private hasDataview: boolean = false;
  private saveSettings: () => Promise<void>;
  private selectedSpheres: string[] = [];
  private selectedContexts: string[] = [];
  private stateRestored = false;

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

  protected getDebounceTime(): number {
    return this.hasDataview ? 500 : 15000;
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

  // Save state for persistence across Obsidian reloads
  getState() {
    return {
      selectedSpheres: this.selectedSpheres,
      selectedContexts: this.selectedContexts,
    };
  }

  // Restore state when Obsidian reloads
  async setState(state: { selectedSpheres?: string[]; selectedContexts?: string[] }, result: any) {
    if (state?.selectedSpheres !== undefined) {
      this.selectedSpheres = state.selectedSpheres;
      this.stateRestored = true;
    }
    if (state?.selectedContexts !== undefined) {
      this.selectedContexts = state.selectedContexts;
    }
    await super.setState(state, result);
  }

  async onOpen() {
    // Only reset filter to show all spheres if state was not restored
    if (!this.stateRestored) {
      this.selectedSpheres = [...this.settings.spheres];
    }

    // Register event listener for metadata cache changes (fires after file is indexed)
    this.registerMetadataCacheListener((file: TFile) => {
      const cache = this.app.metadataCache.getFileCache(file);
      return !!(cache?.listItems && cache.listItems.length > 0);
    });

    const container = this.contentEl;
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
    this.cleanup();
  }

  protected async performRefresh(): Promise<void> {
    const container = this.contentEl;

    // Only show loading message for slow manual scans, not for fast Dataview queries
    let loadingEl: HTMLElement | null = null;
    if (!this.hasDataview) {
      container.empty();
      loadingEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
      loadingEl.setText("Refreshing...");
    }

    try {
      const items = await this.scanner.scanWaitingForItems();

      // Clear and render
      container.empty();
      this.renderContent(container as HTMLElement, items);
    } catch (error) {
      console.error("Failed to refresh waiting for view", error);
      container.empty();
      const errorEl = container.createDiv({ cls: "flow-gtd-waiting-for-loading" });
      errorEl.setText("Unable to refresh. Check the console for more information.");
    }
  }

  private renderSphereFilter(container: HTMLElement) {
    if (this.settings.spheres.length === 0) {
      return;
    }

    const filterContainer = container.createDiv({ cls: "flow-gtd-sphere-buttons" });

    this.settings.spheres.forEach((sphere) => {
      const isSelected = this.selectedSpheres.includes(sphere);
      const button = filterContainer.createEl("button", {
        cls: "flow-gtd-sphere-button",
      });
      button.setAttribute("type", "button");

      // Capitalize first letter
      const displayText = sphere.charAt(0).toUpperCase() + sphere.slice(1);
      button.setText(displayText);

      if (isSelected) {
        button.addClass("selected");
      }

      button.addEventListener("click", async () => {
        this.toggleSphereFilter(sphere);
        // Re-render the entire view
        const items = await this.scanner.scanWaitingForItems();
        const viewContainer = this.contentEl;
        viewContainer.empty();
        this.renderContent(viewContainer as HTMLElement, items);
      });
    });
  }

  private toggleSphereFilter(sphere: string) {
    const index = this.selectedSpheres.indexOf(sphere);
    if (index === -1) {
      this.selectedSpheres.push(sphere);
    } else {
      this.selectedSpheres.splice(index, 1);
    }
  }

  private filterItemsBySphere(items: WaitingForItem[]): WaitingForItem[] {
    // If all spheres selected, show all items (including those without sphere)
    if (
      this.selectedSpheres.length === 0 ||
      this.selectedSpheres.length === this.settings.spheres.length
    ) {
      return items;
    }

    // Filter to items matching selected spheres
    return items.filter((item) => {
      if (!item.sphere) {
        return false;
      }
      return this.selectedSpheres.includes(item.sphere);
    });
  }

  private discoverContexts(items: WaitingForItem[]): string[] {
    const contexts = new Set<string>();
    for (const item of items) {
      for (const context of item.contexts) {
        contexts.add(context);
      }
    }
    return Array.from(contexts).sort();
  }

  private renderContextFilter(container: HTMLElement, items: WaitingForItem[]) {
    const availableContexts = this.discoverContexts(items);

    // Prune stale selections that no longer have matching items
    this.selectedContexts = this.selectedContexts.filter((c) => availableContexts.includes(c));

    if (availableContexts.length === 0) {
      return;
    }

    const filterContainer = container.createDiv({ cls: "flow-gtd-context-buttons" });

    availableContexts.forEach((context) => {
      const isSelected = this.selectedContexts.includes(context);
      const button = filterContainer.createEl("button", {
        cls: "flow-gtd-context-button",
      });
      button.setAttribute("type", "button");
      button.setText(context);

      if (isSelected) {
        button.addClass("selected");
      }

      button.addEventListener("click", async () => {
        this.toggleContextFilter(context);
        const refreshedItems = await this.scanner.scanWaitingForItems();
        const viewContainer = this.contentEl;
        viewContainer.empty();
        this.renderContent(viewContainer as HTMLElement, refreshedItems);
      });
    });
  }

  private toggleContextFilter(context: string) {
    const index = this.selectedContexts.indexOf(context);
    if (index === -1) {
      this.selectedContexts.push(context);
    } else {
      this.selectedContexts.splice(index, 1);
    }
  }

  private filterItemsByContext(items: WaitingForItem[]): WaitingForItem[] {
    if (this.selectedContexts.length === 0) {
      return items;
    }

    return items.filter((item) => {
      return item.contexts.some((c) => this.selectedContexts.includes(c));
    });
  }

  private renderContent(container: HTMLElement, items: WaitingForItem[]) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-waiting-for-title" });
    titleEl.setText("Waiting For");

    // Render sphere filter buttons
    this.renderSphereFilter(container);

    // Render context filter buttons (using unfiltered items so all contexts are discoverable)
    this.renderContextFilter(container, items);

    // Apply filters
    const filteredItems = this.filterItemsByContext(this.filterItemsBySphere(items));

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
