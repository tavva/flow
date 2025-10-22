import { App } from "obsidian";
import { FileWriter } from "./file-writer";
import { GTDResponseValidationError } from "./errors";
import { EditableItem } from "./inbox-types";
import { GTDProcessingResult, PluginSettings, HotlistItem } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import { validateReminderDate } from "./validation";

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

    // Add to hotlist if requested and dependencies are available
    // Don't add completed items to hotlist (they're already done)
    const hasCompletedItems = item.markAsDone && item.markAsDone.some((done) => done === true);
    if (
      item.addToHotlist &&
      !hasCompletedItems &&
      writtenFilePath &&
      this.app &&
      this.settings &&
      this.saveSettings
    ) {
      await this.addActionsToHotlist(writtenFilePath, finalNextActions, item);
    }
  }

  private resolveFinalNextActions(item: EditableItem): string[] {
    let finalNextActions: string[] = [];

    if (item.editedNames && item.editedNames.length > 0) {
      finalNextActions = item.editedNames.filter((action) => action.trim().length > 0);
    } else if (item.editedName && item.editedName.trim().length > 0) {
      finalNextActions = [item.editedName.trim()];
    } else if (item.isAIProcessed && item.result) {
      if (item.result.nextActions && item.result.nextActions.length > 0) {
        finalNextActions = item.result.nextActions.filter((action) => action.trim().length > 0);
      } else if (item.result.nextAction && item.result.nextAction.trim().length > 0) {
        finalNextActions = [item.result.nextAction.trim()];
      }
    }

    if (finalNextActions.length === 0) {
      finalNextActions = [item.original];
    }

    return finalNextActions;
  }

  private validateFinalNextActions(item: EditableItem, finalNextActions: string[]): void {
    if (
      ACTIONS_REQUIRING_NEXT_STEP.includes(item.selectedAction) &&
      finalNextActions.every((action) => action.trim().length === 0)
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

    // Validate reminder date for someday items
    if (item.selectedAction === "someday-file" && item.reminderDate) {
      const validation = validateReminderDate(item.reminderDate);
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
    const resultForSaving: GTDProcessingResult = item.result || {
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
    };

    resultForSaving.nextAction = primaryNextAction;
    resultForSaving.nextActions = finalNextActions;
    resultForSaving.projectOutcome = item.editedProjectTitle || resultForSaving.projectOutcome;
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
          finalMarkAsDone
        );
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
          finalMarkAsDone
        );
        return this.settings?.nextActionsFilePath || null;

      case "someday-file":
        await this.writer.addToSomedayFile(item.original, item.selectedSpheres, item.reminderDate);
        return null;

      case "reference":
        if (item.selectedProject) {
          const referenceContent = (item.result?.referenceContent || item.original).trim();
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

  private async addActionsToHotlist(
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

    // Add each action to the hotlist
    for (const action of actions) {
      const result = await finder.findActionLine(filePath, action);

      if (result.found && result.lineNumber && result.lineContent) {
        const hotlistItem: HotlistItem = {
          file: filePath,
          lineNumber: result.lineNumber,
          lineContent: result.lineContent,
          text: action,
          sphere: primarySphere || "personal",
          isGeneral,
          addedAt: Date.now(),
        };

        this.settings.hotlist.push(hotlistItem);
      }
    }

    await this.saveSettings();
  }
}
