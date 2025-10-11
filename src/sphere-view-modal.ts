import { App, Modal, TFile } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { FlowProject, PluginSettings } from "./types";

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

export class SphereViewModal extends Modal {
  private readonly scanner: FlowProjectScanner;

  constructor(
    app: App,
    private readonly sphere: string,
    private readonly settings: PluginSettings
  ) {
    super(app);
    this.scanner = new FlowProjectScanner(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-gtd-sphere-modal");

    const loadingEl = contentEl.createDiv({ cls: "flow-gtd-sphere-loading" });
    loadingEl.setText("Loading sphere view...");

    try {
      const data = await this.loadSphereData();
      loadingEl.remove();
      this.renderContent(data);
    } catch (error) {
      console.error("Failed to load sphere view", error);
      loadingEl.setText("Unable to load sphere details. Check the console for more information.");
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async loadSphereData(): Promise<SphereViewData> {
    const allProjects = await this.scanner.scanProjects();
    const sphereProjects = allProjects.filter((project) =>
      project.tags.some((tag) => this.matchesSphereTag(tag))
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

  private renderContent(data: SphereViewData) {
    const { contentEl } = this;
    const titleEl = contentEl.createEl("h2", { cls: "flow-gtd-sphere-title" });
    titleEl.setText(this.getDisplaySphereName());

    this.renderProjectsNeedingActionsSection(data.projectsNeedingNextActions);
    this.renderProjectsSection(data.projects);
    this.renderGeneralNextActionsSection(data.generalNextActions, data.generalNextActionsNotice);
  }

  private renderProjectsNeedingActionsSection(projects: SphereProjectSummary[]) {
    const section = this.createSection("Projects needing next actions");

    if (projects.length === 0) {
      this.renderEmptyMessage(section, "All projects have next actions recorded.");
      return;
    }

    const listEl = section.createEl("ul", { cls: "flow-gtd-sphere-list" });
    projects.forEach(({ project }) => {
      const item = listEl.createEl("li", { cls: "flow-gtd-sphere-list-item" });
      item.setText(project.title);
    });
  }

  private renderProjectsSection(projects: SphereProjectSummary[]) {
    const section = this.createSection("Projects");

    if (projects.length === 0) {
      this.renderEmptyMessage(section, "No projects are tagged with this sphere yet.");
      return;
    }

    projects.forEach(({ project, priority }) => {
      const wrapper = section.createDiv({ cls: "flow-gtd-sphere-project" });
      const header = wrapper.createDiv({ cls: "flow-gtd-sphere-project-header" });

      header.createSpan({ cls: "flow-gtd-sphere-project-title", text: project.title });
      if (priority !== null) {
        header.createSpan({
          cls: "flow-gtd-sphere-project-priority",
          text: `Priority ${priority}`,
        });
      }

      if (project.nextActions && project.nextActions.length > 0) {
        const list = wrapper.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
        project.nextActions.forEach((action) => {
          list.createEl("li", { text: action });
        });
      } else {
        this.renderEmptyMessage(wrapper, "No next actions captured yet.");
      }
    });
  }

  private renderGeneralNextActionsSection(actions: string[], notice?: string) {
    const section = this.createSection("General next actions");

    if (notice) {
      const noticeEl = section.createDiv({ cls: "flow-gtd-sphere-notice" });
      noticeEl.setText(notice);
    }

    if (actions.length === 0) {
      this.renderEmptyMessage(section, "No general next actions tagged for this sphere.");
      return;
    }

    const list = section.createEl("ul", { cls: "flow-gtd-sphere-next-actions" });
    actions.forEach((action) => {
      list.createEl("li", { text: action });
    });
  }

  private createSection(title: string): HTMLElement {
    const section = this.contentEl.createDiv({ cls: "flow-gtd-sphere-section" });
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
}
