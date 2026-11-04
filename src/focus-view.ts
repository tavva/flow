// ABOUTME: Leaf view displaying curated focus of next actions from across the vault.
// ABOUTME: Allows marking items complete, converting to waiting-for, or removing from list.

import {
  WorkspaceLeaf,
  TFile,
  setIcon,
  MarkdownRenderer,
  ViewStateResult,
  Editor,
  Notice,
} from "obsidian";
import { ExternalFocusItem, FocusItem, PluginSettings, FlowProject, VaultFocusItem } from "./types";
import { isExternalFocusItem, isSameFocusItem, isVaultFocusItem, isWebUrl } from "./focus-item";
import { FocusValidator } from "./focus-validator";
import { FlowProjectScanner } from "./flow-scanner";
import { getProjectDisplayName } from "./project-hierarchy";
import { loadFocusItems, parseFocusItems, updateFocusItems } from "./focus-persistence";
import { RefreshingView } from "./refreshing-view";
import { extractCheckboxStatus, isCompletedCheckbox } from "./checkbox-utils";
import { getDataviewApi } from "./dataview-api";
import { runAsync, wrapAsyncEvent } from "./async-utils";
import { resolveFocusFilePath } from "./focus-file-path";

export const FOCUS_VIEW_TYPE = "flow-gtd-focus-view";

interface GroupedFocusItems {
  projectActions: { [filePath: string]: VaultFocusItem[] };
  externalActions: { [sourceLabel: string]: ExternalFocusItem[] };
  generalActions: { [sphere: string]: VaultFocusItem[] };
}

interface ViewWithEditor {
  editor?: Editor;
}

interface GlobalSearchPlugin {
  instance?: {
    openGlobalSearch?: (query: string) => void;
  };
}

interface AppWithInternalPlugins {
  internalPlugins?: {
    getPluginById?: (id: string) => GlobalSearchPlugin | undefined;
  };
}

interface FlowWorkspaceTrigger {
  trigger(
    eventType: "flow:action-completed" | "flow:action-waiting",
    detail: {
      file: string;
      action: string;
    }
  ): void;
}

const ITEM_GONE_MESSAGE =
  "This action is no longer in Focus, so Focus wasn't updated. Refresh the Focus view.";

/**
 * Find an item in the latest focus list. A vault item whose line number was updated
 * elsewhere (another view or device) is still found by its file, time added and line.
 */
