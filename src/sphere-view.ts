import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { FlowProject, PluginSettings, HotlistItem } from "./types";

export const SPHERE_VIEW_TYPE = "flow-gtd-sphere-view";

interface SphereProjectSummary {
  project: FlowProject;
  priority: number | null;
}

interface SphereViewData {
  projects: SphereProjectSummary[];
  projectsNeedingNextActions: SphereProjectSummary[];
  generalNextActions: string[];
  generalNextActionsNotice?: string;
}

export class SphereView extends ItemView {
  private readonly scanner: FlowProjectScanner;
  private sphere: string;
  private settings: PluginSettings;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private planningMode: boolean = false;
  private saveSettings: () => Promise<void>;

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
    this.saveSettings = saveSettings;
  }

  private togglePlanningMode() {
    this.planningMode = !this.planningMode;
    this.onOpen();
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

  // Method to update the sphere and refresh the view
  async setSphere(sphere: string, settings: PluginSettings, saveSettings: () => Promise<void>) {
    this.sphere = sphere;
    this.settings = settings;
    this.saveSettings = saveSettings;
    await this.onOpen();
  }

  private async loadSphereData(): Promise<SphereViewData> {
    const allProjects = await this.scanner.scanProjects();
    const sphereProjects = allProjects.filter(
      (project) =>
        project.tags.some((tag) => this.matchesSphereTag(tag)) && project.status === "live"
    );

    const projectSummaries = sphereProjects
      .map((project) => ({
        project,
        priority: this.normalizePriority(project.priority),
      }))
      .sort((a, b) => this.compareProjects(a, b));

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

  private renderContent(container: HTMLElement, data: SphereViewData) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-sphere-title" });
    titleEl.setText(this.getDisplaySphereName());

    // Add planning mode toggle button
    const toggleBtn = container.createEl("button", {
      cls: "flow-gtd-sphere-planning-toggle",
      text: this.planningMode ? "Exit Planning Mode" : "Planning Mode",
    });
    toggleBtn.addEventListener("click", () => {
      this.togglePlanningMode();
    });

    // Add planning mode banner if active
    if (this.planningMode) {
      const banner = container.createDiv({ cls: "flow-gtd-sphere-planning-banner" });
      banner.setText("Planning Mode - Click actions to add/remove from hotlist");
    }

    // Add planning mode background class
    if (this.planningMode) {
      container.addClass("flow-gtd-sphere-planning-active");
    }

    this.renderProjectsNeedingActionsSection(container, data.projectsNeedingNextActions);
    this.renderProjectsSection(container, data.projects);
    this.renderGeneralNextActionsSection(
      container,
      data.generalNextActions,
      data.generalNextActionsNotice
    );
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

    projects.forEach(({ project, priority }) => {
      const wrapper = section.createDiv({ cls: "flow-gtd-sphere-project" });
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
        project.nextActions.forEach((action, index) => {
          const item = list.createEl("li", { text: action });

          // In planning mode, make actions clickable
          if (this.planningMode) {
            item.style.cursor = "pointer";

            // Calculate line number (approximate - will be validated)
            const lineNumber = index + 10;

            // Show visual indicator if already on hotlist
            if (this.isOnHotlist(project.file, lineNumber)) {
              item.addClass("flow-gtd-hotlist-indicator");
            }

            item.addEventListener("click", async () => {
              if (this.isOnHotlist(project.file, lineNumber)) {
                await this.removeFromHotlist(project.file, lineNumber);
              } else {
                await this.addToHotlist(
                  action,
                  project.file,
                  lineNumber,
                  `- [ ] ${action}`,
                  this.sphere,
                  false
                );
              }
            });
          }
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

    actions.forEach((action, index) => {
      const item = list.createEl("li", { text: action });

      // In planning mode, make actions clickable
      if (this.planningMode) {
        item.style.cursor = "pointer";

        // Calculate line number (approximate - will be validated)
        const lineNumber = index + 5;

        // Show visual indicator if already on hotlist
        if (this.isOnHotlist(nextActionsFile, lineNumber)) {
          item.addClass("flow-gtd-hotlist-indicator");
        }

        item.addEventListener("click", async () => {
          if (this.isOnHotlist(nextActionsFile, lineNumber)) {
            await this.removeFromHotlist(nextActionsFile, lineNumber);
          } else {
            await this.addToHotlist(
              action,
              nextActionsFile,
              lineNumber,
              `- [ ] ${action} #sphere/${this.sphere}`,
              this.sphere,
              true
            );
          }
        });
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
    const checkboxPattern = /^[-*]\s*\[(?: |x|X)\]\s*(.+)$/;
    const normalizedSphere = this.normalizeSphereValue(this.sphere);

    for (const line of lines) {
      const match = line.match(checkboxPattern);
      if (!match) {
        continue;
      }

      let rawText = match[1];
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
      // Reuse the right pane if it exists, otherwise create a new split
      if (!this.rightPaneLeaf) {
        this.rightPaneLeaf = this.app.workspace.getLeaf("split", "vertical");
      }
      await this.rightPaneLeaf.openFile(file);
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
    isGeneral: boolean
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
    await this.onOpen();
  }

  private async removeFromHotlist(file: string, lineNumber: number): Promise<void> {
    this.settings.hotlist = this.settings.hotlist.filter(
      (item) => !(item.file === file && item.lineNumber === lineNumber)
    );
    await this.saveSettings();
    await this.onOpen();
  }

  private isOnHotlist(file: string, lineNumber: number): boolean {
    return this.settings.hotlist.some((item) => item.file === file && item.lineNumber === lineNumber);
  }
}
