import { Notice } from 'obsidian';
import { FlowProject, PersonNote, PluginSettings } from './types';
import { InboxProcessingController } from './inbox-processing-controller';
import { EditableItem } from './inbox-types';
import { InboxScanner } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';
import { getActionLabel } from './inbox-modal-utils';

export type RenderTarget = 'inbox' | 'editable';

export type RenderCallback = (target: RenderTarget, options?: { immediate?: boolean }) => void;

export class InboxModalState {
        public editableItems: EditableItem[] = [];
        public deletionOffsets = new Map<string, number>();
        public existingProjects: FlowProject[] = [];
        public existingPersons: PersonNote[] = [];

        private uniqueIdCounter = 0;

        constructor(
                private readonly controller: InboxProcessingController,
                private readonly settings: PluginSettings,
                private readonly requestRender: RenderCallback
        ) {
        }

        get inboxScanner(): Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'> {
                return this.controller.getInboxScanner();
        }

        set inboxScanner(scanner: Partial<Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'>>) {
                this.controller.setInboxScanner(scanner);
        }

        get settingsSnapshot(): PluginSettings {
                return this.settings;
        }

        getUniqueId(prefix: string): string {
                this.uniqueIdCounter += 1;
                return `${prefix}-${this.uniqueIdCounter}`;
        }

        requestImmediateRender(target: RenderTarget) {
                this.requestRender(target, { immediate: true });
        }

        queueRender(target: RenderTarget) {
                this.requestRender(target);
        }


        async loadReferenceData() {
                try {
                        this.existingProjects = await this.controller.loadExistingProjects();
                        this.existingPersons = await this.controller.loadExistingPersons();
                } catch (error) {
                        new Notice('Failed to load existing projects and persons');
                        console.error(error);
                }
        }


        async loadInboxItems() {
                try {
                        const inboxEditableItems = await this.controller.loadInboxEditableItems();

                        if (inboxEditableItems.length === 0) {
                                new Notice('No items found in inbox folders');
                                this.requestRender('inbox');
                                return;
                        }

                        this.editableItems = inboxEditableItems;
                        new Notice(`Loaded ${inboxEditableItems.length} items from inbox`);
                        this.requestRender('editable');
                } catch (error) {
                        new Notice('Error loading inbox items');
                        console.error(error);
                        this.requestRender('inbox');
                }
        }

        async refineAllWithAI() {
                const unprocessedIndexes = this.editableItems.reduce<number[]>((indexes, item, index) => {
                        if (!item.isAIProcessed) {
                                indexes.push(index);
                        }
                        return indexes;
                }, []);

                if (unprocessedIndexes.length === 0) {
                        new Notice('All items already refined with AI');
                        return;
                }

                let successCount = 0;

                const processItem = async (index: number) => {
                        const item = this.editableItems[index];
                        if (!item) {
                                return;
                        }

                        this.editableItems[index] = {
                                ...item,
                                isProcessing: true,
                                hasAIRequest: true
                        };
                        this.requestRender('editable');

                        try {
                                const updatedItem = await this.controller.refineItem(
                                        item,
                                        this.existingProjects,
                                        this.existingPersons
                                );

                                this.editableItems[index] = {
                                        ...updatedItem,
                                        hasAIRequest: true
                                };
                                successCount += 1;
                        } catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                this.editableItems[index] = {
                                        ...this.editableItems[index],
                                        isProcessing: false,
                                        hasAIRequest: false
                                };
                                new Notice(`Error processing "${item.original}": ${message}`);
                                console.error(error);
                        } finally {
                                const current = this.editableItems[index];
                                if (current) {
                                        this.editableItems[index] = {
                                                ...current,
                                                isProcessing: false
                                        };
                                }
                                this.requestRender('editable');
                        }
                };

                await Promise.all(unprocessedIndexes.map(index => processItem(index)));

                this.requestRender('editable');
                new Notice(`✅ Processed ${successCount} of ${unprocessedIndexes.length} items`);
        }

        async refineIndividualItem(item: EditableItem) {
                if (item.isProcessing || item.isAIProcessed) {
                        return;
                }

                item.hasAIRequest = true;
                item.isProcessing = true;
                this.requestRender('editable');

                try {
                        const updatedItem = await this.controller.refineItem(
                                item,
                                this.existingProjects,
                                this.existingPersons
                        );
                        const index = this.editableItems.indexOf(item);

                        if (index !== -1) {
                                this.editableItems[index] = { ...updatedItem, hasAIRequest: true };
                        }

                        new Notice(`✅ Refined: "${item.original}"`);
                } catch (error) {
                        item.isProcessing = false;
                        item.hasAIRequest = false;
                        const message = error instanceof Error ? error.message : String(error);
                        new Notice(`Error processing "${item.original}": ${message}`);
                        console.error(error);
                } finally {
                        item.isProcessing = false;
                        this.requestRender('editable');
                }
        }

        async saveAndRemoveItem(item: EditableItem) {
                try {
                        await this.controller.saveItem(item, this.deletionOffsets);
                        this.editableItems = this.editableItems.filter(current => current !== item);
                        const actionLabel = getActionLabel(item.selectedAction);
                        new Notice(`✅ Saved: ${actionLabel}`);
                        this.requestRender('editable');
                } catch (error) {
                        if (error instanceof GTDResponseValidationError) {
                                new Notice(`Cannot save: ${error.message}`);
                        } else {
                                const message = error instanceof Error ? error.message : String(error);
                                new Notice(`Error saving item: ${message}`);
                        }
                        console.error(error);
                }
        }

        async discardItem(item: EditableItem) {
                if (item.inboxItem) {
                        try {
                                await this.controller.discardInboxItem(item, this.deletionOffsets);
                        } catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                new Notice(`Error discarding item: ${message}`);
                                console.error(error);
                                return;
                        }
                }

                this.editableItems = this.editableItems.filter(current => current !== item);
                new Notice(`🗑️ Discarded item`);
                this.requestRender('editable');
        }

        async saveAllItems() {
                if (this.editableItems.length === 0) {
                        new Notice('No items to save');
                        return;
                }

                new Notice(`Saving ${this.editableItems.length} remaining items...`);
                this.deletionOffsets.clear();

                const itemsToSave = [...this.editableItems];
                for (const item of itemsToSave) {
                        await this.saveAndRemoveItem(item);
                }
        }

        async suggestProjectName(originalItem: string): Promise<string> {
                try {
                        return await this.controller.suggestProjectName(originalItem);
                } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to suggest project name: ${message}`);
                }
        }
}
