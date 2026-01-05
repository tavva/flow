// ABOUTME: Modal for creating a new Flow project with title, next action, sphere, priority, and parent project options.
// ABOUTME: Provides the same fields as the inbox processing flow for project creation.

import { App, Modal, Setting } from "obsidian";
import { PluginSettings, FlowProject, GTDProcessingResult, FocusItem } from "./types";
import { FileWriter } from "./file-writer";
import { FlowProjectScanner } from "./flow-scanner";
import { loadFocusItems, saveFocusItems } from "./focus-persistence";
import { ActionLineFinder } from "./action-line-finder";
import { sanitizeFileName, validateNextAction } from "./validation";

interface NewProjectData {
  title: string;
  nextAction: string;
  description: string;
  spheres: string[];
  priority: number;
  isSubProject: boolean;
  parentProject: FlowProject | null;
  addToFocus: boolean;
}

export class NewProjectModal extends Modal {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private scanner: FlowProjectScanner;
  private fileWriter: FileWriter;
  private existingProjects: FlowProject[] = [];
  private data: NewProjectData;

  constructor(app: App, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(app);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.scanner = new FlowProjectScanner(app);
    this.fileWriter = new FileWriter(app, settings);
    this.data = {
      title: "",
      nextAction: "",
      description: "",
      spheres: [],
      priority: settings.defaultPriority,
      isSubProject: false,
      parentProject: null,
      addToFocus: false,
    };
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-gtd-new-project-modal");

    // Load existing projects for parent selection
    this.existingProjects = await this.scanner.scanProjects();

    this.render();

    // Focus the title input after the modal is fully rendered
    requestAnimationFrame(() => {
      const titleInput = contentEl.querySelector<HTMLInputElement>('input[type="text"]');
      titleInput?.focus();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Create New Project" });

    // Project title
    new Setting(contentEl)
      .setName("Project title")
      .setDesc("The outcome or goal of this project")
      .addText((text) =>
        text
          .setPlaceholder("Enter project title...")
          .setValue(this.data.title)
          .onChange((value) => {
            this.data.title = value;
          })
      );

    // First next action
    new Setting(contentEl)
      .setName("First next action")
      .setDesc("The immediate next physical action to move this project forward")
      .addText((text) =>
        text
          .setPlaceholder("Enter next action...")
          .setValue(this.data.nextAction)
          .onChange((value) => {
            this.data.nextAction = value;
          })
      );

    // Description (optional)
    new Setting(contentEl)
      .setName("Description")
      .setDesc("Optional context or notes about the project")
      .addTextArea((textarea) => {
        textarea
          .setPlaceholder("Enter description...")
          .setValue(this.data.description)
          .onChange((value) => {
            this.data.description = value;
          });
        textarea.inputEl.rows = 3;
      });

    // Sphere selection
    const sphereSetting = new Setting(contentEl)
      .setName("Sphere")
      .setDesc("Which area of life does this project belong to?");

    for (const sphere of this.settings.spheres) {
      sphereSetting.addToggle((toggle) => {
        toggle
          .setTooltip(sphere)
          .setValue(this.data.spheres.includes(sphere))
          .onChange((value) => {
            if (value) {
              if (!this.data.spheres.includes(sphere)) {
                this.data.spheres.push(sphere);
              }
            } else {
              this.data.spheres = this.data.spheres.filter((s) => s !== sphere);
            }
          });
        // Add label after toggle
        const labelEl = toggle.toggleEl.parentElement?.createSpan({ text: sphere });
        if (labelEl) {
          labelEl.style.marginLeft = "4px";
          labelEl.style.marginRight = "12px";
        }
      });
    }

    // Priority
    new Setting(contentEl)
      .setName("Priority")
      .setDesc("1 (highest) to 5 (lowest)")
      .addDropdown((dropdown) => {
        ["1", "2", "3", "4", "5"].forEach((value) => dropdown.addOption(value, value));
        dropdown.setValue(String(this.data.priority));
        dropdown.onChange((value) => {
          this.data.priority = parseInt(value, 10);
        });
      });

    // Sub-project toggle
    new Setting(contentEl)
      .setName("Create as sub-project")
      .setDesc("Make this a child of an existing project")
      .addToggle((toggle) =>
        toggle.setValue(this.data.isSubProject).onChange((value) => {
          this.data.isSubProject = value;
          if (!value) {
            this.data.parentProject = null;
          }
          this.render();
        })
      );

    // Parent project selector (if sub-project)
    if (this.data.isSubProject) {
      this.renderParentProjectSelector(contentEl);
    }

    // Add to focus toggle
    new Setting(contentEl)
      .setName("Add to focus")
      .setDesc("Add the first next action to your focus after creation")
      .addToggle((toggle) =>
        toggle.setValue(this.data.addToFocus).onChange((value) => {
          this.data.addToFocus = value;
        })
      );

    // Action buttons
    const buttonContainer = contentEl.createDiv({ cls: "flow-gtd-modal-buttons" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => this.close());

    const createButton = buttonContainer.createEl("button", {
      text: "Create Project",
      cls: "mod-cta",
    });
    createButton.addEventListener("click", () => this.createProject());
  }

  private renderParentProjectSelector(container: HTMLElement) {
    const selectorContainer = container.createDiv({ cls: "flow-gtd-parent-selector" });
    selectorContainer.style.marginBottom = "16px";

    const label = selectorContainer.createEl("label", { text: "Parent project" });
    label.style.display = "block";
    label.style.marginBottom = "8px";
    label.style.fontWeight = "600";

    const searchInput = selectorContainer.createEl("input", {
      type: "text",
      placeholder: "Search for parent project...",
    });
    searchInput.style.width = "100%";
    searchInput.style.padding = "8px";
    searchInput.style.marginBottom = "8px";
    searchInput.value = this.data.parentProject?.title || "";

    const listContainer = selectorContainer.createDiv();
    listContainer.style.maxHeight = "150px";
    listContainer.style.overflowY = "auto";
    listContainer.style.border = "1px solid var(--background-modifier-border)";
    listContainer.style.borderRadius = "4px";
    listContainer.style.display = "none";

    const updateList = (searchTerm: string) => {
      listContainer.empty();

      const filtered = searchTerm
        ? this.existingProjects.filter((p) =>
            p.title.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : this.existingProjects;

      if (filtered.length === 0) {
        listContainer.createEl("div", { text: "No projects found" });
        listContainer.style.padding = "8px";
        listContainer.style.display = "block";
        return;
      }

      // Sort by most recently modified
      const sorted = [...filtered].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

      sorted.forEach((project) => {
        const item = listContainer.createEl("div", { text: project.title });
        item.style.padding = "8px";
        item.style.cursor = "pointer";

        if (this.data.parentProject?.file === project.file) {
          item.style.backgroundColor = "var(--background-modifier-hover)";
          item.style.fontWeight = "600";
        }

        item.addEventListener("mouseenter", () => {
          item.style.backgroundColor = "var(--background-modifier-hover)";
        });
        item.addEventListener("mouseleave", () => {
          if (this.data.parentProject?.file !== project.file) {
            item.style.backgroundColor = "";
          }
        });
        item.addEventListener("click", () => {
          this.data.parentProject = project;
          searchInput.value = project.title;
          listContainer.style.display = "none";
        });
      });

      listContainer.style.display = "block";
    };

    searchInput.addEventListener("input", (e) => {
      updateList((e.target as HTMLInputElement).value);
    });

    searchInput.addEventListener("focus", () => {
      updateList(searchInput.value);
    });

    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        listContainer.style.display = "none";
      }, 200);
    });
  }

