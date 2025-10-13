import { App, Modal, Setting, TFile } from "obsidian";
import { PluginSettings, ProjectReviewResponse, FlowProject } from "./types";
import { FlowProjectScanner } from "./flow-scanner";
import { ProjectReviewer } from "./project-reviewer";
import { createLanguageModelClient } from "./llm-factory";

type ModalStep = "sphere-selection" | "loading" | "results";

export class ReviewModal extends Modal {
  private settings: PluginSettings;
  private scanner: FlowProjectScanner;
  private currentStep: ModalStep = "sphere-selection";
  private selectedSphere: string | null = null;
  private reviewResults: ProjectReviewResponse | null = null;
  private projects: FlowProject[] = [];

  constructor(app: App, settings: PluginSettings) {
    super(app);
    this.settings = settings;
    this.scanner = new FlowProjectScanner(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-gtd-review-modal");

    this.renderCurrentStep();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderCurrentStep() {
    const { contentEl } = this;
    contentEl.empty();

    switch (this.currentStep) {
      case "sphere-selection":
        this.renderSphereSelection();
        break;
      case "loading":
        this.renderLoading();
        break;
      case "results":
        this.renderResults();
        break;
    }
  }

  private renderSphereSelection() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Review Projects" });
    contentEl.createEl("p", {
      text: "Select which sphere to review:",
    });

    const sphereContainer = contentEl.createDiv({ cls: "sphere-selection-container" });

    for (const sphere of this.settings.spheres) {
      new Setting(sphereContainer)
        .setName(sphere.charAt(0).toUpperCase() + sphere.slice(1))
        .addButton((btn) =>
          btn
            .setButtonText("Review")
            .setCta()
            .onClick(() => this.startReview(sphere))
        );
    }

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }

  private renderLoading() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Analyzing Projects" });
    contentEl.createEl("p", {
      text: `Reviewing ${this.projects.length} project(s) in "${this.selectedSphere}" sphere...`,
    });

    const spinner = contentEl.createDiv({ cls: "flow-spinner" });
    spinner.createEl("div", { cls: "flow-spinner-dot" });
  }

