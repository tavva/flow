import { App, TFile } from "obsidian";
import { FileWriter } from "./file-writer";
import { GTDResponseValidationError } from "./errors";
import { EditableItem } from "./inbox-types";
import { GTDProcessingResult, PluginSettings, FocusItem } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import { validateReminderDate } from "./validation";
import { loadFocusItems, saveFocusItems } from "./focus-persistence";
import { generateCoverImage } from "./cover-image-generator";

const ACTIONS_REQUIRING_NEXT_STEP: readonly string[] = [
  "create-project",
  "add-to-project",
  "next-actions-file",
];

const ACTIONS_REQUIRING_SPHERES: readonly string[] = [
  "create-project",
  "next-actions-file",
  "someday-file",
];

export class InboxItemPersistenceService {
  constructor(
    private readonly writer: FileWriter,
    private readonly app?: App,
    private readonly settings?: PluginSettings,
    private readonly saveSettings?: () => Promise<void>
  ) {}

  async persist(item: EditableItem): Promise<void> {
    const finalNextActions = this.resolveFinalNextActions(item);
    this.validateFinalNextActions(item, finalNextActions);
    this.validateSphereSelection(item);
    const result = this.buildResultForSaving(item, finalNextActions);
    const writtenFilePath = await this.writeResult(item, finalNextActions, result);

    // Add to focus if requested and dependencies are available
    // Don't add completed items to focus (they're already done)
    const hasCompletedItems = item.markAsDone && item.markAsDone.some((done) => done === true);
    if (
      item.addToFocus &&
      !hasCompletedItems &&
      writtenFilePath &&
      this.app &&
      this.settings &&
      this.saveSettings
    ) {
      await this.addActionsToFocus(writtenFilePath, finalNextActions, item);
    }
  }

  private resolveFinalNextActions(item: EditableItem): string[] {
    let finalNextActions: string[] = [];

    if (item.editedNames && item.editedNames.length > 0) {
      finalNextActions = item.editedNames.filter(
        (action) => action != null && action.trim().length > 0
      );
    } else if (item.editedName && item.editedName.trim().length > 0) {
      finalNextActions = [item.editedName.trim()];
    }

    if (finalNextActions.length === 0) {
      finalNextActions = [item.original];
    }

    return finalNextActions;
  }

  private validateFinalNextActions(item: EditableItem, finalNextActions: string[]): void {
    if (
      ACTIONS_REQUIRING_NEXT_STEP.includes(item.selectedAction) &&
      finalNextActions.every((action) => action != null && action.trim().length === 0)
    ) {
      throw new GTDResponseValidationError("Next action cannot be empty when saving this item.");
    }
  }

  private validateSphereSelection(item: EditableItem): void {
    if (
      ACTIONS_REQUIRING_SPHERES.includes(item.selectedAction) &&
      (!item.selectedSpheres || item.selectedSpheres.length === 0)
    ) {
      throw new GTDResponseValidationError("At least one sphere must be selected for this action.");
    }

    // Validate date format for someday items
    if (item.selectedAction === "someday-file" && item.dueDate) {
      const validation = validateReminderDate(item.dueDate);
      if (!validation.valid) {
        throw new GTDResponseValidationError(
          `Invalid reminder date: ${validation.error || "Unknown error"}`
        );
      }
    }
  }

  private buildResultForSaving(
    item: EditableItem,
    finalNextActions: string[]
  ): GTDProcessingResult {
    const primaryNextAction = finalNextActions[0] || item.original;
    const resultForSaving: GTDProcessingResult = {
      isActionable: true,
      category: "next-action",
      nextAction: primaryNextAction,
      nextActions: finalNextActions,
      reasoning: item.original,
      suggestedProjects: [],
      recommendedAction: item.selectedAction,
      recommendedActionReasoning: "User selection",
      recommendedSpheres: item.selectedSpheres,
      recommendedSpheresReasoning: "",
      projectOutcome: item.editedProjectTitle,
    };

    if (item.projectPriority !== undefined) {
      resultForSaving.projectPriority = item.projectPriority;
    }

    return resultForSaving;
  }

