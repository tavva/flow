// ABOUTME: Leaf view displaying curated hotlist of next actions from across the vault.
// ABOUTME: Allows marking items complete, converting to waiting-for, or removing from list.

import { ItemView, WorkspaceLeaf, TFile, EventRef, setIcon } from "obsidian";
import { getAPI } from "obsidian-dataview";
import { HotlistItem, PluginSettings, FlowProject } from "./types";
import { HotlistValidator, ValidationResult } from "./hotlist-validator";
import { FlowProjectScanner } from "./flow-scanner";
import { getProjectDisplayName } from "./project-hierarchy";

export const HOTLIST_VIEW_TYPE = "flow-gtd-hotlist-view";

interface GroupedHotlistItems {
  projectActions: { [filePath: string]: HotlistItem[] };
  generalActions: { [sphere: string]: HotlistItem[] };
}

export class HotlistView extends ItemView {
  private settings: PluginSettings;
  private validator: HotlistValidator;
  private scanner: FlowProjectScanner;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private saveSettings: () => Promise<void>;
  private modifyEventRef: EventRef | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private hasDataview: boolean = false;
  private allProjects: FlowProject[] = [];
  private draggedItem: HotlistItem | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.validator = new HotlistValidator(this.app);
    this.scanner = new FlowProjectScanner(this.app);
    this.saveSettings = saveSettings;