  private renderResults() {
    const { contentEl } = this;

    if (!this.reviewResults) {
      contentEl.createEl("p", { text: "No review results available." });
      return;
    }

    contentEl.createEl("h2", { text: "Review Results" });

    const results = this.reviewResults;

    // Projects OK
    if (results.projectsOk.length > 0) {
      const okSection = contentEl.createDiv({ cls: "review-section" });
      const okHeader = okSection.createEl("h3", {
        text: `✓ Projects Looking Good (${results.projectsOk.length})`,
      });
      okHeader.style.color = "var(--text-success)";

      const okDetails = okSection.createEl("details");
      okDetails.createEl("summary", { text: "Show projects" });
      const okList = okDetails.createEl("ul");
      for (const projectPath of results.projectsOk) {
        const project = this.projects.find((p) => p.file === projectPath);
        if (project) {
          okList.createEl("li", { text: project.title });
        }
      }
    }

    // Improvements
    if (results.improvements.length > 0) {
      const improvementsSection = contentEl.createDiv({ cls: "review-section" });
      improvementsSection.createEl("h3", {
        text: `⚠️ Projects Needing Improvements (${results.improvements.length})`,
      });

      for (const improvement of results.improvements) {
        const project = this.projects.find((p) => p.file === improvement.projectPath);
        if (!project) continue;

        const improvementCard = improvementsSection.createDiv({ cls: "improvement-card" });

        const header = improvementCard.createDiv({ cls: "improvement-header" });
        header.createEl("strong", { text: project.title });
        header.createEl("span", { text: ` (${project.file})`, cls: "file-path" });

        improvementCard.createEl("p", { text: improvement.rationale, cls: "rationale" });

        // Name improvement
        if (improvement.suggestedName) {
          this.renderImprovement(
            improvementCard,
            "Project Name",
            improvement.currentName,
            improvement.suggestedName,
            async (newName) => {
              await this.updateProjectName(project, newName);
              improvementCard.remove();
            }
          );
        }

        // Description improvement
        if (improvement.suggestedDescription) {
          this.renderImprovement(
            improvementCard,
            "Description",
            improvement.currentDescription,
            improvement.suggestedDescription,
            async (newDescription) => {
              await this.updateProjectDescription(project, newDescription);
            }
          );
        }

        // Next action improvements
        if (improvement.nextActionImprovements && improvement.nextActionImprovements.length > 0) {
          const actionsDiv = improvementCard.createDiv({ cls: "next-actions-improvements" });
          actionsDiv.createEl("h4", { text: "Next Actions" });

          for (const actionImprovement of improvement.nextActionImprovements) {
            this.renderImprovement(
              actionsDiv,
              "",
              actionImprovement.current,
              actionImprovement.suggested,
              async (newAction) => {
                await this.updateNextAction(project, actionImprovement.current, newAction);
              }
            );
          }
        }

        new Setting(improvementCard).addButton((btn) =>
          btn.setButtonText("Skip").onClick(() => improvementCard.remove())
        );
      }
    }

    // Merges
    if (results.merges.length > 0) {
      const mergesSection = contentEl.createDiv({ cls: "review-section" });
      mergesSection.createEl("h3", {
        text: `🔀 Suggested Merges (${results.merges.length})`,
      });

      for (const merge of results.merges) {
        const primaryProject = this.projects.find((p) => p.file === merge.primaryProject);
        if (!primaryProject) continue;

        const mergeCard = mergesSection.createDiv({ cls: "merge-card" });

        mergeCard.createEl("h4", { text: `Merge into: ${primaryProject.title}` });
        mergeCard.createEl("p", { text: merge.rationale, cls: "rationale" });

        const mergeList = mergeCard.createEl("ul");
        mergeList.createEl("li", { text: `Keep: ${primaryProject.title}`, cls: "keep" });
        for (const projectPath of merge.projectsToMerge) {
          const project = this.projects.find((p) => p.file === projectPath);
          if (project) {
            mergeList.createEl("li", { text: `Merge: ${project.title}`, cls: "merge" });
          }
        }

        mergeCard.createEl("h5", { text: "Combined Next Actions:" });
        const actionsList = mergeCard.createEl("ul");
        for (const action of merge.combinedNextActions) {
          actionsList.createEl("li", { text: action });
        }

        new Setting(mergeCard)
          .addButton((btn) =>
            btn
              .setButtonText("Apply Merge")
              .setCta()
              .onClick(async () => {
                await this.applyMerge(merge);
                mergeCard.remove();
              })
          )
          .addButton((btn) => btn.setButtonText("Skip").onClick(() => mergeCard.remove()));
      }
    }

    // Status Changes
    if (results.statusChanges.length > 0) {
      const statusSection = contentEl.createDiv({ cls: "review-section" });
      statusSection.createEl("h3", {
        text: `📊 Suggested Status Changes (${results.statusChanges.length})`,
      });

      for (const change of results.statusChanges) {
        const project = this.projects.find((p) => p.file === change.projectPath);
        if (!project) continue;

        const changeCard = statusSection.createDiv({ cls: "status-change-card" });

        changeCard.createEl("h4", { text: project.title });
        changeCard.createEl("p", { text: change.rationale, cls: "rationale" });
        changeCard.createEl("p", {
          text: `Current: ${change.currentStatus} → Suggested: ${change.suggestedStatus}`,
        });

        new Setting(changeCard)
          .addButton((btn) =>
            btn
              .setButtonText("Apply Change")
              .setCta()
              .onClick(async () => {
                await this.updateProjectStatus(project, change.suggestedStatus);
                changeCard.remove();
              })
          )
          .addButton((btn) => btn.setButtonText("Skip").onClick(() => changeCard.remove()));
      }
    }

    // Summary
    if (
      results.improvements.length === 0 &&
      results.merges.length === 0 &&
      results.statusChanges.length === 0
    ) {
      contentEl.createEl("p", {
        text: "All projects look great! No improvements needed.",
        cls: "success-message",
      });
    }

    // Close button
    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Close").onClick(() => this.close())
    );
  }

  private renderImprovement(
    container: HTMLElement,
    label: string,
    current: string,
    suggested: string,
    onAccept: (edited: string) => Promise<void>
  ) {
    const improvementDiv = container.createDiv({ cls: "improvement-comparison" });

    if (label) {
      improvementDiv.createEl("h5", { text: label });
    }

    const comparisonDiv = improvementDiv.createDiv({ cls: "side-by-side" });

    const currentDiv = comparisonDiv.createDiv({ cls: "current" });
    currentDiv.createEl("strong", { text: "Current:" });
    currentDiv.createEl("p", { text: current });

    const suggestedDiv = comparisonDiv.createDiv({ cls: "suggested" });
    suggestedDiv.createEl("strong", { text: "Suggested:" });

    const textarea = suggestedDiv.createEl("textarea");
    textarea.value = suggested;
    textarea.rows = 3;

    new Setting(improvementDiv)
      .addButton((btn) =>
        btn
          .setButtonText("Accept")
          .setCta()
          .onClick(async () => {
            await onAccept(textarea.value);
            improvementDiv.remove();
          })
      )
      .addButton((btn) => btn.setButtonText("Skip").onClick(() => improvementDiv.remove()));
  }

  private async startReview(sphere: string) {
    this.selectedSphere = sphere;

    try {
      // Scan all projects
      const allProjects = await this.scanner.scanProjects();

      // Filter by sphere and live status
      this.projects = allProjects.filter((p) => {
        const isLive = !p.status || p.status.trim().toLowerCase() === "live";
        const hasSphere = p.tags.some((tag) => tag === `project/${sphere}`);
        return isLive && hasSphere;
      });

      // Now render loading screen with correct project count
      this.currentStep = "loading";
      this.renderCurrentStep();

      if (this.projects.length === 0) {
        this.currentStep = "results";
        this.reviewResults = {
          projectsOk: [],
          improvements: [],
          merges: [],
          statusChanges: [],
        };
        this.renderCurrentStep();
        return;
      }

      // Create LLM client
      const client = createLanguageModelClient(this.settings);
      const model =
        this.settings.llmProvider === "anthropic"
          ? this.settings.anthropicModel
          : this.settings.openaiModel;

      const reviewer = new ProjectReviewer(client, model);

      // Review projects
      this.reviewResults = await reviewer.reviewProjects(this.projects, sphere);

      this.currentStep = "results";
      this.renderCurrentStep();
    } catch (error) {
      console.error("Review failed:", error);
      this.contentEl.empty();
      this.contentEl.createEl("h2", { text: "Review Failed" });
      this.contentEl.createEl("p", {
        text: `Error: ${error.message}`,
        cls: "error-message",
      });

      new Setting(this.contentEl).addButton((btn) =>
        btn.setButtonText("Close").onClick(() => this.close())
      );
    }
  }

  private async updateProjectName(project: FlowProject, newName: string) {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) return;

    // Rename the file
    const newPath = project.file.replace(project.title, newName);
    await this.app.fileManager.renameFile(file, newPath);
  }

  private async updateProjectDescription(project: FlowProject, newDescription: string) {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);

    // Find the content between frontmatter and first heading
    const lines = content.split("\n");
    let newContent = "";
    let inFrontmatter = false;
    let frontmatterEnded = false;
    let descriptionReplaced = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
          newContent += line + "\n";
          continue;
        } else {
          inFrontmatter = false;
          frontmatterEnded = true;
          newContent += line + "\n";
          continue;
        }
      }

      if (inFrontmatter) {
        newContent += line + "\n";
        continue;
      }

      // After frontmatter, before first heading - this is the description area
      if (frontmatterEnded && !descriptionReplaced && line.startsWith("#")) {
        // Found the title heading, insert description before it
        newContent += "\n" + newDescription + "\n\n" + line + "\n";
        descriptionReplaced = true;
        continue;
      }

      if (frontmatterEnded && !descriptionReplaced && line.trim() !== "") {
        // Skip existing description content
        continue;
      }

      newContent += line + "\n";
    }

    await this.app.vault.modify(file, newContent.trim() + "\n");
  }

  private async updateNextAction(project: FlowProject, oldAction: string, newAction: string) {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);

    // Find and replace the specific action
    // Next actions are in "## Next actions" section as list items
    const lines = content.split("\n");
    const newLines: string[] = [];

    for (const line of lines) {
      // Check if this line contains the old action
      const itemMatch = line.match(/^([-*]\s+(?:\[[ xX]\]\s+)?)(.+)$/);
      if (itemMatch && itemMatch[2].trim() === oldAction.trim()) {
        // Replace with new action, preserving checkbox and list marker
        newLines.push(itemMatch[1] + newAction);
      } else {
        newLines.push(line);
      }
    }

    await this.app.vault.modify(file, newLines.join("\n"));
  }

  private async updateProjectStatus(project: FlowProject, newStatus: string) {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);

    // Update status in frontmatter
    const lines = content.split("\n");
    const newLines: string[] = [];
    let inFrontmatter = false;
    let statusFound = false;

    for (const line of lines) {
      if (line === "---") {
        newLines.push(line);
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          if (!statusFound) {
            // Add status before closing frontmatter
            newLines.push(`status: ${newStatus}`);
          }
          inFrontmatter = false;
        }
        continue;
      }

      if (inFrontmatter && line.startsWith("status:")) {
        newLines.push(`status: ${newStatus}`);
        statusFound = true;
        continue;
      }

      newLines.push(line);
    }

    await this.app.vault.modify(file, newLines.join("\n"));
  }

  private async applyMerge(merge: any) {
    const primaryFile = this.app.vault.getAbstractFileByPath(merge.primaryProject);
    if (!(primaryFile instanceof TFile)) return;

    // Update primary project with combined next actions
    const content = await this.app.vault.read(primaryFile);

    // Find "## Next actions" section and replace actions
    const lines = content.split("\n");
    const newLines: string[] = [];
    let inNextActions = false;
    let nextActionsLevel = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        if (title.toLowerCase() === "next actions") {
          inNextActions = true;
          nextActionsLevel = level;
          newLines.push(line);
          newLines.push("");
          // Add all combined actions
          for (const action of merge.combinedNextActions) {
            newLines.push(`- [ ] ${action}`);
          }
          continue;
        } else if (inNextActions && level <= nextActionsLevel) {
          inNextActions = false;
        }
      }

      if (!inNextActions) {
        newLines.push(line);
      }
    }

    await this.app.vault.modify(primaryFile, newLines.join("\n"));

    // Archive the merged projects
    for (const projectPath of merge.projectsToMerge) {
      const file = this.app.vault.getAbstractFileByPath(projectPath);
      if (file instanceof TFile) {
        await this.updateProjectStatus(
          this.projects.find((p) => p.file === projectPath)!,
          "archived"
        );
      }
    }
  }
}