function findFocusItemIndex(items: FocusItem[], item: FocusItem): number {
  const index = items.findIndex((i) => isSameFocusItem(i, item));
  if (index !== -1 || isExternalFocusItem(item)) return index;
  return items.findIndex(
    (i) =>
      isVaultFocusItem(i) &&
      i.file === item.file &&
      i.addedAt === item.addedAt &&
      i.lineContent === item.lineContent
  );
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
  private loadedFocusFilePath: string;
  private focusLoadVersion = 0;
  private loadedFocusSnapshot: string | null = null;
  private selectedContexts: string[] = [];
  // While a wording edit is open, re-rendering would throw it away, so refreshes wait
  private editingItem: ExternalFocusItem | null = null;
  private refreshDeferred = false;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.loadedFocusFilePath = resolveFocusFilePath(settings.focusFilePath);
    this.validator = new FocusValidator(this.app);
    this.scanner = new FlowProjectScanner(this.app);
    this.saveSettings = saveSettings;

    // Check if Dataview is available for fast refreshes
    try {
      this.hasDataview = !!getDataviewApi(this.app);
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

  // Save state for persistence across Obsidian reloads
  getState() {
    return {
      selectedContexts: this.selectedContexts,
    };
  }

  // Restore state when Obsidian reloads
  async setState(state: { selectedContexts?: string[] }, result: ViewStateResult) {
    if (state?.selectedContexts !== undefined) {
      this.selectedContexts = state.selectedContexts;
    }
    await super.setState(state, result);
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
    if (this.editingItem) {
      this.refreshDeferred = true;
      return;
    }
    this.cleanup();
    const container = this.contentEl;
    container.empty();
    container.addClass("flow-gtd-focus-view");

    // Show loading state immediately
    this.renderLoadingState(container);

    // Load focus items from file
    const loadVersion = await this.loadFocus();
    if (loadVersion !== this.focusLoadVersion) return;

    await this.removeCompletedBeforeToday();

    // Load all projects for parent context
    this.allProjects = await this.scanner.scanProjects();
    if (loadVersion !== this.focusLoadVersion) return;

    // Register event listener for metadata cache changes (fires after file is indexed)
    this.registerMetadataCacheListener((file: TFile, data: string) => {
      // Other writers (inbox processing, new projects, spheres) change the focus file
      // directly; skip changes that only echo this view's own saves.
      if (file.path === this.loadedFocusFilePath) {
        return JSON.stringify(parseFocusItems(data)) !== this.loadedFocusSnapshot;
      }
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.listItems && cache.listItems.length > 0) {
        return this.focusItems.some((item) => isVaultFocusItem(item) && item.file === file.path);
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
      this.renderClearNotification(container);
    }

    // Render context filter buttons (using all items so all contexts are discoverable)
    this.renderContextFilter(container, this.focusItems);

    // Show current projects box
    this.renderCurrentProjectsBox(container);

    // Apply context filter
    const filteredItems = this.filterItemsByContext(this.focusItems);

    if (filteredItems.length === 0) {
      this.renderEmptyMessage(container);
      return;
    }

    this.renderGroupedItems(container, filteredItems);
  }

  private async loadFocus(): Promise<number> {
    const loadVersion = ++this.focusLoadVersion;
    const filePath = resolveFocusFilePath(this.settings.focusFilePath);
    let items: FocusItem[];
    try {
      items = await loadFocusItems(this.app.vault, filePath);
    } catch (error) {
      if (loadVersion === this.focusLoadVersion) this.loadedFocusSnapshot = null;
      throw error;
    }
    if (
      loadVersion !== this.focusLoadVersion ||
      filePath !== resolveFocusFilePath(this.settings.focusFilePath)
    )
      return -1;
    this.focusItems = items;
    this.loadedFocusSnapshot = JSON.stringify(items);
    this.loadedFocusFilePath = filePath;
    return loadVersion;
  }

  /**
   * Apply an edit to the latest focus file under the focus lock, so changes other writers
   * made since this view loaded (other plugins, sync, other views) are kept.
   */
  private async updateFocus(edit: (items: FocusItem[]) => FocusItem[]): Promise<void> {
    if (this.loadedFocusFilePath !== resolveFocusFilePath(this.settings.focusFilePath)) {
      throw new Error("Focus file changed. Refresh the Focus view before trying again.");
    }
    const filePath = this.loadedFocusFilePath;
    const loadVersion = this.focusLoadVersion;
    const items = await updateFocusItems(
      this.app.vault,
      (current) => {
        if (filePath !== resolveFocusFilePath(this.settings.focusFilePath)) {
          throw new Error("Focus file changed. Refresh the Focus view before trying again.");
        }
        return edit(current);
      },
      filePath
    );
    if (loadVersion === this.focusLoadVersion) {
      this.focusItems = items;
      this.loadedFocusSnapshot = JSON.stringify(items);
    }
  }

  /** Change one item in the latest focus file. Returns false if the item is no longer there. */
  private async updateFocusItem(
    item: FocusItem,
    change: (current: FocusItem) => void
  ): Promise<boolean> {
    let found = false;
    await this.updateFocus((items) => {
      const current = items[findFocusItemIndex(items, item)];
      if (current) {
        change(current);
        found = true;
      }
      return items;
    });
    return found;
  }

  private async removeCompletedBeforeToday(): Promise<void> {
    const midnight = this.getMidnightTimestamp();
    const isCurrent = (item: FocusItem) => !item.completedAt || item.completedAt >= midnight;
    if (this.focusItems.every(isCurrent)) return;
    await this.updateFocus((items) => items.filter(isCurrent));
  }

  async onClose() {
    this.cleanup();
  }

  protected async performRefresh(): Promise<void> {
    if (this.editingItem) {
      this.refreshDeferred = true;
      return;
    }
    try {
      // Reload focus items from file to pick up changes from other views
      const loadVersion = await this.loadFocus();
      if (loadVersion !== this.focusLoadVersion) return;

      await this.removeCompletedBeforeToday();

      // Validate all remaining active vault items; external items have no vault line to check
      const activeItems = this.focusItems.filter(
        (item): item is VaultFocusItem => isVaultFocusItem(item) && !item.completedAt
      );
      const removedItems: VaultFocusItem[] = [];
      const movedItems: { item: VaultFocusItem; lineNumber: number }[] = [];

      for (const item of activeItems) {
        const validation = await this.validator.validateItem(item);

        if (!validation.found) {
          // Item no longer exists or line content changed significantly
          removedItems.push(item);
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
              removedItems.push(item);
              continue;
            }
          }
        }

        // Item is still valid and not complete; update its line number if it moved
        if (validation.updatedLineNumber && validation.updatedLineNumber !== item.lineNumber) {
          movedItems.push({ item, lineNumber: validation.updatedLineNumber });
        }
      }

      // Update focus if any items were removed or updated
      if (
        loadVersion !== this.focusLoadVersion ||
        this.loadedFocusFilePath !== resolveFocusFilePath(this.settings.focusFilePath)
      )
        return;
      if (removedItems.length > 0 || movedItems.length > 0) {
        await this.updateFocus((items) =>
          items
            .filter((item) => !removedItems.some((removed) => isSameFocusItem(item, removed)))
            .map((item) => {
              const moved = movedItems.find((entry) => isSameFocusItem(item, entry.item));
              return moved && isVaultFocusItem(item)
                ? { ...item, lineNumber: moved.lineNumber }
                : item;
            })
        );
      }

      // Re-render the view
      if (loadVersion !== this.focusLoadVersion) return;
      const container = this.contentEl;
      container.empty();
      container.addClass("flow-gtd-focus-view");

      const titleEl = container.createEl("h2", { cls: "flow-gtd-focus-title" });
      titleEl.setText("Focus");

      // Show clear notification if applicable
      if (this.shouldShowClearNotification()) {
        this.renderClearNotification(container);
      }

      // Render context filter buttons (using all items so all contexts are discoverable)
      this.renderContextFilter(container, this.focusItems);

      // Show current projects box
      this.renderCurrentProjectsBox(container);

      // Apply context filter
      const filteredItems = this.filterItemsByContext(this.focusItems);

      if (filteredItems.length === 0) {
        this.renderEmptyMessage(container);
      } else {
        this.renderGroupedItems(container, filteredItems);
      }
    } catch (error) {
      console.error("Failed to refresh focus view", error);
    }
  }

  private discoverContexts(items: FocusItem[]): string[] {
    const contexts = new Set<string>();
    for (const item of items) {
      for (const context of item.contexts || []) {
        contexts.add(context);
      }
    }
    return Array.from(contexts).sort();
  }

  private renderContextFilter(container: HTMLElement, items: FocusItem[]) {
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

      button.addEventListener(
        "click",
        wrapAsyncEvent(async () => {
          this.toggleContextFilter(context);
          await this.onOpen();
        }, "Failed to filter focus items by context")
      );
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

  private filterItemsByContext(items: FocusItem[]): FocusItem[] {
    if (this.selectedContexts.length === 0) {
      return items;
    }

    return items.filter((item) => {
      return (item.contexts || []).some((c) => this.selectedContexts.includes(c));
    });
  }

  private groupItems(items: FocusItem[]): GroupedFocusItems {
    const projectActions: { [filePath: string]: VaultFocusItem[] } = {};
    const externalActions: { [sourceLabel: string]: ExternalFocusItem[] } = {};
    const generalActions: { [sphere: string]: VaultFocusItem[] } = {};

    items.forEach((item) => {
      if (isExternalFocusItem(item)) {
        const label = item.external.sourceLabel;
        if (!externalActions[label]) {
          externalActions[label] = [];
        }
        externalActions[label].push(item);
      } else if (item.isGeneral) {
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

    return { projectActions, externalActions, generalActions };
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
        runAsync(this.renderPinnedItem(pinnedList, item), "Failed to render pinned focus item");
      });
    }

    // Render unpinned items with existing grouping logic
    const grouped = this.groupItems(unpinnedItems);

    // Project Actions section
    if (Object.keys(grouped.projectActions).length > 0) {
      const projectSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      projectSection.createEl("h3", {
        text: "Project actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.projectActions)
        .sort()
        .forEach((filePath) => {
          this.renderFileGroup(projectSection, filePath, grouped.projectActions[filePath]);
        });
    }

    // One section per outside source, e.g. a Linear workspace
    Object.keys(grouped.externalActions)
      .sort()
      .forEach((sourceLabel) => {
        const sourceSection = container.createDiv({ cls: "flow-gtd-focus-section" });
        sourceSection.createEl("h3", {
          text: sourceLabel,
          cls: "flow-gtd-focus-section-title",
        });
        const itemsList = sourceSection.createEl("ul", { cls: "flow-gtd-focus-items" });
        grouped.externalActions[sourceLabel].forEach((item) => {
          runAsync(this.renderItem(itemsList, item), "Failed to render focus item");
        });
      });

    // General Actions section
    if (Object.keys(grouped.generalActions).length > 0) {
      const generalSection = container.createDiv({ cls: "flow-gtd-focus-section" });
      generalSection.createEl("h3", {
        text: "General actions",
        cls: "flow-gtd-focus-section-title",
      });

      Object.keys(grouped.generalActions)
        .sort()
        .forEach((sphere) => {
          this.renderSphereGroup(generalSection, sphere, grouped.generalActions[sphere]);
        });
    }

    // Completed Today section (at the end)
    const completedToday = this.filterItemsByContext(this.getCompletedTodayItems());
    this.renderCompletedTodaySection(container, completedToday);
  }

  private renderCompletedTodaySection(container: HTMLElement, completedItems: FocusItem[]): void {
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

    header.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        this.settings.completedTodaySectionCollapsed =
          !this.settings.completedTodaySectionCollapsed;
        await this.saveSettings();
        await this.onOpen(); // Re-render
      }, "Failed to toggle completed focus section")
    );

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

      // Render actions from other plugins
      Object.keys(grouped.externalActions)
        .sort()
        .forEach((sourceLabel) => {
          this.renderCompletedSourceGroup(
            section,
            sourceLabel,
            grouped.externalActions[sourceLabel]
          );
        });

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
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      runAsync(this.openFile(filePath), "Failed to open focus source file");
    });

    // Add parent project context if it exists
    if (displayName.parent) {
      fileHeader.createSpan({
        text: ` (${displayName.parent})`,
        cls: "flow-gtd-focus-parent-context",
      });
    }

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      runAsync(this.renderCompletedItem(itemsList, item), "Failed to render completed focus item");
    });
  }

  private renderCompletedSourceGroup(
    container: HTMLElement,
    sourceLabel: string,
    items: ExternalFocusItem[]
  ) {
    const sourceSection = container.createDiv({ cls: "flow-gtd-focus-sphere-section" });

    sourceSection.createEl("h4", {
      text: sourceLabel,
      cls: "flow-gtd-focus-sphere-header",
    });

    const itemsList = sourceSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      runAsync(this.renderCompletedItem(itemsList, item), "Failed to render completed focus item");
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
      runAsync(this.renderCompletedItem(itemsList, item), "Failed to render completed focus item");
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
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      runAsync(this.openFile(filePath), "Failed to open focus source file");
    });

    // Add parent project context if it exists
    if (displayName.parent) {
      fileHeader.createSpan({
        text: ` (${displayName.parent})`,
        cls: "flow-gtd-focus-parent-context",
      });
    }

    const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-focus-items" });
    items.forEach((item) => {
      runAsync(this.renderItem(itemsList, item), "Failed to render focus item");
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
      runAsync(this.renderItem(itemsList, item), "Failed to render focus item");
    });
  }

  private async renderItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-focus-item" });

    const isWaitingFor = this.isWaitingFor(item);

    // Add handshake emoji for waiting-for items (outside the item box)
    if (isWaitingFor) {
      itemEl.createSpan({
        cls: "flow-gtd-focus-waiting-indicator",
        text: "🤝 ",
      });
    }

    const textSpan = itemEl.createSpan({
      cls: `flow-gtd-focus-item-text${isWaitingFor ? " is-waiting" : ""}`,
    });
    await this.renderItemText(textSpan, item);

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.markItemComplete(item);
      }, "Failed to complete focus item")
    );

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
      pinBtn.addEventListener(
        "click",
        wrapAsyncEvent(async () => {
          await this.pinItem(item);
        }, "Failed to pin focus item")
      );
    }

    // Only show "Convert to waiting for" button for non-waiting vault items
    if (isVaultFocusItem(item) && !isWaitingFor) {
      const waitingBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-focus-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener(
        "click",
        wrapAsyncEvent(async () => {
          await this.convertToWaitingFor(item);
        }, "Failed to convert focus item to waiting")
      );
    }

    if (isExternalFocusItem(item)) {
      this.renderEditButton(secondaryActions, textSpan, item);
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from focus";
    removeBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.removeFromFocus(item);
      }, "Failed to remove focus item")
    );
  }

  private async renderPinnedItem(container: HTMLElement, item: FocusItem) {
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
    itemEl.addEventListener(
      "drop",
      wrapAsyncEvent(async (e) => {
        await this.onDrop(e, item);
      }, "Failed to reorder focus item")
    );
    itemEl.addEventListener("dragend", (e) => this.onDragEnd(e));

    // Content wrapper for project name + action text
    const contentWrapper = itemEl.createDiv({ cls: "flow-gtd-focus-pinned-content" });

    // Show where the item comes from: its source, or its project (not general actions)
    if (isExternalFocusItem(item)) {
      contentWrapper.createSpan({
        cls: "flow-gtd-focus-project-name",
        text: item.external.sourceLabel,
      });
    } else if (!item.isGeneral) {
      const displayName = getProjectDisplayName(item.file, this.allProjects);
      contentWrapper.createSpan({
        cls: "flow-gtd-focus-project-name",
        text: displayName.primary,
      });
    }

    const isWaitingFor = this.isWaitingFor(item);

    // Action text row (with waiting indicator if needed)
    const actionRow = contentWrapper.createDiv({ cls: "flow-gtd-focus-pinned-action-row" });

    // Add handshake emoji for waiting-for items
    if (isWaitingFor) {
      actionRow.createSpan({
        cls: "flow-gtd-focus-waiting-indicator",
        text: "🤝 ",
      });
    }

    const textSpan = actionRow.createSpan({
      cls: `flow-gtd-focus-item-text${isWaitingFor ? " is-waiting" : ""}`,
    });
    await this.renderItemText(textSpan, item);

    const actionsSpan = itemEl.createSpan({ cls: "flow-gtd-focus-item-actions" });

    const completeBtn = actionsSpan.createEl("button", {
      cls: "flow-gtd-focus-action-btn flow-gtd-focus-action-primary",
      text: "✓",
    });
    completeBtn.title = "Mark as complete";
    completeBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.markItemComplete(item);
      }, "Failed to complete pinned focus item")
    );

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
    unpinBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.unpinItem(item);
      }, "Failed to unpin focus item")
    );

    // Only show "Convert to waiting for" button for non-waiting vault items
    if (isVaultFocusItem(item) && !isWaitingFor) {
      const waitingBtn = secondaryActions.createEl("button", {
        cls: "flow-gtd-focus-action-btn",
        text: "🕐",
      });
      waitingBtn.title = "Convert to waiting for";
      waitingBtn.addEventListener(
        "click",
        wrapAsyncEvent(async () => {
          await this.convertToWaitingFor(item);
        }, "Failed to convert pinned focus item to waiting")
      );
    }

    if (isExternalFocusItem(item)) {
      this.renderEditButton(secondaryActions, textSpan, item);
    }

    const removeBtn = secondaryActions.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "🗑️",
    });
    removeBtn.title = "Remove from focus";
    removeBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.removeFromFocus(item);
      }, "Failed to remove pinned focus item")
    );
  }

  private async renderCompletedItem(container: HTMLElement, item: FocusItem) {
    const itemEl = container.createEl("li", {
      cls: "flow-gtd-focus-item flow-gtd-focus-completed",
    });

    // Add checkmark indicator
    itemEl.createSpan({
      cls: "flow-gtd-focus-completed-indicator",
      text: "✅ ",
    });

    const textSpan = itemEl.createSpan({
      cls: "flow-gtd-focus-item-text is-completed",
    });
    await this.renderItemText(textSpan, item);

    // No action buttons for completed items
  }

  private isWaitingFor(item: FocusItem): boolean {
    return isVaultFocusItem(item) && this.getCheckboxStatusChar(item.lineContent) === "w";
  }

  private async renderItemText(textSpan: HTMLElement, item: FocusItem): Promise<void> {
    if (isVaultFocusItem(item)) {
      await MarkdownRenderer.render(this.app, item.text, textSpan, item.file, this);
      textSpan.addEventListener("click", (e) => {
        this.handleRenderedTextClick(e, item);
      });
      return;
    }

    // Wording from another plugin is shown as plain text, never rendered as markdown
    textSpan.createSpan({ cls: "flow-gtd-focus-external-id", text: item.external.externalId });
    textSpan.createSpan({ text: item.text });
    textSpan.addEventListener("click", () => {
      if (isWebUrl(item.external.url)) {
        window.open(item.external.url);
      } else {
        new Notice("This item's link isn't a web address, so it can't be opened.");
      }
    });
  }

  private renderEditButton(
    container: HTMLElement,
    textSpan: HTMLElement,
    item: ExternalFocusItem
  ): void {
    const editBtn = container.createEl("button", {
      cls: "flow-gtd-focus-action-btn",
      text: "✏️",
    });
    editBtn.title = "Edit wording";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startEditingText(textSpan, item);
    });
  }

  // Swaps the item's text for an input: Enter saves, Escape or leaving the input cancels
  private startEditingText(textSpan: HTMLElement, item: ExternalFocusItem): void {
    // Created inside the text span, then moved into its place by replaceWith below
    const input = textSpan.createEl("input", { type: "text", cls: "flow-gtd-focus-edit-input" });
    input.value = item.text;
    input.setAttribute("aria-label", "Wording");

    let finished = false;
    this.editingItem = item;
    const endEdit = () => {
      finished = true;
      this.editingItem = null;
    };
    const stopEditing = () => {
      endEdit();
      input.replaceWith(textSpan);
      if (this.refreshDeferred) {
        this.refreshDeferred = false;
        this.scheduleRefresh();
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        stopEditing();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
          input.classList.add("is-invalid");
          input.setAttribute("aria-invalid", "true");
          return;
        }
        // Saving re-renders from the latest file, which covers any deferred refresh
        endEdit();
        this.refreshDeferred = false;
        runAsync(
          this.updateItemText(item, text).catch((error) => {
            stopEditing();
            throw error;
          }),
          "Failed to edit focus item"
        );
      }
    });
    input.addEventListener("blur", () => {
      if (!finished) stopEditing();
    });

    textSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  private renderLoadingState(container: HTMLElement) {
    const loadingContainer = container.createDiv("flow-gtd-focus-loading");

    const waveIcon = loadingContainer.createDiv({ cls: "flow-gtd-loading-icon" });
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

    box.createDiv({
      text: "Current",
      cls: "flow-gtd-focus-current-projects-header",
    });

    const list = box.createDiv({ cls: "flow-gtd-focus-current-projects-list" });

    for (const project of currentProjects) {
      const projectLink = list.createEl("a", {
        text: project.title,
        cls: "flow-gtd-focus-current-project-link",
      });
      projectLink.addEventListener("click", (e) => {
        e.preventDefault();
        runAsync(this.openFile(project.file), "Failed to open current project file");
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

    const messageSpan = notificationEl.createSpan();
    messageSpan.setText("Your focus was automatically cleared. ");

    const archiveLink = messageSpan.createEl("a", {
      text: "View archived items",
      cls: "flow-gtd-focus-archive-link",
    });
    archiveLink.addEventListener("click", (e) => {
      e.preventDefault();
      runAsync(this.openFile(this.settings.focusArchiveFile), "Failed to open focus archive");
    });

    const dismissBtn = notificationEl.createEl("button", {
      text: "×",
      cls: "flow-gtd-focus-dismiss-btn",
    });
    dismissBtn.title = "Dismiss";
    dismissBtn.addEventListener(
      "click",
      wrapAsyncEvent(async () => {
        await this.dismissClearNotification();
        notificationEl.remove();
      }, "Failed to dismiss focus clear notification")
    );
  }

  private isLeafAttached(leaf: WorkspaceLeaf): boolean {
    try {
      return leaf.getRoot() === this.app.workspace.rootSplit;
    } catch {
      // If getRoot() throws, treat leaf as detached
      return false;
    }
  }

  private handleRenderedTextClick(e: MouseEvent, item: VaultFocusItem): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) {
      runAsync(this.openFile(item.file, item.lineNumber), "Failed to open rendered focus item");
      return;
    }

    // Handle clicks on internal links (wikilinks)
    const internalLink = target.closest<HTMLElement>("a.internal-link");
    if (internalLink) {
      e.preventDefault();
      const href = internalLink.getAttribute("data-href");
      if (href) {
        runAsync(
          this.app.workspace.openLinkText(href, item.file),
          "Failed to open rendered focus link"
        );
      }
      return;
    }

    // Handle clicks on tags
    const tagLink = target.closest<HTMLElement>("a.tag");
    if (tagLink) {
      e.preventDefault();
      const tag = tagLink.textContent;
      if (tag) {
        const searchPlugin = (this.app as AppWithInternalPlugins).internalPlugins?.getPluginById?.(
          "global-search"
        );
        searchPlugin?.instance?.openGlobalSearch?.(`tag:${tag}`);
      }
      return;
    }

    // Handle clicks on any other link (e.g. external URLs)
    if (target.closest("a")) {
      return;
    }

    // Default: navigate to source file
    runAsync(this.openFile(item.file, item.lineNumber), "Failed to open rendered focus item");
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
          const editor = (view as ViewWithEditor).editor;
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
    if (isExternalFocusItem(item)) {
      // External items have no vault line; completing only records the time
      if (
        await this.updateFocusItem(item, (current) => {
          current.completedAt ??= Date.now();
        })
      ) {
        await this.onOpen(); // Re-render
      }
      return;
    }

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
      const found = await this.updateFocusItem(item, (current) => {
        current.completedAt ??= Date.now();
      });

      if (!found) {
        new Notice(ITEM_GONE_MESSAGE);
        return;
      }
      (this.app.workspace as FlowWorkspaceTrigger).trigger("flow:action-completed", {
        file: item.file,
        action: item.text,
      });
      await this.onOpen(); // Re-render
    }
  }

  private async convertToWaitingFor(item: VaultFocusItem): Promise<void> {
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
      const found = await this.updateFocusItem(item, (current) => {
        if (isVaultFocusItem(current)) current.lineContent = updatedLine;
      });

      if (!found) {
        new Notice(ITEM_GONE_MESSAGE);
        return;
      }
      (this.app.workspace as FlowWorkspaceTrigger).trigger("flow:action-waiting", {
        file: item.file,
        action: item.text,
      });
      await this.onOpen(); // Re-render
    }
  }

  private async updateItemText(item: ExternalFocusItem, text: string): Promise<void> {
    await this.updateFocusItem(item, (current) => {
      current.text = text;
    });
    await this.onOpen(); // Re-render
  }

  private async removeFromFocus(item: FocusItem): Promise<void> {
    await this.updateFocus((items) => {
      const index = findFocusItemIndex(items, item);
      if (index !== -1) items.splice(index, 1);
      return items;
    });
    await this.onOpen(); // Re-render
  }

  private async pinItem(item: FocusItem): Promise<void> {
    await this.updateFocus((items) => {
      const index = findFocusItemIndex(items, item);
      if (index === -1) return items;

      // Set isPinned flag
      items[index].isPinned = true;

      // Move to end of pinned section
      const pinnedCount = items.filter((i) => i.isPinned).length;
      const [pinnedItem] = items.splice(index, 1);
      items.splice(pinnedCount - 1, 0, pinnedItem);
      return items;
    });
    await this.onOpen(); // Re-render
  }

  private async unpinItem(item: FocusItem): Promise<void> {
    // Clear isPinned flag (item stays in array, position doesn't matter for unpinned)
    await this.updateFocusItem(item, (current) => {
      current.isPinned = false;
    });
    await this.onOpen(); // Re-render
  }

  private onDragStart(e: DragEvent, item: FocusItem): void {
    this.draggedItem = item;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
    // Add dragging class to item
    const target = e.currentTarget;
    if (target instanceof HTMLElement) {
      target.addClass("dragging");
    }
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

    const draggedItem = this.draggedItem;
    await this.updateFocus((items) => {
      const draggedIndex = findFocusItemIndex(items, draggedItem);
      const targetIndex = findFocusItemIndex(items, dropTarget);
      if (draggedIndex === -1 || targetIndex === -1) return items;

      // Remove dragged item and insert at target position
      const [item] = items.splice(draggedIndex, 1);
      items.splice(targetIndex, 0, item);
      return items;
    });
    await this.onOpen(); // Re-render
  }

  private onDragEnd(e: DragEvent): void {
    this.draggedItem = null;
    // Remove dragging class
    const target = e.currentTarget;
    if (target instanceof HTMLElement) {
      target.removeClass("dragging");
    }
  }
}