    // Check if Dataview is available for fast refreshes
    try {
      this.hasDataview = !!getAPI(this.app);
    } catch {
      this.hasDataview = false;
    }
  }

  private extractCheckboxStatus(lineContent: string): string {
    const match = lineContent.match(/^[-*]\s*\[(.)\]/);
    return match ? match[1] : " ";
  }

  getViewType(): string {
    return HOTLIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Hotlist";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-hotlist-view");

    // Show loading state immediately
    this.renderLoadingState(container as HTMLElement);

    // Load all projects for parent context
    this.allProjects = await this.scanner.scanProjects();

    // Register event listener for metadata cache changes (fires after file is indexed)
    this.modifyEventRef = this.app.metadataCache.on("changed", (file) => {
      // Check if file has list items (tasks) that might be hotlist items
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.listItems && cache.listItems.length > 0) {
        // Check if this file contains any hotlist items
        const hasHotlistItems = this.settings.hotlist.some((item) => item.file === file.path);
        if (hasHotlistItems) {
          this.scheduleRefresh();
        }
      }
    });

    // Clear container and render actual content
    container.empty();
    container.addClass("flow-gtd-hotlist-view");

    const titleEl = container.createEl("h2", { cls: "flow-gtd-hotlist-title" });
    titleEl.setText("Hotlist");

    // Show clear notification if applicable
    if (this.shouldShowClearNotification()) {
      this.renderClearNotification(container as HTMLElement);
    }

    if (this.settings.hotlist.length === 0) {
      this.renderEmptyMessage(container as HTMLElement);
      return;
    }

    this.renderGroupedItems(container as HTMLElement, this.settings.hotlist);
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
    const debounceTime = this.hasDataview ? 500 : 2000;

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
      // Validate all hotlist items and remove completed ones
      const validatedItems: HotlistItem[] = [];
      let needsSettingsSave = false;

      for (const item of this.settings.hotlist) {
        const validation = await this.validator.validateItem(item);

        if (!validation.found) {
          // Item no longer exists or line content changed significantly
          needsSettingsSave = true;
          continue;
        }

        // Check if item was marked as complete
        const file = this.app.vault.getAbstractFileByPath(item.file);
        if (file instanceof TFile) {
          const content = await this.app.vault.read(file);
          const lines = content.split(/\r?\n/);
          const lineIndex = (validation.updatedLineNumber || item.lineNumber) - 1;

          if (lineIndex >= 0 && lineIndex < lines.length) {
            const line = lines[lineIndex];
            // If marked as complete [x], remove from hotlist
            // Note: We keep waiting-for [w] items in the hotlist
            if (line.match(/\[x\]/i)) {
              needsSettingsSave = true;
              continue;
            }
          }
        }

        // Item is still valid and not complete
        if (validation.updatedLineNumber && validation.updatedLineNumber !== item.lineNumber) {
          // Update line number if it moved
          validatedItems.push({ ...item, lineNumber: validation.updatedLineNumber });
          needsSettingsSave = true;
        } else {
          validatedItems.push(item);
        }
      }

      // Update settings if any items were removed or updated
      if (needsSettingsSave) {
        this.settings.hotlist = validatedItems;
        await this.saveSettings();
      }

      // Re-render the view
      const container = this.containerEl.children[1];
      container.empty();
      container.addClass("flow-gtd-hotlist-view");

      const titleEl = container.createEl("h2", { cls: "flow-gtd-hotlist-title" });
      titleEl.setText("Hotlist");

      // Show clear notification if applicable
      if (this.shouldShowClearNotification()) {
        this.renderClearNotification(container as HTMLElement);
      }

      if (validatedItems.length === 0) {
        this.renderEmptyMessage(container as HTMLElement);
      } else {
        this.renderGroupedItems(container as HTMLElement, validatedItems);
      }
    } catch (error) {
      console.error("Failed to refresh hotlist view", error);
    } finally {
      this.isRefreshing = false;
    }
  }

  private groupItems(items: HotlistItem[]): GroupedHotlistItems {
    const projectActions: { [filePath: string]: HotlistItem[] } = {};
    const generalActions: { [sphere: string]: HotlistItem[] } = {};

    items.forEach((item) => {
      if (item.isGeneral) {
        if (!generalActions[item.sphere]) {
          generalActions[item.sphere] = [];
        }
        generalActions[item.sphere].push(item);
      } else {
        if (!projectActions[item.file]) {
          projectActions[item.file] = [];
        }
        projectActions[item.file].push(item);
      }
    });

    return { projectActions, generalActions };
  }

  private renderGroupedItems(container: HTMLElement, items: HotlistItem[]) {
    // Split items into pinned and unpinned
    const pinnedItems = items.filter((item) => item.isPinned === true);
    const unpinnedItems = items.filter((item) => item.isPinned !== true);

    // Render pinned section (if any pinned items exist)
    if (pinnedItems.length > 0) {
      const pinnedSection = container.createDiv({ cls: "flow-gtd-hotlist-section" });
      pinnedSection.createEl("h3", {
        text: "Pinned",
        cls: "flow-gtd-hotlist-section-title",
      });

      const pinnedList = pinnedSection.createEl("ul", {
        cls: "flow-gtd-hotlist-items flow-gtd-hotlist-pinned-items",
      });
      pinnedItems.forEach((item) => {
        this.renderPinnedItem(pinnedList, item);
      });
    }

    // Render unpinned items with existing grouping logic
    const grouped = this.groupItems(unpinnedItems);

    // Project Actions section
    if (Object.keys(grouped.projectActions).length > 0) {
      const projectSection = container.createDiv({ cls: "flow-gtd-hotlist-section" });
      projectSection.createEl("h3", {
        text: "Project Actions",
        cls: "flow-gtd-hotlist-section-title",
      });

      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderFileGroup(projectSection, filePath, grouped.projectActions[filePath]);
        });
    }

    // General Actions section
    if (Object.keys(grouped.generalActions).length > 0) {
      const generalSection = container.createDiv({ cls: "flow-gtd-hotlist-section" });
      generalSection.createEl("h3", {
        text: "General Actions",
        cls: "flow-gtd-hotlist-section-title",
      });

      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderSphereGroup(generalSection, sphere, grouped.generalActions[sphere]);
        });
    }
  }

  private renderFileGroup(container: HTMLElement, filePath: string, items: HotlistItem[]) {
    const fileSection = container.createDiv({ cls: "flow-gtd-hotlist-file-section" });

    const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-hotlist-file-header" });

    // Get project display name with parent context
    const displayName = getProjectDisplayName(filePath, this.allProjects);

    const fileLink = fileHeader.createEl("a", {
      text: displayName.primary,
      cls: "flow-gtd-hotlist-file-link",
    });
    fileLink.style.cursor = "pointer";
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openFile(filePath);
    });

    // Add parent project context if it exists
    if (displayName.parent) {
      const parentSpan = fileHeader.createSpan({
        text: ` (${displayName.parent})`,
        cls: "flow-gtd-hotlist-parent-context",
      });
      parentSpan.style.fontSize = "0.85em";
      parentSpan.style.opacity = "0.7";
      parentSpan.style.fontWeight = "normal";
    }

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-hotlist-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderSphereGroup(container: HTMLElement, sphere: string, items: HotlistItem[]) {
    const sphereSection = container.createDiv({ cls: "flow-gtd-hotlist-sphere-section" });

    sphereSection.createEl("h4", {
      text: `(${sphere} sphere)`,
      cls: "flow-gtd-hotlist-sphere-header",
    });

    const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-hotlist-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderItem(container: HTMLElement, item: HotlistItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-hotlist-item" });

    // Check if this is a waiting-for item
    const checkboxStatus = this.extractCheckboxStatus(item.lineContent);
    const isWaitingFor = checkboxStatus.toLowerCase() === "w";

    // Add clock emoji for waiting-for items (outside the item box)
    if (isWaitingFor) {
      const clockSpan = itemEl.createSpan({
        cls: "flow-gtd-hotlist-waiting-indicator",
        text: "🕐 ",
      });
      clockSpan.style.marginRight = "8px";
    }

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";

    // Gray out waiting-for items
    if (isWaitingFor) {
      textSpan.style.opacity = "0.6";
      textSpan.style.fontStyle = "italic";
    }

    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn flow-gtd-hotlist-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    // Three-dot menu button (mobile only, hidden on desktop via CSS)
    const menuBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn flow-gtd-hotlist-action-menu",
      text: "⋯",
    });
    menuBtn.title = "More actions";
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      itemEl.toggleClass("menu-open", !itemEl.hasClass("menu-open"));
    });

    // Secondary actions (shown on hover) - wrapped in container for absolute positioning
    const secondaryActions = actionsSpan.createSpan({ cls: "flow-gtd-hotlist-action-secondary" });

    // Pin button (only show for unpinned items)
    if (!item.isPinned) {
      const pinBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-hotlist-action-btn",
        text: "📌",
      });
      pinBtn.title = "Pin to top";
      pinBtn.addEventListener("click", async () => {
        await this.pinItem(item);
      });
    }

    // Only show "Convert to waiting for" button for non-waiting items
    if (!isWaitingFor) {
      const waitingBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-hotlist-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener("click", async () => {
        await this.convertToWaitingFor(item);
      });
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from hotlist";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromHotlist(item);
    });
  }

  private renderPinnedItem(container: HTMLElement, item: HotlistItem) {
    const itemEl = container.createEl("li", {
      cls: "flow-gtd-hotlist-item flow-gtd-hotlist-pinned-item",
      attr: { draggable: "true" },
    });

    // Drag handle
    const dragHandle = itemEl.createSpan({ cls: "flow-gtd-hotlist-drag-handle" });
    setIcon(dragHandle, "grip-vertical");

    // Drag event handlers
    itemEl.addEventListener("dragstart", (e) => this.onDragStart(e, item));
    itemEl.addEventListener("dragover", (e) => this.onDragOver(e));
    itemEl.addEventListener("drop", (e) => this.onDrop(e, item));
    itemEl.addEventListener("dragend", (e) => this.onDragEnd(e));

    // Check if this is a waiting-for item
    const checkboxStatus = this.extractCheckboxStatus(item.lineContent);
    const isWaitingFor = checkboxStatus.toLowerCase() === "w";

    // Add clock emoji for waiting-for items (outside the item box)
    if (isWaitingFor) {
      const clockSpan = itemEl.createSpan({
        cls: "flow-gtd-hotlist-waiting-indicator",
        text: "🕐 ",
      });
      clockSpan.style.marginRight = "8px";
    }

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";

    // Gray out waiting-for items
    if (isWaitingFor) {
      textSpan.style.opacity = "0.6";
      textSpan.style.fontStyle = "italic";
    }

    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-hotlist-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn flow-gtd-hotlist-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    // Three-dot menu button (mobile only, hidden on desktop via CSS)
    const menuBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn flow-gtd-hotlist-action-menu",
      text: "⋯",
    });
    menuBtn.title = "More actions";
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      itemEl.toggleClass("menu-open", !itemEl.hasClass("menu-open"));
    });

    // Secondary actions (shown on hover) - wrapped in container for absolute positioning
    const secondaryActions = actionsSpan.createSpan({ cls: "flow-gtd-hotlist-action-secondary" });

    // Unpin button
    const unpinBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "⬇️",
    });
    unpinBtn.title = "Unpin from top";
    unpinBtn.addEventListener("click", async () => {
      await this.unpinItem(item);
    });

    // Only show "Convert to waiting for" button for non-waiting items
    if (!isWaitingFor) {
      const waitingBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-hotlist-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener("click", async () => {
        await this.convertToWaitingFor(item);
      });
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-hotlist-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from hotlist";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromHotlist(item);
    });
  }

  private renderLoadingState(container: HTMLElement) {
    const loadingContainer = container.createDiv("flow-gtd-hotlist-loading");
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.padding = "48px 24px";
    loadingContainer.style.display = "flex";
    loadingContainer.style.alignItems = "center";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.minHeight = "200px";

    const waveIcon = loadingContainer.createEl("div");
    waveIcon.style.width = "64px";
    waveIcon.style.height = "64px";
    waveIcon.style.display = "flex";
    waveIcon.style.alignItems = "center";
    waveIcon.style.justifyContent = "center";
    setIcon(waveIcon, "waves");
  }

  private renderEmptyMessage(container: HTMLElement) {
    container
      .createDiv({ cls: "flow-gtd-hotlist-empty" })
      .setText("No items in hotlist. Use planning mode in sphere view to add actions.");
  }

  private shouldShowClearNotification(): boolean {
    // Don't show if dismissed
    if (this.settings.hotlistClearedNotificationDismissed) {
      return false;
    }

    // Don't show if never cleared
    if (this.settings.lastHotlistClearTimestamp === 0) {
      return false;
    }

    // Don't show if archiving failed
    if (!this.settings.lastHotlistArchiveSucceeded) {
      return false;
    }

    // Only show notification within 24 hours of clearing
    const hoursSinceClear =
      (Date.now() - this.settings.lastHotlistClearTimestamp) / (1000 * 60 * 60);
    return hoursSinceClear < 24;
  }

  private async dismissClearNotification(): Promise<void> {
    this.settings.hotlistClearedNotificationDismissed = true;
    await this.saveSettings();
  }

  private renderClearNotification(container: HTMLElement) {
    const notificationEl = container.createDiv({ cls: "flow-gtd-hotlist-notification" });
    notificationEl.style.padding = "12px";
    notificationEl.style.marginBottom = "12px";
    notificationEl.style.backgroundColor = "var(--background-secondary)";
    notificationEl.style.borderRadius = "4px";
    notificationEl.style.display = "flex";
    notificationEl.style.justifyContent = "space-between";
    notificationEl.style.alignItems = "center";

    const messageSpan = notificationEl.createSpan();
    messageSpan.setText("Your hotlist was automatically cleared. ");

    const archiveLink = messageSpan.createEl("a", {
      text: "View archived items",
      cls: "flow-gtd-hotlist-archive-link",
    });
    archiveLink.style.cursor = "pointer";
    archiveLink.style.textDecoration = "underline";
    archiveLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openFile(this.settings.hotlistArchiveFile);
    });

    const dismissBtn = notificationEl.createEl("button", {
      text: "×",
      cls: "flow-gtd-hotlist-dismiss-btn",
    });
    dismissBtn.style.fontSize = "20px";
    dismissBtn.style.cursor = "pointer";
    dismissBtn.style.border = "none";
    dismissBtn.style.background = "transparent";
    dismissBtn.title = "Dismiss";
    dismissBtn.addEventListener("click", async () => {
      await this.dismissClearNotification();
      notificationEl.remove();
    });
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

  private async markItemComplete(item: HotlistItem): Promise<void> {
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
      lines[lineIndex] = lines[lineIndex].replace(/\[(?: |w)\]/i, "[x]");
      await this.app.vault.modify(file, lines.join("\n"));
      await this.removeFromHotlist(item);
    }
  }

  private async convertToWaitingFor(item: HotlistItem): Promise<void> {
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
      const updatedLine = lines[lineIndex].replace(/\[ \]/i, "[w]");
      lines[lineIndex] = updatedLine;
      await this.app.vault.modify(file, lines.join("\n"));

      // Update the item's lineContent in the hotlist instead of removing it
      const hotlistIndex = this.settings.hotlist.findIndex(
        (i) =>
          i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
      );

      if (hotlistIndex !== -1) {
        this.settings.hotlist[hotlistIndex].lineContent = updatedLine;
        await this.saveSettings();
        await this.refreshSphereViews();
        await this.onOpen(); // Re-render
      }
    }
  }

  private async removeFromHotlist(item: HotlistItem): Promise<void> {
    this.settings.hotlist = this.settings.hotlist.filter(
      (i) =>
        !(i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt)
    );
    await this.saveSettings();
    await this.refreshSphereViews();
    await this.onOpen(); // Re-render
  }

  private async pinItem(item: HotlistItem): Promise<void> {
    // Find item in settings.hotlist
    const index = this.settings.hotlist.findIndex(
      (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
    );

    if (index === -1) return;

    // Set isPinned flag
    this.settings.hotlist[index].isPinned = true;

    // Move to end of pinned section
    const pinnedCount = this.settings.hotlist.filter((i) => i.isPinned).length;
    const [pinnedItem] = this.settings.hotlist.splice(index, 1);
    this.settings.hotlist.splice(pinnedCount - 1, 0, pinnedItem);

    await this.saveSettings();
    await this.onOpen(); // Re-render
  }

  private async unpinItem(item: HotlistItem): Promise<void> {
    const index = this.settings.hotlist.findIndex(
      (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
    );

    if (index === -1) return;

    // Clear isPinned flag (item stays in array, position doesn't matter for unpinned)
    this.settings.hotlist[index].isPinned = false;

    await this.saveSettings();
    await this.onOpen(); // Re-render
  }

  private onDragStart(e: DragEvent, item: HotlistItem): void {
    this.draggedItem = item;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
    // Add dragging class to item
    const target = e.target as HTMLElement;
    target.addClass("dragging");
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  private async onDrop(e: DragEvent, dropTarget: HotlistItem): Promise<void> {
    e.preventDefault();
    if (!this.draggedItem || this.draggedItem === dropTarget) return;

    // Find indices in settings.hotlist
    const draggedIndex = this.settings.hotlist.findIndex(
      (i) =>
        i.file === this.draggedItem!.file &&
        i.lineNumber === this.draggedItem!.lineNumber &&
        i.addedAt === this.draggedItem!.addedAt
    );
    const targetIndex = this.settings.hotlist.findIndex(
      (i) =>
        i.file === dropTarget.file &&
        i.lineNumber === dropTarget.lineNumber &&
        i.addedAt === dropTarget.addedAt
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    const [item] = this.settings.hotlist.splice(draggedIndex, 1);
    this.settings.hotlist.splice(targetIndex, 0, item);

    await this.saveSettings();
    await this.onOpen(); // Re-render
  }

  private onDragEnd(e: DragEvent): void {
    this.draggedItem = null;
    // Remove dragging class
    const target = e.target as HTMLElement;
    target.removeClass("dragging");
  }

  private async refreshSphereViews(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType("flow-gtd-sphere-view");

    if (leaves.length > 0) {
      for (const leaf of leaves) {
        if (leaf.view && "onOpen" in leaf.view) {
          await (leaf.view as any).onOpen();
        }
      }
    }
  }
}
