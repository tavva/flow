import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownRenderer,
  Menu,
  setIcon,
  EventRef,
} from "obsidian";
import { FlowProject, PluginSettings, FocusItem } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import { FOCUS_VIEW_TYPE } from "./focus-view";
import { FileWriter } from "./file-writer";
import { loadFocusItems, saveFocusItems, FOCUS_FILE_PATH } from "./focus-persistence";
import { SphereDataLoader, SphereViewData, SphereProjectSummary } from "./sphere-data-loader";

export const SPHERE_VIEW_TYPE = "flow-gtd-sphere-view";

export class SphereView extends ItemView {
  private dataLoader: SphereDataLoader | null = null;
  private readonly lineFinder: ActionLineFinder;
  private readonly fileWriter: FileWriter;
  private sphere: string;
  private settings: PluginSettings;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private saveSettings: () => Promise<void>;
  private searchQuery: string = "";
  private refreshInProgress: boolean = false;
  private showNextActions: boolean = true;
  private metadataCacheEventRef: EventRef | null = null;
  private workspaceEventRefs: EventRef[] = [];
  private scheduledRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private suppressFocusRefresh: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    sphere: string,
    settings: PluginSettings,
    saveSettings: () => Promise<void>
  ) {
    super(leaf);
    this.sphere = sphere;
    this.settings = settings;
    this.lineFinder = new ActionLineFinder(this.app);
    this.fileWriter = new FileWriter(this.app, settings);
    this.saveSettings = saveSettings;
  }

  private getDataLoader(): SphereDataLoader {
    if (!this.dataLoader) {
      this.dataLoader = new SphereDataLoader(this.app, this.sphere, this.settings);
    }
    return this.dataLoader;
  }

  getViewType(): string {
    return SPHERE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return `${this.getDisplaySphereName()} Sphere`;
  }

  getIcon(): string {
    return "circle";
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("flow-gtd-sphere-view");

    this.renderLoadingState(container as HTMLElement);

    // Register metadata cache listener for automatic refresh when files change
    this.registerMetadataCacheListener();
    this.registerWorkspaceEvents();

    try {
      const data = await this.loadSphereData();
      this.renderContent(container as HTMLElement, data);
    } catch (error) {
      console.error("Failed to load sphere view", error);
      (container as HTMLElement).empty();
      const errorEl = container.createDiv({ cls: "flow-gtd-sphere-loading" });
      errorEl.setText("Unable to load sphere details. Check the console for more information.");
    }
  }

  private renderLoadingState(container: HTMLElement): void {
    container.empty();

    const loadingContainer = container.createDiv("flow-gtd-loading-state");
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.padding = "48px 24px";
    loadingContainer.style.display = "flex";
    loadingContainer.style.flexDirection = "column";
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

    const animatedSvg = loadingContainer.createEl("div");
    animatedSvg.style.marginTop = "16px";
    animatedSvg.appendChild(createLoadingDotsSpinner());
  }

  async onClose() {
    if (this.metadataCacheEventRef) {
      this.app.metadataCache.offref(this.metadataCacheEventRef);
      this.metadataCacheEventRef = null;
    }
    for (const ref of this.workspaceEventRefs) {
      this.app.workspace.offref(ref);
    }
    this.workspaceEventRefs = [];
    if (this.scheduledRefreshTimeout) {
      clearTimeout(this.scheduledRefreshTimeout);
      this.scheduledRefreshTimeout = null;
    }
  }

  // Save state for persistence across Obsidian reloads
  getState() {
    return {
      sphere: this.sphere,
      searchQuery: this.searchQuery,
      showNextActions: this.showNextActions,
    };
  }

  // Restore state when Obsidian reloads
  async setState(
    state: { sphere?: string; searchQuery?: string; showNextActions?: boolean },
    result: any
  ) {
    if (state?.searchQuery !== undefined) {
      this.searchQuery = state.searchQuery;
    }
    if (state?.showNextActions !== undefined) {
      this.showNextActions = state.showNextActions;
    }
    if (state?.sphere) {
      this.sphere = state.sphere;
      // Refresh the view to show the correct sphere
      await this.onOpen();
    }
    await super.setState(state, result);
  }

  // Method to update the sphere and refresh the view
  async setSphere(sphere: string, settings: PluginSettings, saveSettings: () => Promise<void>) {
    this.sphere = sphere;
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.dataLoader = new SphereDataLoader(this.app, sphere, settings);
    await this.onOpen();
  }

  private registerMetadataCacheListener(): void {
    if (this.metadataCacheEventRef) {
      this.app.metadataCache.offref(this.metadataCacheEventRef);
    }
    this.metadataCacheEventRef = this.app.metadataCache.on("changed", (file) => {
      if (file.path === FOCUS_FILE_PATH) {
        if (this.suppressFocusRefresh) {
          this.suppressFocusRefresh = false;
          return;
        }
        void this.refreshFocusHighlighting();
      } else if (this.isRelevantFile(file)) {
        this.scheduleAutoRefresh();
      }
    });
  }

  private registerWorkspaceEvents(): void {
    for (const ref of this.workspaceEventRefs) {
      this.app.workspace.offref(ref);
    }
    this.workspaceEventRefs = [];

    const completedRef = (this.app.workspace as any).on(
      "flow:action-completed",
      (detail: { file: string; action: string }) => {
        this.removeActionFromDom(detail.file, detail.action);
      }
    );
    this.workspaceEventRefs.push(completedRef);

    const waitingRef = (this.app.workspace as any).on(
      "flow:action-waiting",
      (detail: { file: string; action: string }) => {
        void this.markActionWaitingInDom(detail.file, detail.action);
      }
    );
    this.workspaceEventRefs.push(waitingRef);
  }

  private removeActionFromDom(file: string, action: string): void {
    const container = this.contentEl;
    const items = container.querySelectorAll("li[data-focus-file]");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        item.getAttribute("data-focus-file") === file &&
        item.getAttribute("data-focus-action") === action
      ) {
        item.remove();
        return;
      }
    }
  }

  private async markActionWaitingInDom(file: string, action: string): Promise<void> {
    const container = this.contentEl;
    const items = container.querySelectorAll("li[data-focus-file]");
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      if (
        item.getAttribute("data-focus-file") === file &&
        item.getAttribute("data-focus-action") === action
      ) {
        item.empty();
        await MarkdownRenderer.renderMarkdown(`🤝 ${action}`, item, "", this);
        return;
      }
    }
  }

  private async refreshFocusHighlighting(): Promise<void> {
    const focusItems = await loadFocusItems(this.app.vault);
    const container = this.contentEl;
    const items = container.querySelectorAll("li[data-focus-file]");

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      const file = item.getAttribute("data-focus-file");
      const action = item.getAttribute("data-focus-action");
      const inFocus = focusItems.some(
        (focusItem) => focusItem.file === file && focusItem.text === action
      );
      if (inFocus) {
        item.classList.add("sphere-action-in-focus");
      } else {
        item.classList.remove("sphere-action-in-focus");
      }
    }
  }

  private isRelevantFile(file: TFile): boolean {
    // Refresh when any markdown file in the vault changes that might be a project
    // We check the metadata cache for project tags
    const metadata = this.app.metadataCache.getFileCache(file);
    if (!metadata?.frontmatter?.tags) {
      return false;
    }

    const tags = Array.isArray(metadata.frontmatter.tags)
      ? metadata.frontmatter.tags
      : [metadata.frontmatter.tags];

    // Check if any tag matches this sphere
    return tags.some((tag: string) => {
      const normalizedTag = tag.replace(/^#/, "").toLowerCase();
      if (!normalizedTag.startsWith("project/")) return false;

      const sphereTag = normalizedTag.slice("project/".length);
      const normalizedSphere = this.sphere.trim().toLowerCase().replace(/\s+/g, "-");
      return sphereTag === normalizedSphere;
    });
  }

  private scheduleAutoRefresh(): void {
    if (this.scheduledRefreshTimeout) {
      clearTimeout(this.scheduledRefreshTimeout);
    }
    this.scheduledRefreshTimeout = setTimeout(() => {
      this.scheduledRefreshTimeout = null;
      void this.refresh();
    }, 500);
  }

  private async loadSphereData(): Promise<SphereViewData> {
    return this.getDataLoader().loadSphereData();
  }

  private filterData(data: SphereViewData, query: string): SphereViewData {
    return this.getDataLoader().filterData(data, query);
  }

  private renderSearchHeader(container: HTMLElement): HTMLInputElement {
    const header = container.createDiv({ cls: "flow-gtd-sphere-sticky-header" });

    // Sphere title
    const titleEl = header.createEl("h2", { cls: "flow-gtd-sphere-title" });
    titleEl.setText(this.getDisplaySphereName());

    // Search and toggle container (flex row)
    const controlsRow = header.createDiv({ cls: "flow-gtd-sphere-controls-row" });

    // Search container
    const searchContainer = controlsRow.createDiv({ cls: "flow-gtd-sphere-search-container" });

    // Search input
    const searchInput = searchContainer.createEl("input", {
      cls: "flow-gtd-sphere-search-input",
      type: "text",
      placeholder: "Filter actions and projects...",
    });
    searchInput.value = this.searchQuery;

    // Clear button
    const clearButton = searchContainer.createEl("span", {
      cls: "flow-gtd-sphere-search-clear",
      text: "✕",
    });
    clearButton.style.display = this.searchQuery ? "" : "none";

    // Toggle button
    const toggleButton = controlsRow.createEl("button", {
      cls: "flow-gtd-sphere-actions-toggle",
      text: this.showNextActions ? "Hide Actions" : "Show Actions",
    });

    // Input event handler
    searchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      clearButton.style.display = this.searchQuery ? "" : "none";
      this.refreshContent();
    });

    // Clear button handler
    clearButton.addEventListener("click", () => {
      this.searchQuery = "";
      searchInput.value = "";
      clearButton.style.display = "none";
      searchInput.focus();
      this.refresh();
    });

    // Toggle button handler
    toggleButton.addEventListener("click", () => {
      this.showNextActions = !this.showNextActions;
      toggleButton.setText(this.showNextActions ? "Hide Actions" : "Show Actions");
      this.toggleNextActionsVisibility();
    });

    return searchInput;
  }

  private toggleNextActionsVisibility(): void {
    const container = this.contentEl;
    const allActionLists = container.querySelectorAll(".flow-gtd-sphere-next-actions");

    allActionLists.forEach((list) => {
      if (this.showNextActions) {
        list.classList.remove("flow-gtd-sphere-actions-hidden");
      } else {
        list.classList.add("flow-gtd-sphere-actions-hidden");
      }
    });
  }

  private setupKeyboardShortcuts(container: HTMLElement, searchInput: HTMLInputElement): void {
    // Escape to clear search
    const handleInputKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.searchQuery = "";
        searchInput.value = "";
        const clearButton = container.querySelector(".flow-gtd-sphere-search-clear") as HTMLElement;
        if (clearButton) {
          clearButton.style.display = "none";
        }
        this.refresh();
      }
    };

    searchInput.addEventListener("keydown", handleInputKeydown);
  }

  private async refresh(): Promise<void> {
    const container = this.contentEl;
    const data = await this.loadSphereData();
    container.empty();
    this.renderContent(container, data);
  }

  private async refreshContent(): Promise<void> {
    // Prevent overlapping refresh calls
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;

    try {
      const container = this.contentEl;

      // Remove all sections except the sticky header
      const children = Array.from(container.children);
      for (const child of children) {
        if (!child.classList.contains("flow-gtd-sphere-sticky-header")) {
          child.remove();
        }
      }

      // Re-render content sections with current filter
      const data = await this.loadSphereData();
      const filteredData = this.filterData(data, this.searchQuery);

      this.renderProjectsNeedingActionsSection(container, filteredData.projectsNeedingNextActions);
      this.renderProjectsSection(container, filteredData.projects);
      this.renderGeneralNextActionsSection(
        container,
        filteredData.generalNextActions,
        filteredData.generalNextActionsNotice
      );

      // Show empty state if query exists but no results
      if (
        this.searchQuery.trim() &&
        filteredData.projects.length === 0 &&
        filteredData.generalNextActions.length === 0
      ) {
        const emptyEl = container.createDiv({ cls: "flow-gtd-sphere-empty-search" });
        emptyEl.setText(`No actions or projects match '${this.searchQuery}'`);
      }
    } finally {
      this.refreshInProgress = false;
    }
  }

  private renderContent(container: HTMLElement, data: SphereViewData) {
    container.empty();

    // Render sticky header with search
    const searchInput = this.renderSearchHeader(container);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts(container, searchInput);

    // Filter data based on search query
    const filteredData = this.filterData(data, this.searchQuery);

    // Render filtered sections
    this.renderProjectsNeedingActionsSection(container, filteredData.projectsNeedingNextActions);
    this.renderProjectsSection(container, filteredData.projects);
    this.renderGeneralNextActionsSection(
      container,
      filteredData.generalNextActions,
      filteredData.generalNextActionsNotice
    );

    // Show empty state if query exists but no results
    if (
      this.searchQuery.trim() &&
      filteredData.projects.length === 0 &&
      filteredData.generalNextActions.length === 0
    ) {
      const emptyEl = container.createDiv({ cls: "flow-gtd-sphere-empty-search" });
      emptyEl.setText(`No actions or projects match '${this.searchQuery}'`);
    }
  }

  private renderProjectsNeedingActionsSection(
    container: HTMLElement,
    projects: SphereProjectSummary[]
  ) {
    const section = this.createSection(container, "Projects needing next actions");

    if (projects.length === 0) {
      this.renderEmptyMessage(section, "All projects have next actions recorded.");
      return;
    }

    const listEl = section.createEl("ul", { cls: "flow-gtd-sphere-list" });
    projects.forEach(({ project }) => {
      const item = listEl.createEl("li", { cls: "flow-gtd-sphere-list-item" });
      const link = item.createEl("a", {
        text: project.title,
        cls: "flow-gtd-sphere-project-link",
      });
      link.style.cursor = "pointer";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.openProjectFile(project.file);
      });
    });
  }

  private renderProjectsSection(container: HTMLElement, projects: SphereProjectSummary[]) {
    const section = this.createSection(container, "Projects");

    if (projects.length === 0) {
      this.renderEmptyMessage(section, "No projects are tagged with this sphere yet.");
      return;
    }

    let lastPriority: number | null = null;

    projects.forEach(({ project, priority, depth, parentName }, index) => {
      // Insert separator when priority changes (but not before the first project)
      if (index > 0 && priority !== lastPriority) {
        const separator = section.createDiv({ cls: "flow-gtd-sphere-priority-separator" });
        const separatorLabel = separator.createSpan({
          cls: "flow-gtd-sphere-priority-separator-label",
        });

        if (priority !== null) {
          separatorLabel.setText(`P${priority}`);
        } else {
          separatorLabel.setText("No Priority");
        }
      }

      lastPriority = priority;

      const wrapper = section.createDiv({ cls: "flow-gtd-sphere-project" });

      // Apply indentation based on hierarchy depth
      if (depth > 0) {
        wrapper.style.marginLeft = `${depth * 32}px`;
        wrapper.style.width = `calc(100% - ${depth * 32}px)`;
        wrapper.addClass("flow-gtd-sphere-subproject");
      }

      // Highlight P1 projects
      if (priority === 1) {
        wrapper.addClass("flow-gtd-sphere-project-p1");
      }

      // Add cover image class if present
      if (project.coverImage) {
        wrapper.addClass("flow-gtd-sphere-project-with-cover");
      }

      // Cover image (floated to right, must come before content for proper text flow)
      if (project.coverImage) {
        const coverContainer = wrapper.createDiv({ cls: "flow-gtd-sphere-project-cover" });
        const coverImg = coverContainer.createEl("img", {
          cls: "flow-gtd-sphere-project-cover-image",
        });
        coverImg.src = this.app.vault.adapter.getResourcePath(project.coverImage);
        coverImg.alt = `Cover image for ${project.title}`;
      }

      // Content container (flows around floated cover image)
      const content = wrapper.createDiv({ cls: "flow-gtd-sphere-project-content" });

      const header = content.createDiv({ cls: "flow-gtd-sphere-project-header" });

      // Add current indicator if project is marked as current
      if (project.current) {
        header.createSpan({
          cls: "flow-gtd-sphere-project-current-indicator",
          text: "◆",
        });
      }

      const titleLink = header.createEl("a", {
        text: project.title,
        cls: "flow-gtd-sphere-project-title flow-gtd-sphere-project-link",
      });
      titleLink.style.cursor = "pointer";
      titleLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openProjectFile(project.file);
      });

      // Context menu for toggling current status
      titleLink.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const menu = new Menu();
        if (project.current) {
          menu.addItem((item) => {
            item
              .setTitle("Remove from current")
              .setIcon("x")
              .onClick(async () => {
                await this.toggleProjectCurrent(project, false);
              });
          });
        } else {
          menu.addItem((item) => {
            item
              .setTitle("Mark as current")
              .setIcon("star")
              .onClick(async () => {
                await this.toggleProjectCurrent(project, true);
              });
          });
        }
        menu.showAtMouseEvent(e);
      });

      // Show parent indicator for subprojects displayed outside parent's priority section
      if (parentName) {
        header.createSpan({
          cls: "flow-gtd-sphere-project-parent-indicator",
          text: `↳ ${parentName}`,
        });
      }

      if (priority !== null) {
        this.renderPriorityDropdown(header, project, priority);
      }

      if (project.nextActions && project.nextActions.length > 0) {
        const list = content.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
        if (!this.showNextActions) {
          list.classList.add("flow-gtd-sphere-actions-hidden");
        }
        // Render all action items (async operations will complete in background)
        project.nextActions.forEach((action, index) => {
          void this.renderActionItem(list, action, project.file, this.sphere, false);
        });
      } else {
        this.renderEmptyMessage(content, "No next actions captured yet.");
      }
    });
  }

  private renderGeneralNextActionsSection(
    container: HTMLElement,
    actions: string[],
    notice?: string
  ) {
    const section = this.createSection(container, "General next actions");

    if (notice) {
      const noticeEl = section.createDiv({ cls: "flow-gtd-sphere-notice" });
      noticeEl.setText(notice);
    }

    if (actions.length === 0) {
      this.renderEmptyMessage(section, "No general next actions tagged for this sphere.");
      return;
    }

    const list = section.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
    if (!this.showNextActions) {
      list.classList.add("flow-gtd-sphere-actions-hidden");
    }
    const nextActionsFile = this.settings.nextActionsFilePath?.trim() || "Next actions.md";

    // Render all action items (async operations will complete in background)
    actions.forEach((action, index) => {
      void this.renderActionItem(list, action, nextActionsFile, this.sphere, true);
    });
  }

  private async renderActionItem(
    list: HTMLElement,
    action: string,
    file: string,
    sphere: string,
    isGeneral: boolean
  ): Promise<void> {
    // Find the exact line for this action to check its checkbox status
    const lineResult = await this.lineFinder.findActionLine(file, action);

    // Check if this is a waiting-for item by examining the line content
    const isWaitingFor =
      lineResult.found && lineResult.lineContent
        ? /^[-*]\s*\[w\]/i.test(lineResult.lineContent)
        : false;

    // Create the display text with handshake emoji if waiting-for
    const displayText = isWaitingFor ? `🤝 ${action}` : action;

    const item = list.createEl("li");
    item.setAttribute("data-focus-file", file);
    item.setAttribute("data-focus-action", action);
    await MarkdownRenderer.renderMarkdown(displayText, item, "", this);
    item.style.cursor = "pointer";

    // Check if this action is in the focus and add CSS class if so
    const focusItems = await loadFocusItems(this.app.vault);
    const inFocus = focusItems.some(
      (focusItem) => focusItem.file === file && focusItem.text === action
    );
    if (inFocus) {
      item.addClass("sphere-action-in-focus");
    }

    item.addEventListener("click", async (e) => {
      // Capture element reference before any async operations
      const clickedElement = e.currentTarget as HTMLElement;

      // Use the line result we already have, or find it again if needed
      const finalLineResult = lineResult.found
        ? lineResult
        : await this.lineFinder.findActionLine(file, action);

      if (!finalLineResult.found) {
        console.error("Could not find line for action:", action);
        return;
      }

      if (await this.isOnFocus(file, finalLineResult.lineNumber!)) {
        await this.removeFromFocus(file, finalLineResult.lineNumber!, clickedElement);
      } else {
        await this.addToFocus(
          action,
          file,
          finalLineResult.lineNumber!,
          finalLineResult.lineContent!,
          sphere,
          isGeneral,
          clickedElement
        );
      }
    });
  }

  private renderPriorityDropdown(
    header: HTMLElement,
    project: FlowProject,
    currentPriority: number
  ): void {
    const container = header.createDiv({ cls: "flow-gtd-sphere-project-priority-container" });

    // Create the priority label (shown by default)
    const label = container.createSpan({
      cls: "flow-gtd-sphere-project-priority-label",
      text: `Priority ${currentPriority}`,
    });

    // Create the dropdown (hidden by default, shown on hover)
    const select = container.createEl("select", {
      cls: "flow-gtd-sphere-project-priority-dropdown",
    });

    // Add options 1-5
    for (let i = 1; i <= 5; i++) {
      const option = select.createEl("option", {
        value: String(i),
        text: `Priority ${i}`,
      });
      if (i === currentPriority) {
        option.selected = true;
      }
    }

    // Handle change event - save to file
    select.addEventListener("change", async (e) => {
      const newPriority = parseInt((e.target as HTMLSelectElement).value, 10);
      try {
        await this.fileWriter.updateProjectPriority(project, newPriority);
        // Update the label text immediately for responsiveness
        label.setText(`Priority ${newPriority}`);
      } catch (error) {
        console.error("Failed to update project priority", error);
      }
    });
  }

  private createSection(container: HTMLElement, title: string): HTMLElement {
    const section = container.createDiv({ cls: "flow-gtd-sphere-section" });
    section.createEl("h3", { text: title, cls: "flow-gtd-sphere-section-title" });
    return section;
  }

  private renderEmptyMessage(container: HTMLElement, message: string) {
    container.createDiv({ cls: "flow-gtd-sphere-empty" }).setText(message);
  }

  private getDisplaySphereName(): string {
    return this.sphere
      .split(/[-_\s]+/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private isLeafAttached(leaf: WorkspaceLeaf): boolean {
    try {
      return leaf.getRoot() === this.app.workspace.rootSplit;
    } catch {
      // If getRoot() throws, treat leaf as detached
      return false;
    }
  }

  private async openProjectFile(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      console.error(`Project file not found: ${filePath}`);
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
    } catch (error) {
      console.error(`Failed to open project file: ${filePath}`, error);
    }
  }

  private async addToFocus(
    text: string,
    file: string,
    lineNumber: number,
    lineContent: string,
    sphere: string,
    isGeneral: boolean,
    element?: HTMLElement
  ): Promise<void> {
    const item: FocusItem = {
      file,
      lineNumber,
      lineContent,
      text,
      sphere,
      isGeneral,
      addedAt: Date.now(),
    };

    const focusItems = await loadFocusItems(this.app.vault);
    focusItems.push(item);
    this.suppressFocusRefresh = true;
    await saveFocusItems(this.app.vault, focusItems);
    await this.activateFocusView();
    await this.refreshFocusView();

    // Update styling on the specific element instead of refreshing entire view
    if (element) {
      element.classList.add("sphere-action-in-focus");
    }
  }

  private async removeFromFocus(
    file: string,
    lineNumber: number,
    element?: HTMLElement
  ): Promise<void> {
    const focusItems = await loadFocusItems(this.app.vault);
    const updatedFocus = focusItems.filter(
      (item) => !(item.file === file && item.lineNumber === lineNumber)
    );
    this.suppressFocusRefresh = true;
    await saveFocusItems(this.app.vault, updatedFocus);
    await this.activateFocusView();
    await this.refreshFocusView();

    // Update styling on the specific element instead of refreshing entire view
    if (element) {
      element.classList.remove("sphere-action-in-focus");
    }
  }

  private async isOnFocus(file: string, lineNumber: number): Promise<boolean> {
    const focusItems = await loadFocusItems(this.app.vault);
    return focusItems.some((item) => item.file === file && item.lineNumber === lineNumber);
  }

  private async activateFocusView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(FOCUS_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: FOCUS_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async refreshFocusView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(FOCUS_VIEW_TYPE);

    if (leaves.length > 0) {
      for (const leaf of leaves) {
        if (leaf.view && "onOpen" in leaf.view) {
          await (leaf.view as any).onOpen();
        }
      }
    }
  }

  private async toggleProjectCurrent(project: FlowProject, markAsCurrent: boolean): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      console.error(`Project file not found: ${project.file}`);
      return;
    }

    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      // Find frontmatter boundaries
      let frontmatterStart = -1;
      let frontmatterEnd = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
          if (frontmatterStart === -1) {
            frontmatterStart = i;
          } else {
            frontmatterEnd = i;
            break;
          }
        }
      }

      if (frontmatterStart === -1 || frontmatterEnd === -1) {
        console.error("Could not find frontmatter boundaries");
        return;
      }

      // Find existing current field
      let currentFieldLine = -1;
      for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
        if (lines[i].match(/^current:/)) {
          currentFieldLine = i;
          break;
        }
      }

      if (markAsCurrent) {
        // Add or update current: true
        if (currentFieldLine !== -1) {
          lines[currentFieldLine] = "current: true";
        } else {
          // Insert before closing ---
          lines.splice(frontmatterEnd, 0, "current: true");
        }
      } else {
        // Remove current field entirely
        if (currentFieldLine !== -1) {
          lines.splice(currentFieldLine, 1);
        }
      }

      await this.app.vault.modify(file, lines.join("\n"));

      // Refresh the view to show updated indicator
      await this.refresh();

      // Also refresh focus view in case current projects box needs updating
      await this.refreshFocusView();
    } catch (error) {
      console.error("Failed to toggle project current status", error);
    }
  }
}

