import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { FlowProject, PluginSettings, FocusItem } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import {
  buildProjectHierarchy,
  flattenHierarchy,
  sortHierarchy,
  ProjectNode,
} from "./project-hierarchy";
import { FOCUS_VIEW_TYPE } from "./focus-view";
import { FileWriter } from "./file-writer";
import { loadFocusItems, saveFocusItems } from "./focus-persistence";

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
  private readonly fileWriter: FileWriter;
  private sphere: string;
  private settings: PluginSettings;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private saveSettings: () => Promise<void>;
  private searchQuery: string = "";
  private refreshInProgress: boolean = false;
  private showNextActions: boolean = true;

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
    this.fileWriter = new FileWriter(this.app, settings);
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
            nextActions: projectNameMatches ? summary.project.nextActions : filteredActions,
          },
        };
      })
      .filter((p): p is SphereProjectSummary => p !== null);

    // Filter general actions
    const filteredGeneralActions = data.generalNextActions.filter((action) => matches(action));

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
    const container = this.containerEl.children[1] as HTMLElement;
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
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    const data = await this.loadSphereData();
    this.renderContent(container, data);
  }

  private async refreshContent(): Promise<void> {
    // Prevent overlapping refresh calls
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;

    try {
      const container = this.containerEl.children[1] as HTMLElement;

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
        this.renderPriorityDropdown(header, project, priority);
      }

      if (project.nextActions && project.nextActions.length > 0) {
        const list = wrapper.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
        if (!this.showNextActions) {
          list.classList.add("flow-gtd-sphere-actions-hidden");
        }
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

    // Handle change event - save to file and refresh view
    select.addEventListener("change", async (e) => {
      const newPriority = parseInt((e.target as HTMLSelectElement).value, 10);
      try {
        await this.fileWriter.updateProjectPriority(project, newPriority);
        // Update the label text immediately for responsiveness
        label.setText(`Priority ${newPriority}`);
        // Refresh the view to reflect the change in sorting if needed
        await this.refresh();
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
}
