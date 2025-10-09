import { FileWriter } from './file-writer';
import { GTDResponseValidationError } from './errors';
import { EditableItem } from './inbox-types';
import { GTDProcessingResult } from './types';

const ACTIONS_REQUIRING_NEXT_STEP: readonly string[] = [
	'create-project',
	'add-to-project',
	'next-actions-file'
];

export class InboxItemPersistenceService {
	constructor(private readonly writer: FileWriter) {}

	async persist(item: EditableItem): Promise<void> {
		const finalNextActions = this.resolveFinalNextActions(item);
		this.validateFinalNextActions(item, finalNextActions);
		const result = this.buildResultForSaving(item, finalNextActions);
		await this.writeResult(item, finalNextActions, result);
	}

	private resolveFinalNextActions(item: EditableItem): string[] {
		let finalNextActions: string[] = [];

		if (item.editedNames && item.editedNames.length > 0) {
			finalNextActions = item.editedNames.filter(action => action.trim().length > 0);
		} else if (item.editedName && item.editedName.trim().length > 0) {
			finalNextActions = [item.editedName.trim()];
		} else if (item.isAIProcessed && item.result) {
			if (item.result.nextActions && item.result.nextActions.length > 0) {
				finalNextActions = item.result.nextActions.filter(action => action.trim().length > 0);
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
			finalNextActions.every(action => action.trim().length === 0)
		) {
			throw new GTDResponseValidationError('Next action cannot be empty when saving this item.');
		}
	}

	private buildResultForSaving(item: EditableItem, finalNextActions: string[]): GTDProcessingResult {
		const primaryNextAction = finalNextActions[0] || item.original;
		const resultForSaving: GTDProcessingResult = item.result || {
			isActionable: true,
			category: 'next-action',
			nextAction: primaryNextAction,
			nextActions: finalNextActions,
			reasoning: 'User input',
			suggestedProjects: [],
			recommendedAction: item.selectedAction,
			recommendedActionReasoning: 'User selection',
			recommendedSpheres: item.selectedSpheres,
			recommendedSpheresReasoning: ''
		};

		resultForSaving.nextAction = primaryNextAction;
		resultForSaving.nextActions = finalNextActions;
		resultForSaving.projectOutcome = item.editedProjectTitle || resultForSaving.projectOutcome;

		return resultForSaving;
	}

	private async writeResult(
		item: EditableItem,
		finalNextActions: string[],
		resultForSaving: GTDProcessingResult
	): Promise<void> {
		switch (item.selectedAction) {
			case 'create-project':
				await this.writer.createProject(resultForSaving, item.original, item.selectedSpheres);
				break;

			case 'add-to-project':
				if (item.selectedProject) {
					await this.writer.addNextActionToProject(item.selectedProject, finalNextActions);
				} else {
					throw new Error('No project selected');
				}
				break;

			case 'next-actions-file':
				await this.writer.addToNextActionsFile(finalNextActions, item.selectedSpheres);
				break;

			case 'someday-file':
				await this.writer.addToSomedayFile(item.original, item.selectedSpheres);
				break;

			case 'reference':
				if (item.selectedProject) {
					const referenceContent = (item.result?.referenceContent || item.original).trim();
					if (referenceContent) {
						await this.writer.addReferenceToProject(item.selectedProject, referenceContent);
					}
				} else {
					throw new Error('No project selected for reference item');
				}
				break;

			case 'person':
				if (item.selectedPerson) {
					const discussionItem = finalNextActions.length > 0 ? finalNextActions[0] : item.original;
					await this.writer.addToPersonDiscussNext(item.selectedPerson, discussionItem);
				} else {
					throw new Error('No person selected for person item');
				}
				break;

			case 'trash':
			case 'discard':
				break;
		}
	}
}
