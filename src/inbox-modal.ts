import { App, Modal } from 'obsidian';
import { InboxProcessingController, EditableItem } from './inbox-processing-controller';
import { PluginSettings } from './types';
import { InboxModalState, RenderTarget } from './inbox-modal-state';
import { renderEditableItemsView, renderMindsweepView } from './inbox-modal-views';
import { InboxScanner } from './inbox-scanner';

export class InboxProcessingModal extends Modal {
        private readonly state: InboxModalState;
        private renderTimeout?: NodeJS.Timeout;
        private pendingTarget: RenderTarget = 'mindsweep';

        constructor(app: App, settings: PluginSettings, private readonly startWithInbox: boolean = false) {
                super(app);
                const controller = new InboxProcessingController(app, settings);
                this.state = new InboxModalState(
                        controller,
                        settings,
                        startWithInbox,
                        (target, options) => this.requestRender(target, options?.immediate === true)
                );
        }

        get inboxScanner(): Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'> {
                return this.state.inboxScanner;
        }

        set inboxScanner(scanner: Partial<Pick<InboxScanner, 'getAllInboxItems' | 'deleteInboxItem'>>) {
                this.state.inboxScanner = scanner;
        }

        get editableItems(): EditableItem[] {
                return this.state.editableItems;
        }

        set editableItems(items: EditableItem[]) {
                this.state.editableItems = items;
        }

        get mindsweepItems(): string[] {
                return this.state.mindsweepItems;
        }

        set mindsweepItems(items: string[]) {
                this.state.mindsweepItems = items;
        }

        get deletionOffsets(): Map<string, number> {
                return this.state.deletionOffsets;
        }

        async onOpen() {
                const { contentEl } = this;
                contentEl.empty();
                contentEl.addClass('flow-gtd-inbox-modal');

                await this.state.loadReferenceData();

                if (this.startWithInbox) {
                        this.state.setInputMode('inbox');
                        renderMindsweepView(contentEl, this.state);
                        await this.state.loadInboxItems();
                        return;
                }

                this.renderCurrentView('mindsweep');
        }

        onClose() {
                const { contentEl } = this;
                contentEl.empty();

                if (this.renderTimeout) {
                        clearTimeout(this.renderTimeout);
                        this.renderTimeout = undefined;
                }
        }

        private requestRender(target: RenderTarget, immediate = false) {
                if (immediate) {
                        this.renderCurrentView(target);
                        return;
                }

                this.pendingTarget = target;

                if (this.renderTimeout) {
                        clearTimeout(this.renderTimeout);
                }

                this.renderTimeout = setTimeout(() => {
                        this.renderCurrentView(this.pendingTarget);
                        this.renderTimeout = undefined;
                }, 50);
        }

        private renderCurrentView(target: RenderTarget) {
                const { contentEl } = this;
                if (!contentEl) {
                        return;
                }

                if (target === 'editable') {
                        renderEditableItemsView(contentEl, this.state, { onClose: () => this.close() });
                        return;
                }

                renderMindsweepView(contentEl, this.state);
        }

        private saveAllItems() {
                return this.state.saveAllItems();
        }

        private saveAndRemoveItem(item: EditableItem) {
                return this.state.saveAndRemoveItem(item);
        }

        private refineAllWithAI() {
                return this.state.refineAllWithAI();
        }

        private refineIndividualItem(item: EditableItem) {
                return this.state.refineIndividualItem(item);
        }

        private suggestProjectName(originalItem: string) {
                return this.state.suggestProjectName(originalItem);
        }
}
