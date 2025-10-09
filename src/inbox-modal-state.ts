import { Notice } from 'obsidian';
import { FlowProject, PersonNote, PluginSettings } from './types';
import { InboxProcessingController, EditableItem } from './inbox-processing-controller';
import { InboxScanner } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';
import { getActionLabel, InputMode } from './inbox-modal-utils';

export type RenderTarget = 'mindsweep' | 'editable' | 'processing';

export type RenderCallback = (target: RenderTarget, options?: { immediate?: boolean }) => void;

export class InboxModalState {
        public mindsweepItems: string[] = [];
        public editableItems: EditableItem[] = [];
        public currentInput = '';
        public bulkInput = '';
        public inputMode: InputMode = 'single';
        public deletionOffsets = new Map<string, number>();
        public existingProjects: FlowProject[] = [];
        public existingPersons: PersonNote[] = [];

        private uniqueIdCounter = 0;

        constructor(
                private readonly controller: InboxProcessingController,
                private readonly settings: PluginSettings,
                private readonly startWithInbox: boolean,
                private readonly requestRender: RenderCallback
        ) {
                if (startWithInbox) {
                        this.inputMode = 'inbox';
                }
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

        setInputMode(mode: InputMode) {
                this.inputMode = mode;
        }

        updateCurrentInput(value: string) {
                this.currentInput = value;
        }

        updateBulkInput(value: string) {
                this.bulkInput = value;
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

        addMindsweepItem() {
                if (this.currentInput.trim().length === 0) {
                        return;
                }

                this.mindsweepItems.push(this.currentInput.trim());
                this.currentInput = '';
                this.requestRender('mindsweep');
        }

        addBulkItems() {
                if (this.bulkInput.trim().length === 0) {
                        return;
                }

                const items = this.bulkInput
                        .split('\n')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);

                if (items.length === 0) {
                        return;
                }

                this.mindsweepItems.push(...items);
                this.bulkInput = '';
                this.inputMode = 'single';
                this.requestRender('mindsweep');
        }

        async loadInboxItems() {
                try {
                        const inboxEditableItems = await this.controller.loadInboxEditableItems();

                        if (inboxEditableItems.length === 0) {
                                new Notice('No items found in inbox folders');
                                this.inputMode = 'single';
                                this.requestRender('mindsweep');
                                return;
                        }

                        this.editableItems = inboxEditableItems;
                        new Notice(`Loaded ${inboxEditableItems.length} items from inbox`);
                        this.requestRender('editable');
                } catch (error) {
                        new Notice('Error loading inbox items');
                        console.error(error);
                        this.inputMode = 'single';
                        this.requestRender('mindsweep');
                }
        }

        startProcessing() {
                if (this.mindsweepItems.length === 0) {
                        new Notice('No items to process');
                        return;
                }

                this.editableItems = this.controller.createEditableItemsFromMindsweep(this.mindsweepItems);

                new Notice(`Loaded ${this.mindsweepItems.length} items`);
                this.requestRender('editable');
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
