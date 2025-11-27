// ABOUTME: Leaf view displaying all someday items and paused/someday projects aggregated from across the vault.
// ABOUTME: Allows opening files and viewing content with sphere filtering.

import { ItemView, WorkspaceLeaf, TFile, EventRef } from "obsidian";
import { SomedayScanner, SomedayItem, SomedayProject, SomedayData } from "./someday-scanner";
import { PluginSettings } from "./types";

export const SOMEDAY_VIEW_TYPE = "flow-gtd-someday-view";

interface GroupedItems {
  [filePath: string]: SomedayItem[];
}

export class SomedayView extends ItemView {
  private settings: PluginSettings;
  private scanner: SomedayScanner;
  private rightPaneLeaf: WorkspaceLeaf | null = null;
  private modifyEventRef: EventRef | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private saveSettings: () => Promise<void>;
  private selectedSpheres: string[] = []; // Local state, not persisted

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.scanner = new SomedayScanner(this.app, settings);
    this.saveSettings = saveSettings;
  }

  getViewType(): string {
    return SOMEDAY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Someday";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  async onOpen() {
    // Reset filter to show all spheres
    this.selectedSpheres = [...this.settings.spheres];

    // Register event listener for metadata cache changes
    this.modifyEventRef = this.app.metadataCache.on("changed", (file) => {
      this.scheduleRefresh();
    });

    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-someday-view");

    const loadingEl = container.createDiv({ cls: "flow-gtd-someday-loading" });
    loadingEl.setText("Loading someday items...");

    // Load items asynchronously after view is visible
    setTimeout(async () => {
      try {
        const data = await this.scanner.scanSomedayData();
        loadingEl.remove();
        this.renderContent(container as HTMLElement, data);
      } catch (error) {
        console.error("Failed to load someday view", error);
        loadingEl.setText("Unable to load someday items. Check the console for more information.");
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
    const debounceTime = 15000; // 15 seconds

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
      container.empty();
      const loadingEl = container.createDiv({ cls: "flow-gtd-someday-loading" });
      loadingEl.setText("Refreshing...");

      const data = await this.scanner.scanSomedayData();

      // Clear and render
      container.empty();
      this.renderContent(container as HTMLElement, data);
    } catch (error) {
      console.error("Failed to refresh someday view", error);
      const container = this.containerEl.children[1];
      container.empty();
      const errorEl = container.createDiv({ cls: "flow-gtd-someday-loading" });
      errorEl.setText("Unable to refresh. Check the console for more information.");
    } finally {
      this.isRefreshing = false;
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

      // Capitalise first letter
      const displayText = sphere.charAt(0).toUpperCase() + sphere.slice(1);
      button.setText(displayText);

      if (isSelected) {
        button.addClass("selected");
      }

      button.addEventListener("click", async () => {
        this.toggleSphereFilter(sphere);
        // Re-render the entire view
        const data = await this.scanner.scanSomedayData();
        const viewContainer = this.containerEl.children[1];
        viewContainer.empty();
        this.renderContent(viewContainer as HTMLElement, data);
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

  private filterItemsBySphere(items: SomedayItem[]): SomedayItem[] {
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

  private filterProjectsBySphere(projects: SomedayProject[]): SomedayProject[] {
    // If all spheres selected, show all projects (including those without sphere)
    if (
      this.selectedSpheres.length === 0 ||
      this.selectedSpheres.length === this.settings.spheres.length
    ) {
      return projects;
    }

    // Filter to projects matching selected spheres
    return projects.filter((project) => {
      if (!project.sphere) {
        return false;
      }
      return this.selectedSpheres.includes(project.sphere);
    });
  }

  private renderContent(container: HTMLElement, data: SomedayData) {
    const titleEl = container.createEl("h2", { cls: "flow-gtd-someday-title" });
    titleEl.setText("Someday");

    // Render sphere filter buttons
    this.renderSphereFilter(container);

    // Apply filter
    const filteredItems = this.filterItemsBySphere(data.items);
    const filteredProjects = this.filterProjectsBySphere(data.projects);

    if (filteredProjects.length === 0 && filteredItems.length === 0) {
      this.renderEmptyMessage(container);
      return;
    }

    // Render projects section
    if (filteredProjects.length > 0) {
      this.renderProjectsSection(container, filteredProjects);
    }

    // Render items section
    if (filteredItems.length > 0) {
      const grouped = this.groupItemsByFile(filteredItems);
      this.renderItemsSection(container, grouped);
    }
  }

  private renderProjectsSection(container: HTMLElement, projects: SomedayProject[]) {
    const sectionEl = container.createDiv({ cls: "flow-gtd-someday-projects-section" });
    const headerEl = sectionEl.createEl("h3", { cls: "flow-gtd-someday-section-header" });
    headerEl.setText("Projects");

    const projectsList = sectionEl.createEl("ul", { cls: "flow-gtd-someday-projects" });

    // Sort projects by title
    const sortedProjects = projects.sort((a, b) => a.project.title.localeCompare(b.project.title));

    sortedProjects.forEach((somedayProject) => {
      this.renderProject(projectsList, somedayProject);
    });
  }

  private renderProject(container: HTMLElement, somedayProject: SomedayProject) {
    const projectEl = container.createEl("li", { cls: "flow-gtd-someday-project" });

    const titleSpan = projectEl.createSpan({ cls: "flow-gtd-someday-project-title" });
    titleSpan.setText(somedayProject.project.title);
    titleSpan.style.cursor = "pointer";
    titleSpan.addEventListener("click", () => {
      this.openFile(somedayProject.project.file);
    });

    // Show status badge
    const statusSpan = projectEl.createSpan({ cls: "flow-gtd-someday-project-status" });
    const status = somedayProject.project.status || "unknown";
    statusSpan.setText(status);

    // Show sphere badge if available
    if (somedayProject.sphere) {
      const sphereSpan = projectEl.createSpan({ cls: "flow-gtd-someday-project-sphere" });
      sphereSpan.setText(`#${somedayProject.sphere}`);
    }
  }

  private groupItemsByFile(items: SomedayItem[]): GroupedItems {
    const grouped: GroupedItems = {};

    items.forEach((item) => {
      if (!grouped[item.file]) {
        grouped[item.file] = [];
      }
      grouped[item.file].push(item);
    });

    return grouped;
  }

  private renderItemsSection(container: HTMLElement, grouped: GroupedItems) {
    const sectionEl = container.createDiv({ cls: "flow-gtd-someday-items-section" });
    const headerEl = sectionEl.createEl("h3", { cls: "flow-gtd-someday-section-header" });
    headerEl.setText("Items");

    const sortedFiles = Object.keys(grouped).sort();

    sortedFiles.forEach((filePath) => {
      const items = grouped[filePath];
      const fileSection = sectionEl.createDiv({ cls: "flow-gtd-someday-file-section" });

      const fileHeader = fileSection.createEl("h4", { cls: "flow-gtd-someday-file-header" });
      const fileLink = fileHeader.createEl("a", {
        text: items[0].fileName,
        cls: "flow-gtd-someday-file-link",
      });
      fileLink.style.cursor = "pointer";
      fileLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openFile(filePath);
      });

      const itemsList = fileSection.createEl("ul", { cls: "flow-gtd-someday-items" });

      items.forEach((item) => {
        this.renderItem(itemsList, item);
      });
    });
  }

  private renderItem(container: HTMLElement, item: SomedayItem) {
    const itemEl = container.createEl("li", { cls: "flow-gtd-someday-item" });

    const textSpan = itemEl.createSpan({ cls: "flow-gtd-someday-item-text" });
    textSpan.setText(item.text);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", () => {
      this.openFile(item.file, item.lineNumber);
    });

    // Add "Move to Next Actions" button
    const moveButton = itemEl.createEl("button", {
      cls: "flow-gtd-someday-move-button",
      text: "→ Next Actions",
    });
    moveButton.setAttribute("type", "button");
    moveButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.moveToNextActions(item);
    });
  }

  private async moveToNextActions(item: SomedayItem): Promise<void> {
    const somedayFile = this.app.vault.getAbstractFileByPath(item.file);
    if (!(somedayFile instanceof TFile)) {
      console.error(`Someday file not found: ${item.file}`);
      return;
    }

    const nextActionsPath = this.settings.nextActionsFilePath;
    const nextActionsFile = this.app.vault.getAbstractFileByPath(nextActionsPath);

    // Read the someday file and remove the line
    const somedayContent = await this.app.vault.read(somedayFile);
    const somedayLines = somedayContent.split(/\r?\n/);
    const lineIndex = item.lineNumber - 1;

    if (lineIndex < 0 || lineIndex >= somedayLines.length) {
      console.error(`Line number out of range: ${item.lineNumber}`);
      return;
    }

    // Get the original line content to preserve checkbox status, dates, etc.
    const originalLine = somedayLines[lineIndex];

    // Remove the line from someday file
    somedayLines.splice(lineIndex, 1);
    await this.app.vault.modify(somedayFile, somedayLines.join("\n"));

    // Build the new line for next actions file
    let newLine = originalLine;

    // Ensure sphere tag is present
    const hasSphereTag = /#sphere\/\w+/.test(newLine);
    if (!hasSphereTag) {
      // Use the item's sphere if available, or first selected sphere, or first configured sphere
      const sphere =
        item.sphere ||
        (this.selectedSpheres.length > 0 ? this.selectedSpheres[0] : null) ||
        (this.settings.spheres.length > 0 ? this.settings.spheres[0] : null);

      if (sphere) {
        newLine = newLine.trimEnd() + ` #sphere/${sphere}`;
      }
    }

    // Add to next actions file
    if (nextActionsFile instanceof TFile) {
      const nextActionsContent = await this.app.vault.read(nextActionsFile);
      const newContent = nextActionsContent.trim() + "\n" + newLine + "\n";
      await this.app.vault.modify(nextActionsFile, newContent);
    } else {
      // Create the file if it doesn't exist
      await this.app.vault.create(nextActionsPath, newLine + "\n");
    }

    // Refresh the view
    await this.refresh();
  }

  private renderEmptyMessage(container: HTMLElement) {
    container.createDiv({ cls: "flow-gtd-someday-empty" }).setText("No someday items found.");
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
}