  private async writeResult(
    item: EditableItem,
    finalNextActions: string[],
    resultForSaving: GTDProcessingResult
  ): Promise<string | null> {
    // Ensure waitingFor array is properly initialized
    const waitingFor = item.waitingFor || [];
    // Extend or trim to match finalNextActions length
    const finalWaitingFor = finalNextActions.map((_, i) => waitingFor[i] || false);

    // Ensure markAsDone array is properly initialized
    const markAsDone = item.markAsDone || [];
    // Extend or trim to match finalNextActions length
    const finalMarkAsDone = finalNextActions.map((_, i) => markAsDone[i] || false);

    switch (item.selectedAction) {
      case "create-project": {
        // Convert parent project to wikilink format if present
        const parentProjectLink = item.parentProject
          ? `[[${item.parentProject.title}]]`
          : undefined;

        const file = await this.writer.createProject(
          resultForSaving,
          item.original,
          item.selectedSpheres,
          finalWaitingFor,
          parentProjectLink,
          finalMarkAsDone,
          item.dueDate,
          item.sourceNoteLink
        );

        // Auto-create cover image if enabled (fire and forget - don't block processing)
        this.maybeGenerateCoverImage(file);

        return file.path;
      }

      case "add-to-project":
        if (item.selectedProject) {
          await this.writer.addNextActionToProject(
            item.selectedProject,
            finalNextActions,
            finalWaitingFor,
            finalMarkAsDone
          );
          return item.selectedProject.file;
        } else {
          throw new Error("No project selected");
        }

      case "next-actions-file":
        await this.writer.addToNextActionsFile(
          finalNextActions,
          item.selectedSpheres,
          finalWaitingFor,
          finalMarkAsDone,
          item.dueDate,
          item.sourceNoteLink
        );
        return this.settings?.nextActionsFilePath || null;

      case "someday-file":
        await this.writer.addToSomedayFile(
          finalNextActions,
          item.selectedSpheres,
          item.dueDate,
          item.sourceNoteLink
        );
        return null;

      case "reference":
        if (item.selectedProject) {
          const referenceContent = item.original.trim();
          if (referenceContent) {
            await this.writer.addReferenceToProject(item.selectedProject, referenceContent);
          }
        } else {
          throw new Error("No project selected for reference item");
        }
        return null;

      case "person":
        if (item.selectedPerson) {
          const discussionItem = finalNextActions.length > 0 ? finalNextActions[0] : item.original;
          await this.writer.addToPersonDiscussNext(item.selectedPerson, discussionItem);
        } else {
          throw new Error("No person selected for person item");
        }
        return null;

      case "trash":
      case "discard":
        return null;
    }
  }

  private async addActionsToFocus(
    filePath: string,
    actions: string[],
    item: EditableItem
  ): Promise<void> {
    if (!this.app || !this.settings || !this.saveSettings) {
      return;
    }

    const finder = new ActionLineFinder(this.app);
    const primarySphere = item.selectedSpheres[0];
    const isGeneral = filePath === (this.settings.nextActionsFilePath?.trim() || "Next actions.md");

    // Load current focus items
    const focusItems = await loadFocusItems(this.app.vault);

    // Add each action to the focus
    for (const action of actions) {
      const result = await finder.findActionLine(filePath, action);

      if (result.found && result.lineNumber && result.lineContent) {
        const focusItem: FocusItem = {
          file: filePath,
          lineNumber: result.lineNumber,
          lineContent: result.lineContent,
          text: action,
          sphere: primarySphere || "personal",
          isGeneral,
          addedAt: Date.now(),
        };

        focusItems.push(focusItem);
      }
    }

    // Save focus items
    await saveFocusItems(this.app.vault, focusItems);
  }

  private async maybeGenerateCoverImage(projectFile: TFile): Promise<void> {
    // Only generate if auto-create is enabled, app and settings are available
    if (!this.app || !this.settings || !this.settings.autoCreateCoverImage) {
      return;
    }

    try {
      await generateCoverImage(this.app.vault, projectFile, this.settings);
    } catch (error) {
      // Log error but don't block project creation
      console.error("Failed to generate cover image for project:", error);
    }
  }
}