/**
 * Creates an animated "Loading..." SVG spinner with animated dots.
 */
function createLoadingDotsSpinner(): SVGElement {
  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 130 30");
  svg.setAttribute("width", "130px");
  svg.setAttribute("height", "30px");

  const text = document.createElementNS(svgNS, "text");
  text.setAttribute("font-family", "monospace");
  text.setAttribute("fill", "var(--text-accent)");
  text.setAttribute("font-size", "20");
  text.setAttribute("y", "22");

  const loadingTspan = document.createElementNS(svgNS, "tspan");
  loadingTspan.textContent = "Loading";
  text.appendChild(loadingTspan);

  // Create three animated dots
  const delays = ["0s", "0.15s", "0.3s"];
  for (const delay of delays) {
    const dotTspan = document.createElementNS(svgNS, "tspan");
    dotTspan.textContent = ".";

    const animate = document.createElementNS(svgNS, "animate");
    animate.setAttribute("attributeName", "opacity");
    animate.setAttribute("values", "0;1");
    animate.setAttribute("dur", "0.4s");
    animate.setAttribute("begin", delay);
    animate.setAttribute("repeatCount", "indefinite");

    dotTspan.appendChild(animate);
    text.appendChild(dotTspan);
  }

  svg.appendChild(text);
  return svg;
}
