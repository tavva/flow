// ABOUTME: Leaf view displaying curated focus of next actions from across the vault.
// ABOUTME: Allows marking items complete, converting to waiting-for, or removing from list.

import { WorkspaceLeaf, TFile, setIcon } from "obsidian";
import { getAPI } from "obsidian-dataview";
import { FocusItem, PluginSettings, FlowProject } from "./types";
import { FocusValidator, ValidationResult } from "./focus-validator";
import { FlowProjectScanner } from "./flow-scanner";
import { getProjectDisplayName } from "./project-hierarchy";
import { loadFocusItems, saveFocusItems } from "./focus-persistence";
import { RefreshingView } from "./refreshing-view";
import { extractCheckboxStatus, isCompletedCheckbox } from "./checkbox-utils";

export const FOCUS_VIEW_TYPE = "flow-gtd-focus-view";

interface GroupedFocusItems {
  projectActions: { [filePath: string]: FocusItem[] };
  generalActions: { [sphere: string]: FocusItem[] };
}

export class FocusView extends RefreshingView {
  private settings: PluginSettings;
  private validator: FocusValidator;
  private scanner: FlowProjectScanner;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private saveSettings: () => Promise<void>;
  private hasDataview: boolean = false;
  private allProjects: FlowProject[] = [];
  private draggedItem: FocusItem | null = null;
  private focusItems: FocusItem[] = [];

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.validator = new FocusValidator(this.app);
    this.scanner = new FlowProjectScanner(this.app);
    this.saveSettings = saveSettings;

