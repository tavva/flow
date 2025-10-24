import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { FlowProject, PluginSettings, HotlistItem } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import {
  buildProjectHierarchy,
  flattenHierarchy,
  sortHierarchy,
  ProjectNode,
} from "./project-hierarchy";
import { HOTLIST_VIEW_TYPE } from "./hotlist-view";

export const SPHERE_VIEW_TYPE = "flow-gtd-sphere-view";

interface SphereProjectSummary {
  project: FlowProject;
  priority: number | null;
  depth: number; // Hierarchy depth: 0 for root, 1+ for sub-projects
}

interface SphereViewData {
  projects: SphereProjectSummary[];
  projectsNeedingNextActions: SphereProjectSummary[];
  generalNextActions: string[];
  generalNextActionsNotice?: string;
}

export class SphereView extends ItemView {
  private readonly scanner: FlowProjectScanner;
  private readonly lineFinder: ActionLineFinder;
  private sphere: string;
  private settings: PluginSettings;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private saveSettings: () => Promise<void>;
  private searchQuery: string = "";
  private containerKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    sphere: string,
    settings: PluginSettings,
    saveSettings: () => Promise<void>
  ) {
    super(leaf);
    this.sphere = sphere;
    this.settings = settings;
    this.scanner = new FlowProjectScanner(this.app);
    this.lineFinder = new ActionLineFinder(this.app);
    this.saveSettings = saveSettings;
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
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-sphere-view");

    const loadingEl = container.createDiv({ cls: "flow-gtd-sphere-loading" });
    loadingEl.setText("Loading sphere view...");

    try {
      const data = await this.loadSphereData();
      loadingEl.remove();
      this.renderContent(container as HTMLElement, data);
    } catch (error) {
      console.error("Failed to load sphere view", error);
      loadingEl.setText("Unable to load sphere details. Check the console for more information.");
    }
  }

  async onClose() {
    // Cleanup if needed
  }

  // Save state for persistence across Obsidian reloads
  getState() {
    return {
      sphere: this.sphere,
    };
  }

  // Restore state when Obsidian reloads
  async setState(state: { sphere?: string }, result: any) {
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
    await this.onOpen();
  }

  private async loadSphereData(): Promise<SphereViewData> {
    const allProjects = await this.scanner.scanProjects();

    // Build hierarchy from ALL projects first (so parent relationships are preserved)
    const hierarchy = buildProjectHierarchy(allProjects);

    // Sort hierarchy at each level (siblings within same parent)
    const sortedHierarchy = sortHierarchy(hierarchy, (a, b) => this.compareProjectNodes(a, b));

    // Flatten the sorted hierarchy (preserves parent-child grouping)
    const flattenedHierarchy = flattenHierarchy(sortedHierarchy);

    // Then filter to only sphere projects with live status
    const projectSummaries = flattenedHierarchy
      .filter(
        (node) =>
          node.project.tags.some((tag) => this.matchesSphereTag(tag)) &&
          node.project.status === "live" &&
          !node.project.file.startsWith("Templates/") &&
          node.project.file !== this.settings.projectTemplateFilePath
      )
      .map((node) => ({
        project: node.project,
        priority: this.normalizePriority(node.project.priority),
        depth: node.depth,
      }));

    const projectsNeedingNextActions = projectSummaries.filter(
      ({ project }) => !project.nextActions || project.nextActions.length === 0
    );

    const { generalNextActions, generalNextActionsNotice } = await this.readGeneralNextActions();

    return {
      projects: projectSummaries,
      projectsNeedingNextActions,
      generalNextActions,
      generalNextActionsNotice,
    };
  }

  private filterData(data: SphereViewData, query: string): SphereViewData {
    // Empty query = no filtering
    if (!query.trim()) {
      return data;
    }

    const lowerQuery = query.toLowerCase();
    const matches = (text: string) => text.toLowerCase().includes(lowerQuery);

    // Filter projects: include if name matches OR has matching actions
    const filteredProjects = data.projects
      .map((summary) => {
        const filteredActions =
          summary.project.nextActions?.filter((action) => matches(action)) || [];

        const projectNameMatches = matches(summary.project.title);
        const includeProject = projectNameMatches || filteredActions.length > 0;

        if (!includeProject) return null;

        return {
          ...summary,
          project: {
            ...summary.project,
            nextActions: projectNameMatches
              ? summary.project.nextActions
              : filteredActions,
          },
        };
      })
      .filter((p): p is SphereProjectSummary => p !== null);

    // Filter general actions
    const filteredGeneralActions = data.generalNextActions.filter((action) =>
      matches(action)
    );

    return {
      projects: filteredProjects,
      projectsNeedingNextActions: data.projectsNeedingNextActions, // Not filtered
      generalNextActions: filteredGeneralActions,
      generalNextActionsNotice: data.generalNextActionsNotice,
    };
  }

  private renderSearchHeader(container: HTMLElement): HTMLInputElement {
    const header = container.createDiv({ cls: "flow-gtd-sphere-sticky-header" });

    // Sphere title
    const titleEl = header.createEl("h2", { cls: "flow-gtd-sphere-title" });
    titleEl.setText(this.getDisplaySphereName());

    // Search container
    const searchContainer = header.createDiv({ cls: "flow-gtd-sphere-search-container" });

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

    // Input event handler
    searchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      clearButton.style.display = this.searchQuery ? "" : "none";
      this.refresh();
    });

    // Clear button handler
    clearButton.addEventListener("click", () => {
      this.searchQuery = "";
      searchInput.value = "";
      clearButton.style.display = "none";
      searchInput.focus();
      this.refresh();
    });

    return searchInput;
  }

  private setupKeyboardShortcuts(container: HTMLElement, searchInput: HTMLInputElement): void {
    // Remove previous listener if exists
    if (this.containerKeydownHandler) {
      container.removeEventListener("keydown", this.containerKeydownHandler);
    }

    // Create and store new handler for Cmd/Ctrl+F to focus search
    this.containerKeydownHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInput.focus();
      }
    };

    container.addEventListener("keydown", this.containerKeydownHandler);

    // Escape to clear search (input handler is fine as-is - element is recreated each time)
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
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    const data = await this.loadSphereData();
    this.renderContent(container, data);
  }

  private renderContent(container: HTMLElement, data: SphereViewData) {
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
    if (this.searchQuery.trim() &&
        filteredData.projects.length === 0 &&
        filteredData.generalNextActions.length === 0) {
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

    projects.forEach(({ project, priority, depth }) => {
      const wrapper = section.createDiv({ cls: "flow-gtd-sphere-project" });

      // Apply indentation based on hierarchy depth
      if (depth > 0) {
        wrapper.style.marginLeft = `${depth * 32}px`;
        wrapper.style.width = `calc(100% - ${depth * 32}px)`;
        wrapper.addClass("flow-gtd-sphere-subproject");
      }

      const header = wrapper.createDiv({ cls: "flow-gtd-sphere-project-header" });

      const titleLink = header.createEl("a", {
        text: project.title,
        cls: "flow-gtd-sphere-project-title flow-gtd-sphere-project-link",
      });
      titleLink.style.cursor = "pointer";
      titleLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openProjectFile(project.file);
      });
      if (priority !== null) {
        header.createSpan({
          cls: "flow-gtd-sphere-project-priority",
          text: `Priority ${priority}`,
        });
      }

      if (project.nextActions && project.nextActions.length > 0) {
        const list = wrapper.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
        // Render all action items (async operations will complete in background)
        project.nextActions.forEach((action, index) => {
          void this.renderActionItem(list, action, project.file, this.sphere, false);
        });
      } else {
        this.renderEmptyMessage(wrapper, "No next actions captured yet.");
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
    const isWaitingFor = lineResult.found && lineResult.lineContent
      ? /^[-*]\s*\[w\]/i.test(lineResult.lineContent)
      : false;

    // Create the display text with clock emoji if waiting-for
    const displayText = isWaitingFor ? `🕐 ${action}` : action;

    const item = list.createEl("li", { text: displayText });
    item.style.cursor = "pointer";

    // Check if this action is in the hotlist and add CSS class if so
    const inHotlist = this.settings.hotlist.some(
      (hotlistItem) => hotlistItem.file === file && hotlistItem.text === action
    );
    if (inHotlist) {
      item.addClass("sphere-action-in-hotlist");
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

      if (this.isOnHotlist(file, finalLineResult.lineNumber!)) {
        await this.removeFromHotlist(file, finalLineResult.lineNumber!, clickedElement);
      } else {
        await this.addToHotlist(
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

  private createSection(container: HTMLElement, title: string): HTMLElement {
    const section = container.createDiv({ cls: "flow-gtd-sphere-section" });
    section.createEl("h3", { text: title, cls: "flow-gtd-sphere-section-title" });
    return section;
  }

  private renderEmptyMessage(container: HTMLElement, message: string) {
    container.createDiv({ cls: "flow-gtd-sphere-empty" }).setText(message);
  }

  private compareProjectNodes(a: ProjectNode, b: ProjectNode): number {
    const aPriority = this.normalizePriority(a.project.priority);
    const bPriority = this.normalizePriority(b.project.priority);

    if (aPriority !== null && bPriority !== null && aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (aPriority !== null && bPriority === null) {
      return -1;
    }

    if (aPriority === null && bPriority !== null) {
      return 1;
    }

    return a.project.title.localeCompare(b.project.title);
  }

  private compareProjects(a: SphereProjectSummary, b: SphereProjectSummary): number {
    if (a.priority !== null && b.priority !== null && a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    if (a.priority !== null && b.priority === null) {
      return -1;
    }

    if (a.priority === null && b.priority !== null) {
      return 1;
    }

    return a.project.title.localeCompare(b.project.title);
  }

  private normalizePriority(priority: FlowProject["priority"]): number | null {
    if (typeof priority === "number" && Number.isFinite(priority)) {
      return priority;
    }
    return null;
  }

  private matchesSphereTag(tag: string): boolean {
    const normalizedTag = tag.replace(/^#/, "").toLowerCase();
    if (!normalizedTag.startsWith("project/")) {
      return false;
    }

    const sphereTag = normalizedTag.slice("project/".length);
    return this.normalizeSphereValue(sphereTag) === this.normalizeSphereValue(this.sphere);
  }

  private normalizeSphereValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
  }

  private async readGeneralNextActions(): Promise<{
    generalNextActions: string[];
    generalNextActionsNotice?: string;
  }> {
    const path = this.settings.nextActionsFilePath?.trim();
    if (!path) {
      return {
        generalNextActions: [],
        generalNextActionsNotice: "Next actions file path is not configured in settings.",
      };
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return {
        generalNextActions: [],
        generalNextActionsNotice: `Next actions file "${path}" was not found in the vault.`,
      };
    }

    try {
      const content = await this.app.vault.read(file);
      return { generalNextActions: this.extractGeneralNextActions(content) };
    } catch (error) {
      console.error("Failed to read next actions file", error);
      return {
        generalNextActions: [],
        generalNextActionsNotice: "Unable to read next actions file.",
      };
    }
  }

  private extractGeneralNextActions(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const actions: string[] = [];
    const checkboxPattern = /^[-*]\s*\[([ xXw])\]\s*(.+)$/;
    const normalizedSphere = this.normalizeSphereValue(this.sphere);

    for (const line of lines) {
      const match = line.match(checkboxPattern);
      if (!match) {
        continue;
      }

      const checkboxStatus = match[1];
      let rawText = match[2];

      // Skip completed items ([x] or [X])
      if (checkboxStatus === "x" || checkboxStatus === "X") {
        continue;
      }

      let belongsToSphere = false;

      rawText = rawText.replace(/#sphere\/([^\s]+)/gi, (fullMatch, captured) => {
        if (this.normalizeSphereValue(String(captured)) === normalizedSphere) {
          belongsToSphere = true;
          return "";
        }
        return fullMatch;
      });

      if (!belongsToSphere) {
        continue;
      }

      const cleaned = rawText.replace(/\s{2,}/g, " ").trim();
      if (cleaned.length > 0) {
        actions.push(cleaned);
      }
    }

    return actions;
  }

  private getDisplaySphereName(): string {
    return this.sphere
      .split(/[-_\s]+/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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
      if (!leaf || leaf.getRoot() !== this.app.workspace.rootSplit) {
        leaf = this.app.workspace.getLeaf("split", "vertical");
        this.rightPaneLeaf = leaf;
      }

      await leaf.openFile(file);
    } catch (error) {
      console.error(`Failed to open project file: ${filePath}`, error);
    }
  }

  private async addToHotlist(
    text: string,
    file: string,
    lineNumber: number,
    lineContent: string,
    sphere: string,
    isGeneral: boolean,
    element?: HTMLElement
  ): Promise<void> {
    const item: HotlistItem = {
      file,
      lineNumber,
      lineContent,
      text,
      sphere,
      isGeneral,
      addedAt: Date.now(),
    };

    this.settings.hotlist.push(item);
    await this.saveSettings();
    await this.activateHotlistView();
    await this.refreshHotlistView();

    // Update styling on the specific element instead of refreshing entire view
    if (element) {
      element.classList.add("sphere-action-in-hotlist");
    }
  }

  private async removeFromHotlist(
    file: string,
    lineNumber: number,
    element?: HTMLElement
  ): Promise<void> {
    this.settings.hotlist = this.settings.hotlist.filter(
      (item) => !(item.file === file && item.lineNumber === lineNumber)
    );
    await this.saveSettings();
    await this.activateHotlistView();
    await this.refreshHotlistView();

    // Update styling on the specific element instead of refreshing entire view
    if (element) {
      element.classList.remove("sphere-action-in-hotlist");
    }
  }

  private isOnHotlist(file: string, lineNumber: number): boolean {
    return this.settings.hotlist.some(
      (item) => item.file === file && item.lineNumber === lineNumber
    );
  }

  private async activateHotlistView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(HOTLIST_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: HOTLIST_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async refreshHotlistView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(HOTLIST_VIEW_TYPE);

    if (leaves.length > 0) {
      for (const leaf of leaves) {
        if (leaf.view && "onOpen" in leaf.view) {
          await (leaf.view as any).onOpen();
        }
      }
    }
  }
}