  private async createProject() {
    // Validate required fields
    if (!this.data.title.trim()) {
      this.showError("Project title is required");
      return;
    }

    // Validate and sanitize the project title for file system
    const sanitizedTitle = sanitizeFileName(this.data.title.trim());
    if (sanitizedTitle.length === 0) {
      this.showError(
        "Project title contains only invalid characters. Please use letters, numbers, or spaces."
      );
      return;
    }

    if (!this.data.nextAction.trim()) {
      this.showError("First next action is required");
      return;
    }

    // Validate next action quality (warnings don't block creation)
    validateNextAction(this.data.nextAction.trim());

    if (this.data.spheres.length === 0) {
      this.showError("At least one sphere must be selected");
      return;
    }

    if (this.data.isSubProject && !this.data.parentProject) {
      this.showError("Parent project must be selected for sub-projects");
      return;
    }

    try {
      // Build GTDProcessingResult for FileWriter
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: this.data.title.trim(),
        projectPriority: this.data.priority,
        nextAction: this.data.nextAction.trim(),
        reasoning: "User created project directly",
        description: this.data.description.trim(),
        recommendedAction: "create-project",
        recommendedActionReasoning: "User created project directly",
      };

      const parentProjectLink = this.data.parentProject
        ? `[[${this.data.parentProject.title}]]`
        : undefined;

      const file = await this.fileWriter.createProject(
        result,
        this.data.title.trim(),
        this.data.spheres,
        [], // waitingFor
        parentProjectLink,
        [], // markAsDone
        undefined, // dueDate
        undefined // sourceNoteLink
      );

      // Add to focus if requested
      if (this.data.addToFocus) {
        await this.addActionToFocus(file.path, this.data.nextAction.trim());
      }

      this.close();

      // Open the newly created project file
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    } catch (error) {
      console.error("Failed to create project:", error);
      this.showError(
        `Failed to create project: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async addActionToFocus(filePath: string, actionText: string) {
    const lineFinder = new ActionLineFinder(this.app);
    const lineResult = await lineFinder.findActionLine(filePath, actionText);

    if (
      !lineResult.found ||
      lineResult.lineNumber === undefined ||
      lineResult.lineContent === undefined
    ) {
      console.warn("Could not find action line for focus:", actionText);
      return;
    }

    const focusItem: FocusItem = {
      file: filePath,
      lineNumber: lineResult.lineNumber,
      lineContent: lineResult.lineContent,
      text: actionText,
      sphere: this.data.spheres[0] || "",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const focusItems = await loadFocusItems(this.app.vault);
    focusItems.push(focusItem);
    await saveFocusItems(this.app.vault, focusItems);
  }

  private showError(message: string) {
    const { contentEl } = this;
    const existingError = contentEl.querySelector(".flow-gtd-modal-error");
    if (existingError) {
      existingError.remove();
    }

    const errorEl = contentEl.createDiv({ cls: "flow-gtd-modal-error" });
    errorEl.style.color = "var(--text-error)";
    errorEl.style.marginTop = "8px";
    errorEl.style.padding = "8px";
    errorEl.style.backgroundColor = "var(--background-modifier-error)";
    errorEl.style.borderRadius = "4px";
    errorEl.setText(message);
  }
}