    // Check if Dataview is available for fast refreshes
    try {
      this.hasDataview = !!getAPI(this.app);
    } catch {
      this.hasDataview = false;
    }
  }

  protected getDebounceTime(): number {
    return this.hasDataview ? 500 : 2000;
  }

  private getCheckboxStatusChar(lineContent: string): string {
    const status = extractCheckboxStatus(lineContent);
    if (status === "todo") return " ";
    if (status === "waiting") return "w";
    if (status === "done") return "x";
    return " ";
  }

  private getMidnightTimestamp(): number {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }

  private getCompletedTodayItems(): FocusItem[] {
    const midnight = this.getMidnightTimestamp();
    return this.focusItems.filter((item) => item.completedAt && item.completedAt >= midnight);
  }

  getViewType(): string {
    return FOCUS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Focus";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-focus-view");

    // Show loading state immediately
    this.renderLoadingState(container as HTMLElement);

    // Load focus items from file
    await this.loadFocus();

    // Clean up old completed items (before midnight)
    const midnight = this.getMidnightTimestamp();
    const originalLength = this.focusItems.length;
    this.focusItems = this.focusItems.filter(
      (item) => !item.completedAt || item.completedAt >= midnight
    );

    // Save if any items were removed
    if (this.focusItems.length < originalLength) {
      await this.saveFocus();
    }

    // Load all projects for parent context
    this.allProjects = await this.scanner.scanProjects();

    // Register event listener for metadata cache changes (fires after file is indexed)
    this.registerMetadataCacheListener((file: TFile) => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.listItems && cache.listItems.length > 0) {
        return this.focusItems.some((item) => item.file === file.path);
      }
      return false;
    });

    // Clear container and render actual content
    container.empty();
    container.addClass("flow-gtd-focus-view");

    const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
    titleEl.setText("Focus");

    // Show clear notification if applicable
    if (this.shouldShowClearNotification()) {
      this.renderClearNotification(container as HTMLElement);
    }

    // Show current projects box
    this.renderCurrentProjectsBox(container as HTMLElement);

    if (this.focusItems.length === 0) {
      this.renderEmptyMessage(container as HTMLElement);
      return;
    }

    this.renderGroupedItems(container as HTMLElement, this.focusItems);
  }

  private async loadFocus(): Promise<void> {
    this.focusItems = await loadFocusItems(this.app.vault);
  }

  private async saveFocus(): Promise<void> {
    await saveFocusItems(this.app.vault, this.focusItems);
  }

  async onClose() {
    this.cleanup();
  }

  protected async performRefresh(): Promise<void> {
    try {
      // Reload focus items from file to pick up changes from other views
      await this.loadFocus();

      // Clean up old completed items (before midnight)
      const midnight = this.getMidnightTimestamp();
      const originalLength = this.focusItems.length;
      this.focusItems = this.focusItems.filter(
        (item) => !item.completedAt || item.completedAt >= midnight
      );

      // Save if any items were removed during cleanup
      if (this.focusItems.length < originalLength) {
        await this.saveFocus();
      }

      // Validate all remaining active items (skip completed items)
      const activeItems = this.focusItems.filter((item) => !item.completedAt);
      const validatedItems: FocusItem[] = [...this.focusItems.filter((item) => item.completedAt)];
      let needsSave = false;

      for (const item of activeItems) {
        const validation = await this.validator.validateItem(item);

        if (!validation.found) {
          // Item no longer exists or line content changed significantly
          needsSave = true;
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
            // If marked as complete [x], remove from focus
            // Note: We keep waiting-for [w] items in the focus
            if (isCompletedCheckbox(line)) {
              needsSave = true;
              continue;
            }
          }
        }

        // Item is still valid and not complete
        if (validation.updatedLineNumber && validation.updatedLineNumber !== item.lineNumber) {
          // Update line number if it moved
          validatedItems.push({ ...item, lineNumber: validation.updatedLineNumber });
          needsSave = true;
        } else {
          validatedItems.push(item);
        }
      }

      // Update focus if any items were removed or updated
      if (needsSave) {
        this.focusItems = validatedItems;
        await this.saveFocus();
      }

      // Re-render the view
      const container = this.containerEl.children[1];
      container.empty();
      container.addClass("flow-gtd-focus-view");

      const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
      titleEl.setText("Focus");

      // Show clear notification if applicable
      if (this.shouldShowClearNotification()) {
        this.renderClearNotification(container as HTMLElement);
      }

      // Show current projects box
      this.renderCurrentProjectsBox(container as HTMLElement);

      if (validatedItems.length === 0) {
        this.renderEmptyMessage(container as HTMLElement);
      } else {
        this.renderGroupedItems(container as HTMLElement, validatedItems);
      }
    } catch (error) {
      console.error("Failed to refresh focus view", error);
    }
  }

  private groupItems(items: FocusItem[]): GroupedFocusItems {
    const projectActions: { [filePath: string]: FocusItem[] } = {};
    const generalActions: { [sphere: string]: FocusItem[] } = {};

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

  private renderGroupedItems(container: HTMLElement, items: FocusItem[]) {
    // Split items into pinned, unpinned active, and completed
    const activeItems = items.filter((item) => !item.completedAt);
    const pinnedItems = activeItems.filter((item) => item.isPinned === true);
    const unpinnedItems = activeItems.filter((item) => item.isPinned !== true);

    // Render pinned section (if any pinned items exist)
    if (pinnedItems.length > 0) {
      const pinnedSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      pinnedSection.createEl("h3", {
        text: "Pinned",
        cls: "flow-gtd-focus-section-title",
      });

      const pinnedList = pinnedSection.createEl("ul", {
        cls: "flow-gtd-focus-items flow-gtd-focus-pinned-items",
      });
      pinnedItems.forEach((item) => {
        this.renderPinnedItem(pinnedList, item);
      });
    }

    // Render unpinned items with existing grouping logic
    const grouped = this.groupItems(unpinnedItems);

    // Project Actions section
    if (Object.keys(grouped.projectActions).length > 0) {
      const projectSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      projectSection.createEl("h3", {
        text: "Project Actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderFileGroup(projectSection, filePath, grouped.projectActions[filePath]);
        });
    }

    // General Actions section
    if (Object.keys(grouped.generalActions).length > 0) {
      const generalSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      generalSection.createEl("h3", {
        text: "General Actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderSphereGroup(generalSection, sphere, grouped.generalActions[sphere]);
        });
    }

    // Completed Today section (at the end)
    this.renderCompletedTodaySection(container);
  }

  private renderCompletedTodaySection(container: HTMLElement): void {
    const completedItems = this.getCompletedTodayItems();
    if (completedItems.length === 0) return;

    const section = container.createDiv({ cls: "flow-gtd-focus-section" });

    // Collapsible header
    const header = section.createEl("h3", {
      cls: "flow-gtd-focus-section-title flow-gtd-focus-collapsible",
    });

    const toggleIcon = header.createSpan({ cls: "flow-gtd-focus-collapse-icon" });
    setIcon(
      toggleIcon,
      this.settings.completedTodaySectionCollapsed ? "chevron-right" : "chevron-down"
    );

    header.createSpan({ text: ` Completed Today (${completedItems.length})` });

    header.addEventListener("click", async () => {
      this.settings.completedTodaySectionCollapsed = !this.settings.completedTodaySectionCollapsed;
      await this.saveSettings();
      await this.onOpen(); // Re-render
    });

    // Content (hidden if collapsed)
    if (!this.settings.completedTodaySectionCollapsed) {
      const grouped = this.groupItems(completedItems);

      // Render project actions
      if (Object.keys(grouped.projectActions).length > 0) {
        Object.keys(grouped.projectActions)
          .sort()
          .forEach((filePath) => {
            this.renderCompletedFileGroup(section, filePath, grouped.projectActions[filePath]);
          });
      }

      // Render general actions
      if (Object.keys(grouped.generalActions).length > 0) {
        Object.keys(grouped.generalActions)
          .sort()
          .forEach((sphere) => {
            this.renderCompletedSphereGroup(section, sphere, grouped.generalActions[sphere]);
          });
      }
    }
  }

  private renderCompletedFileGroup(container: HTMLElement, filePath: string, items: FocusItem[]) {
    const fileSection = container.createDiv({ cls: "flow-gtd-focus-file-section" });

    const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-focus-file-header" });

    // Get project display name with parent context
    const displayName = getProjectDisplayName(filePath, this.allProjects);

    const fileLink = fileHeader.createEl("a", {
      text: displayName.primary,
      cls: "flow-gtd-focus-file-link",
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
        cls: "flow-gtd-focus-parent-context",
      });
      parentSpan.style.fontSize = "0.85em";
      parentSpan.style.opacity = "0.7";
      parentSpan.style.fontWeight = "normal";
    }

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderCompletedItem(itemsList, item);
    });
  }

  private renderCompletedSphereGroup(container: HTMLElement, sphere: string, items: FocusItem[]) {
    const sphereSection = container.createDiv({ cls: "flow-gtd-focus-sphere-section" });

    sphereSection.createEl("h4", {
      text: `(${sphere} sphere)`,
      cls: "flow-gtd-focus-sphere-header",
    });

    const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderCompletedItem(itemsList, item);
    });
  }

  private renderFileGroup(container: HTMLElement, filePath: string, items: FocusItem[]) {
    const fileSection = container.createDiv({ cls: "flow-gtd-focus-file-section" });

    const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-focus-file-header" });

    // Get project display name with parent context
    const displayName = getProjectDisplayName(filePath, this.allProjects);

    const fileLink = fileHeader.createEl("a", {
      text: displayName.primary,
      cls: "flow-gtd-focus-file-link",
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
        cls: "flow-gtd-focus-parent-context",
      });
      parentSpan.style.fontSize = "0.85em";
      parentSpan.style.opacity = "0.7";
      parentSpan.style.fontWeight = "normal";
    }

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderSphereGroup(container: HTMLElement, sphere: string, items: FocusItem[]) {
    const sphereSection = container.createDiv({ cls: "flow-gtd-focus-sphere-section" });

    sphereSection.createEl("h4", {
      text: `(${sphere} sphere)`,
      cls: "flow-gtd-focus-sphere-header",
    });

    const itemsList = sphereSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      this.renderItem(itemsList, item);
    });
  }

  private renderItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-focus-item" });

    // Check if this is a waiting-for item
    const checkboxStatus = this.getCheckboxStatusChar(item.lineContent);
    const isWaitingFor = checkboxStatus.toLowerCase() === "w";

    // Add handshake emoji for waiting-for items (outside the item box)
    if (isWaitingFor) {
      const handshakeSpan = itemEl.createSpan({
        cls: "flow-gtd-focus-waiting-indicator",
        text: "🤝 ",
      });
      handshakeSpan.style.marginRight = "8px";
    }

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-text" });
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

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    // Three-dot menu button (mobile only, hidden on desktop via CSS)
    const menuBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-menu",
      text: "⋯",
    });
    menuBtn.title = "More actions";
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      itemEl.toggleClass("menu-open", !itemEl.hasClass("menu-open"));
    });

    // Secondary actions (shown on hover) - wrapped in container for absolute positioning
    const secondaryActions = actionsSpan.createSpan({ cls: "flow-gtd-focus-action-secondary" });

    // Pin button (only show for unpinned items)
    if (!item.isPinned) {
      const pinBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-focus-action-btn",
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
        cls: "flow-gtd-focus-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener("click", async () => {
        await this.convertToWaitingFor(item);
      });
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from focus";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromFocus(item);
    });
  }

  private renderPinnedItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", {
      cls: "flow-gtd-focus-item flow-gtd-focus-pinned-item",
      attr: { draggable: "true" },
    });

    // Drag handle
    const dragHandle = itemEl.createSpan({ cls: "flow-gtd-focus-drag-handle" });
    setIcon(dragHandle, "grip-vertical");

    // Drag event handlers
    itemEl.addEventListener("dragstart", (e) => this.onDragStart(e, item));
    itemEl.addEventListener("dragover", (e) => this.onDragOver(e));
    itemEl.addEventListener("drop", (e) => this.onDrop(e, item));
    itemEl.addEventListener("dragend", (e) => this.onDragEnd(e));

    // Content wrapper for project name + action text
    const contentWrapper = itemEl.createDiv({ cls: "flow-gtd-focus-pinned-content" });

    // Show project name for project actions (not general actions)
    if (!item.isGeneral) {
      const displayName = getProjectDisplayName(item.file, this.allProjects);
      contentWrapper.createSpan({
        cls: "flow-gtd-focus-project-name",
        text: displayName.primary,
      });
    }

    // Check if this is a waiting-for item
    const checkboxStatus = this.getCheckboxStatusChar(item.lineContent);
    const isWaitingFor = checkboxStatus.toLowerCase() === "w";

    // Action text row (with waiting indicator if needed)
    const actionRow = contentWrapper.createDiv({ cls: "flow-gtd-focus-pinned-action-row" });

    // Add handshake emoji for waiting-for items
    if (isWaitingFor) {
      actionRow.createSpan({
        cls: "flow-gtd-focus-waiting-indicator",
        text: "🤝 ",
      });
    }

    const textSpan = actionRow.createSpan({ cls: "flow-gtd-focus-item-text" });
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

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener("click", async () => {
      await this.markItemComplete(item);
    });

    // Three-dot menu button (mobile only, hidden on desktop via CSS)
    const menuBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-menu",
      text: "⋯",
    });
    menuBtn.title = "More actions";
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      itemEl.toggleClass("menu-open", !itemEl.hasClass("menu-open"));
    });

    // Secondary actions (shown on hover) - wrapped in container for absolute positioning
    const secondaryActions = actionsSpan.createSpan({ cls: "flow-gtd-focus-action-secondary" });

    // Unpin button
    const unpinBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "⬇️",
    });
    unpinBtn.title = "Unpin from top";
    unpinBtn.addEventListener("click", async () => {
      await this.unpinItem(item);
    });

    // Only show "Convert to waiting for" button for non-waiting items
    if (!isWaitingFor) {
      const waitingBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-focus-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener("click", async () => {
        await this.convertToWaitingFor(item);
      });
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from focus";
    removeBtn.addEventListener("click", async () => {
      await this.removeFromFocus(item);
    });
  }

  private renderCompletedItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", {
      cls: "flow-gtd-focus-item flow-gtd-focus-completed",
    });

    // Add checkmark indicator
    itemEl.createSpan({
      cls: "flow-gtd-focus-completed-indicator",
      text: "✅ ",
    });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.style.textDecoration = "line-through";
    textSpan.style.opacity = "0.6";

    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    // No action buttons for completed items
  }

  private renderLoadingState(container: HTMLElement) {
    const loadingContainer = container.createDiv("flow-gtd-focus-loading");
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
      .createDiv({ cls: "flow-gtd-focus-empty" })
      .setText("No items in focus. Use planning mode in sphere view to add actions.");
  }

  private renderCurrentProjectsBox(container: HTMLElement) {
    const currentProjects = this.allProjects.filter((p) => p.current === true);
    if (currentProjects.length === 0) {
      return;
    }

    const box = container.createDiv({ cls: "flow-gtd-focus-current-projects" });

    box.createEl("div", {
      text: "Current",
      cls: "flow-gtd-focus-current-projects-header",
    });

    const list = box.createEl("div", { cls: "flow-gtd-focus-current-projects-list" });

    for (const project of currentProjects) {
      const projectLink = list.createEl("a", {
        text: project.title,
        cls: "flow-gtd-focus-current-project-link",
      });
      projectLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openFile(project.file);
      });
    }
  }

  private shouldShowClearNotification(): boolean {
    // Don't show if dismissed
    if (this.settings.focusClearedNotificationDismissed) {
      return false;
    }

    // Don't show if never cleared
    if (this.settings.lastFocusClearTimestamp === 0) {
      return false;
    }

    // Don't show if archiving failed
    if (!this.settings.lastFocusArchiveSucceeded) {
      return false;
    }

    // Only show notification within 24 hours of clearing
    const hoursSinceClear = (Date.now() - this.settings.lastFocusClearTimestamp) / (1000 * 60 * 60);
    return hoursSinceClear < 24;
  }

  private async dismissClearNotification(): Promise<void> {
    this.settings.focusClearedNotificationDismissed = true;
    await this.saveSettings();
  }

  private renderClearNotification(container: HTMLElement) {
    const notificationEl = container.createDiv({ cls: "flow-gtd-focus-notification" });
    notificationEl.style.padding = "12px";
    notificationEl.style.marginBottom = "12px";
    notificationEl.style.backgroundColor = "var(--background-secondary)";
    notificationEl.style.borderRadius = "4px";
    notificationEl.style.display = "flex";
    notificationEl.style.justifyContent = "space-between";
    notificationEl.style.alignItems = "center";

    const messageSpan = notificationEl.createSpan();
    messageSpan.setText("Your focus was automatically cleared. ");

    const archiveLink = messageSpan.createEl("a", {
      text: "View archived items",
      cls: "flow-gtd-focus-archive-link",
    });
    archiveLink.style.cursor = "pointer";
    archiveLink.style.textDecoration = "underline";
    archiveLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.openFile(this.settings.focusArchiveFile);
    });

    const dismissBtn = notificationEl.createEl("button", {
      text: "×",
      cls: "flow-gtd-focus-dismiss-btn",
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

  private isLeafAttached(leaf: WorkspaceLeaf): boolean {
    try {
      return leaf.getRoot() === this.app.workspace.rootSplit;
    } catch {
      // If getRoot() throws, treat leaf as detached
      return false;
    }
  }

  private async openFile(filePath: string, lineNumber?: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    try {
      // Reuse existing leaf if it's still valid (not detached), otherwise create new split
      let leaf = this.rightPaneLeaf;

      // Check if cached leaf is still valid and attached to workspace
      if (!leaf || !this.isLeafAttached(leaf)) {
        leaf = this.app.workspace.getLeaf("split", "vertical");
        this.rightPaneLeaf = leaf;
      }

      await leaf.openFile(file);

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

  private async markItemComplete(item: FocusItem): Promise<void> {
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

      // Replace checkbox with [x] and add completion date
      lines[lineIndex] = lines[lineIndex].replace(/\[(?: |w)\]/i, "[x]") + ` ✅ ${dateStr}`;

      await this.app.vault.modify(file, lines.join("\n"));

      // Set completedAt instead of removing from focus
      const focusIndex = this.focusItems.findIndex(
        (i) =>
          i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
      );

      if (focusIndex !== -1) {
        this.focusItems[focusIndex].completedAt = Date.now();
        await this.saveFocus();
        await this.onOpen(); // Re-render
      }
    }
  }

  private async convertToWaitingFor(item: FocusItem): Promise<void> {
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

      // Update the item's lineContent in the focus instead of removing it
      const focusIndex = this.focusItems.findIndex(
        (i) =>
          i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
      );

      if (focusIndex !== -1) {
        this.focusItems[focusIndex].lineContent = updatedLine;
        await this.saveFocus();
        await this.onOpen(); // Re-render
      }
    }
  }

  private async removeFromFocus(item: FocusItem): Promise<void> {
    this.focusItems = this.focusItems.filter(
      (i) =>
        !(i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt)
    );
    await this.saveFocus();
    await this.onOpen(); // Re-render
  }

  private async pinItem(item: FocusItem): Promise<void> {
    // Find item in focusItems
    const index = this.focusItems.findIndex(
      (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
    );

    if (index === -1) return;

    // Set isPinned flag
    this.focusItems[index].isPinned = true;

    // Move to end of pinned section
    const pinnedCount = this.focusItems.filter((i) => i.isPinned).length;
    const [pinnedItem] = this.focusItems.splice(index, 1);
    this.focusItems.splice(pinnedCount - 1, 0, pinnedItem);

    await this.saveFocus();
    await this.onOpen(); // Re-render
  }

  private async unpinItem(item: FocusItem): Promise<void> {
    const index = this.focusItems.findIndex(
      (i) => i.file === item.file && i.lineNumber === item.lineNumber && i.addedAt === item.addedAt
    );

    if (index === -1) return;

    // Clear isPinned flag (item stays in array, position doesn't matter for unpinned)
    this.focusItems[index].isPinned = false;

    await this.saveFocus();
    await this.onOpen(); // Re-render
  }

  private onDragStart(e: DragEvent, item: FocusItem): void {
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

  private async onDrop(e: DragEvent, dropTarget: FocusItem): Promise<void> {
    e.preventDefault();
    if (!this.draggedItem || this.draggedItem === dropTarget) return;

    // Find indices in focusItems
    const draggedIndex = this.focusItems.findIndex(
      (i) =>
        i.file === this.draggedItem!.file &&
        i.lineNumber === this.draggedItem!.lineNumber &&
        i.addedAt === this.draggedItem!.addedAt
    );
    const targetIndex = this.focusItems.findIndex(
      (i) =>
        i.file === dropTarget.file &&
        i.lineNumber === dropTarget.lineNumber &&
        i.addedAt === dropTarget.addedAt
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    const [item] = this.focusItems.splice(draggedIndex, 1);
    this.focusItems.splice(targetIndex, 0, item);

    await this.saveFocus();
    await this.onOpen(); // Re-render
  }

  private onDragEnd(e: DragEvent): void {
    this.draggedItem = null;
    // Remove dragging class
    const target = e.target as HTMLElement;
    target.removeClass("dragging");
  }
}
