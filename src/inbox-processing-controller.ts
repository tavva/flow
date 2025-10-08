import { App } from 'obsidian';
import { GTDProcessor } from './gtd-processor';
import { FlowProjectScanner } from './flow-scanner';
import { FileWriter } from './file-writer';
import { FlowProject, GTDProcessingResult, PluginSettings, ProcessingAction } from './types';
import { InboxItem, InboxScanner } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';

export interface EditableItem {
        original: string;
        inboxItem?: InboxItem;
        isAIProcessed: boolean;
        result?: GTDProcessingResult;
        selectedProject?: FlowProject;
        selectedAction: ProcessingAction;
        selectedSpheres: string[];
        editedName?: string;
        editedNames?: string[]; // Support multiple edited next actions
        editedProjectTitle?: string;
        isProcessing?: boolean;
        hasAIRequest?: boolean;
}

export interface ProcessingOutcome {
        item: EditableItem;
        updatedItem?: EditableItem;
        error?: Error;
}

interface ControllerDependencies {
        processor?: GTDProcessor;
        scanner?: FlowProjectScanner;
        writer?: FileWriter;
        inboxScanner?: Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'>;
}

export class InboxProcessingController {
        private processor: GTDProcessor;
        private scanner: FlowProjectScanner;
        private writer: FileWriter;
        private inboxScanner: InboxScanner;

        constructor(app: App, settings: PluginSettings, dependencies: ControllerDependencies = {}) {
                this.processor =
                        dependencies.processor ??
                        new GTDProcessor(
                                settings.anthropicApiKey,
                                settings.spheres,
                                settings.anthropicModel
                        );
                this.scanner = dependencies.scanner ?? new FlowProjectScanner(app);
                this.writer = dependencies.writer ?? new FileWriter(app, settings);
                this.inboxScanner = (dependencies.inboxScanner
                        ? Object.assign(new InboxScanner(app, settings), dependencies.inboxScanner)
                        : new InboxScanner(app, settings)) as InboxScanner;
        }

        async loadExistingProjects(): Promise<FlowProject[]> {
                return this.scanner.scanProjects();
        }

        async loadInboxEditableItems(): Promise<EditableItem[]> {
                const inboxItems = await this.inboxScanner.getAllInboxItems();
                return this.createEditableItemsFromInbox(inboxItems);
        }

        setInboxScanner(
                scanner: Partial<Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'>>
        ) {
                this.inboxScanner = Object.assign(this.inboxScanner, scanner);
        }

        getInboxScanner(): Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'> {
                return this.inboxScanner;
        }

        createEditableItemsFromInbox(inboxItems: InboxItem[]): EditableItem[] {
                return inboxItems.map(item => ({
                        original: item.content,
                        inboxItem: item,
                        isAIProcessed: false,
                        hasAIRequest: false,
                        selectedAction: 'next-actions-file',
                        selectedSpheres: []
                }));
        }

        createEditableItemsFromMindsweep(items: string[]): EditableItem[] {
                return items.map(item => ({
                        original: item,
                        isAIProcessed: false,
                        hasAIRequest: false,
                        selectedAction: 'next-actions-file',
                        selectedSpheres: []
                }));
        }

        async refineItem(item: EditableItem, existingProjects: FlowProject[]): Promise<EditableItem> {
                const result = await this.processor.processInboxItem(item.original, existingProjects);

                // Initialize editedNames with AI-recommended next actions if multiple were provided
                const editedNames = result.nextActions && result.nextActions.length > 1
                        ? [...result.nextActions]
                        : undefined;

                return {
                        ...item,
                        result,
                        isAIProcessed: true,
                        isProcessing: false,
                        selectedProject: result.suggestedProjects && result.suggestedProjects.length > 0
                                ? result.suggestedProjects[0].project
                                : undefined,
                        selectedAction: result.recommendedAction,
                        selectedSpheres: result.recommendedSpheres || [],
                        editedNames
                };
        }

        async refineItems(items: EditableItem[], existingProjects: FlowProject[]): Promise<ProcessingOutcome[]> {
                const promises = items.map(async item => {
                        try {
                                const updatedItem = await this.refineItem(item, existingProjects);
                                return { item, updatedItem } as ProcessingOutcome;
                        } catch (error) {
                                return { item, error: error instanceof Error ? error : new Error(String(error)) };
                        }
                });

                const outcomes = await Promise.all(promises);
                console.log(`Completed processing ${items.length} items.`);
                return outcomes;
        }

        async saveItem(item: EditableItem, deletionOffsets: Map<string, number>): Promise<void> {
                // Determine final next actions - prioritize edited names, then AI results, then original
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

                // Fallback to original item if nothing else available
                if (finalNextActions.length === 0) {
                        finalNextActions = [item.original];
                }

                if (
                        ['create-project', 'add-to-project', 'next-actions-file'].includes(item.selectedAction) &&
                        finalNextActions.every(action => action.trim().length === 0)
                ) {
                        throw new GTDResponseValidationError('Next action cannot be empty when saving this item.');
                }

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

                switch (item.selectedAction) {
                        case 'create-project':
                                await this.writer.createProject(resultForSaving, item.original, item.selectedSpheres);
                                break;

                        case 'add-to-project':
                                if (item.selectedProject) {
                                        await this.writer.addNextActionToProject(
                                                item.selectedProject,
                                                finalNextActions
                                        );
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
                        case 'trash':
                                break;
                }

                if (item.inboxItem) {
                        let inboxItemToDelete = item.inboxItem;

                        if (item.inboxItem.type === 'line' && item.inboxItem.sourceFile?.path) {
                                const filePath = item.inboxItem.sourceFile.path;
                                const priorDeletions = deletionOffsets.get(filePath) ?? 0;
                                const originalLineNumber = item.inboxItem.lineNumber ?? 0;
                                const adjustedLineNumber = Math.max(1, originalLineNumber - priorDeletions);

                                inboxItemToDelete = {
                                        ...item.inboxItem,
                                        lineNumber: adjustedLineNumber
                                };
                        }

                        await this.inboxScanner.deleteInboxItem(inboxItemToDelete);

                        if (item.inboxItem.type === 'line' && item.inboxItem.sourceFile?.path) {
                                const filePath = item.inboxItem.sourceFile.path;
                                const priorDeletions = deletionOffsets.get(filePath) ?? 0;
                                deletionOffsets.set(filePath, priorDeletions + 1);
                        }
                }
        }

        async suggestProjectName(originalItem: string): Promise<string> {
                const prompt = `Given this inbox item: "${originalItem}"

The user wants to create a project for this. Suggest a clear, concise project title that:
- States the desired outcome (not just the topic)
- Is specific and measurable
- Defines what "done" looks like
- Uses past tense or completion-oriented language when appropriate

Examples:
- Good: "Website redesign complete and deployed"
- Bad: "Website project"
- Good: "Kitchen renovation finished"
- Bad: "Kitchen stuff"

Respond with ONLY the project title, nothing else.`;

                const response = await this.processor.callAI(prompt);
                return response.trim();
        }
}
