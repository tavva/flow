import { DropdownComponent, Setting } from 'obsidian';
import { InboxModalState } from './inbox-modal-state';
import { EditableItem } from './inbox-types';
import { getActionLabel } from './inbox-modal-utils';

export interface EditableItemsViewOptions {
        onClose: () => void;
}

export function renderMindsweepView(contentEl: HTMLElement, state: InboxModalState) {
        contentEl.empty();
        contentEl.addClass('flow-gtd-inbox-modal');

        contentEl.createEl('h2', { text: '📥 Inbox Processing' });
        contentEl.createEl('p', {
                text: "Capture everything on your mind. Don't filter or organise yet—just capture!",
                cls: 'flow-gtd-description'
        });

        const modeContainer = contentEl.createDiv('flow-gtd-mode-toggle');
        const modeSetting = new Setting(modeContainer);
        modeSetting.addButton(button => {
                button.setButtonText('Single Item')
                        .onClick(() => {
                                state.setInputMode('single');
                                state.queueRender('mindsweep');
                        });
                if (state.inputMode === 'single') button.setCta();
                return button;
        });
        modeSetting.addButton(button => {
                button.setButtonText('Bulk Input')
                        .onClick(() => {
                                state.setInputMode('bulk');
                                state.queueRender('mindsweep');
                        });
                if (state.inputMode === 'bulk') button.setCta();
                return button;
        });
        modeSetting.addButton(button => {
                button.setButtonText('From Inbox')
                        .onClick(() => {
                                state.setInputMode('inbox');
                                state.queueRender('mindsweep');
                                void state.loadInboxItems();
                        });
                if (state.inputMode === 'inbox') button.setCta();
                return button;
        });

        if (state.inputMode === 'bulk') {
                const bulkContainer = contentEl.createDiv('flow-gtd-bulk-input');
                const textarea = bulkContainer.createEl('textarea', {
                        placeholder: 'Paste your list here, one item per line:\n\nCall dentist\nPlan vacation\nFix kitchen sink\nReview quarterly report\nBuy groceries',
                        cls: 'flow-gtd-textarea'
                });
                textarea.value = state.bulkInput;
                textarea.rows = 10;
                textarea.addEventListener('input', (e) => {
                        state.updateBulkInput((e.target as HTMLTextAreaElement).value);
                });

                new Setting(bulkContainer)
                        .addButton(button => button
                                .setButtonText('Add All Items')
                                .setCta()
                                .onClick(() => state.addBulkItems()));
        } else if (state.inputMode === 'inbox') {
                const inboxContainer = contentEl.createDiv('flow-gtd-inbox-info');
                inboxContainer.createEl('p', {
                        text: 'Loading items from your Flow inbox folders...',
                        cls: 'flow-gtd-description'
                });
        } else {
                const inputContainer = contentEl.createDiv('flow-gtd-single-input');
                new Setting(inputContainer)
                        .addText(text => {
                                text
                                        .setPlaceholder("What's on your mind? (e.g., \"call dentist\", \"plan vacation\")")
                                        .setValue(state.currentInput)
                                        .onChange(value => state.updateCurrentInput(value));
                                text.inputEl.addEventListener('keypress', (e) => {
                                        if (e.key === 'Enter') {
                                                state.addMindsweepItem();
                                        }
                                });
                        })
                        .addButton(button => button
                                .setButtonText('Add')
                                .setCta()
                                .onClick(() => state.addMindsweepItem()));
        }

        if (state.mindsweepItems.length > 0) {
                const listContainer = contentEl.createDiv('flow-gtd-items-list');
                listContainer.createEl('h3', { text: `Captured Items (${state.mindsweepItems.length})` });

                state.mindsweepItems.forEach((item, index) => {
                        const itemEl = listContainer.createDiv('flow-gtd-item');
                        itemEl.createSpan({ text: item, cls: 'flow-gtd-item-text' });

                        const deleteBtn = itemEl.createEl('button', {
                                text: '×',
                                cls: 'flow-gtd-delete-btn'
                        });
                        deleteBtn.addEventListener('click', () => {
                                state.mindsweepItems.splice(index, 1);
                                state.queueRender('mindsweep');
                        });
                });

                new Setting(contentEl)
                        .addButton(button => button
                                .setButtonText('Start Processing →')
                                .setCta()
                                .onClick(() => state.startProcessing()));
        } else {
                contentEl.createDiv('flow-gtd-empty-state').createEl('p', {
                        text: '🧠 Start your mindsweep by adding items above',
                        cls: 'flow-gtd-empty'
                });
        }
}

export function renderEditableItemsView(
        contentEl: HTMLElement,
        state: InboxModalState,
        { onClose }: EditableItemsViewOptions
) {
        contentEl.empty();
        contentEl.addClass('flow-gtd-inbox-modal');

        contentEl.createEl('h2', { text: '📝 Edit and Save Items' });
        contentEl.createEl('p', {
                text: 'Review your inbox items. You can edit them manually or refine with AI, then save them to your vault.',
                cls: 'flow-gtd-description'
        });

        if (state.editableItems.length > 0) {
                const batchContainer = contentEl.createDiv('flow-gtd-batch-actions');
                const totalCount = state.editableItems.length;
                const completedCount = state.editableItems.filter(item => item.isAIProcessed).length;
                const inFlightCount = state.editableItems.filter(item => item.isProcessing && !item.isAIProcessed).length;
                const pendingCount = Math.max(totalCount - completedCount - inFlightCount, 0);

                const progressContainer = batchContainer.createDiv('flow-gtd-progress');
                const progressText = progressContainer.createDiv('flow-gtd-progress-text');
                progressText.setText(
                        `AI refinement: ${completedCount} complete · ${inFlightCount} in flight · ${pendingCount} yet to send`
                );

                const progressBar = progressContainer.createDiv('flow-gtd-progress-bar');
                const segments: Array<{ width: number; cls: string; label: string }> = [
                        { width: completedCount / totalCount, cls: 'flow-gtd-progress-segment-complete', label: `${completedCount} complete` },
                        { width: inFlightCount / totalCount, cls: 'flow-gtd-progress-segment-in-flight', label: `${inFlightCount} in flight` },
                        { width: pendingCount / totalCount, cls: 'flow-gtd-progress-segment-pending', label: `${pendingCount} yet to send` }
                ];

                segments
                        .filter(segment => segment.width > 0)
                        .forEach(segment => {
                                const segmentEl = progressBar.createDiv({ cls: `flow-gtd-progress-segment ${segment.cls}` });
                                segmentEl.style.width = `${(segment.width * 100).toFixed(2)}%`;
                                segmentEl.setAttr('aria-label', segment.label);
                        });

                const legend = progressContainer.createDiv('flow-gtd-progress-legend');
                [
                        { label: 'Complete', count: completedCount, cls: 'flow-gtd-progress-swatch-complete' },
                        { label: 'In Flight', count: inFlightCount, cls: 'flow-gtd-progress-swatch-in-flight' },
                        { label: 'Yet to Send', count: pendingCount, cls: 'flow-gtd-progress-swatch-pending' }
                ].forEach(({ label, count, cls }) => {
                        const legendItem = legend.createDiv('flow-gtd-progress-legend-item');
                        legendItem.createSpan({ cls: `flow-gtd-progress-swatch ${cls}` });
                        legendItem.createSpan({
                                cls: 'flow-gtd-progress-legend-label',
                                text: `${count} ${label}`
                        });
                });

                const unprocessedCount = state.editableItems.filter(item => !item.isAIProcessed).length;

                if (unprocessedCount > 0) {
                        new Setting(batchContainer)
                                .addButton(button => button
                                        .setButtonText(`✨ Refine All ${unprocessedCount} Items with AI`)
                                        .setCta()
                                        .onClick(() => state.refineAllWithAI()));
                }
        }

        renderIndividualEditableItems(contentEl, state);

        if (state.editableItems.length === 0) {
                const completionEl = contentEl.createDiv('flow-gtd-completion');
                completionEl.createEl('h3', { text: '🎉 All items processed!' });
                completionEl.createEl('p', { text: 'Your inbox is now empty.' });

                new Setting(completionEl)
                        .addButton(button => button
                                .setButtonText('Close')
                                .setCta()
                                .onClick(onClose));
        }
}

function renderIndividualEditableItems(container: HTMLElement, state: InboxModalState) {
        const listContainer = container.createDiv('flow-gtd-items-list');

        if (state.editableItems.length === 0) {
                listContainer.createEl('p', {
                        text: 'No items to display.',
                        cls: 'flow-gtd-empty'
                });
                return;
        }

        state.editableItems.forEach((item, index) => {
                        const itemEl = listContainer.createDiv('flow-gtd-editable-item');

                        const metaRow = itemEl.createDiv('flow-gtd-item-meta');
                        let hasMeta = false;
                        const showIndex = state.editableItems.length > 1;
                        if (showIndex) {
                                metaRow.createSpan({
                                        text: `#${index + 1}`,
                                        cls: 'flow-gtd-item-index'
                                });
                                hasMeta = true;
                        }

                        if (item.isAIProcessed) {
                                metaRow.createSpan({
                                        text: 'AI refined',
                                        cls: 'flow-gtd-item-pill flow-gtd-item-pill-success'
                                });
                                hasMeta = true;
                        }

                        if (item.isProcessing === true) {
                                metaRow.createSpan({
                                        text: 'Processing…',
                                        cls: 'flow-gtd-item-pill flow-gtd-item-pill-warn'
                                });
                                hasMeta = true;
                        }

                        if (item.isAIProcessed && item.result) {
                                metaRow.createSpan({
                                        text: getActionLabel(item.result.recommendedAction),
                                        cls: `flow-gtd-item-pill flow-gtd-item-pill-${item.result.recommendedAction}`
                                });
                                hasMeta = true;
                        }

                        if (!hasMeta) {
                                metaRow.remove();
                        }

                        itemEl.createSpan({
                                text: 'Original',
                                cls: 'flow-gtd-section-label'
                        });

                        const originalRow = itemEl.createDiv('flow-gtd-original-row');
                        originalRow.createSpan({
                                text: item.original,
                                cls: 'flow-gtd-original-text'
                        });

                        if (!item.isAIProcessed && !item.isProcessing) {
                                const refineBtn = originalRow.createEl('button', {
                                        type: 'button',
                                        cls: 'flow-gtd-refine-button'
                                });
                                refineBtn.setAttribute('aria-label', 'Refine with AI');
                                refineBtn.setAttribute('title', 'Refine with AI');
                                refineBtn.setText('✨');
                                refineBtn.addEventListener('click', () => state.refineIndividualItem(item));
                        }

                        renderEditableItemContent(itemEl, item, state);

                        const actionButtons = itemEl.createDiv('flow-gtd-item-actions');
                        actionButtons.style.marginTop = '20px';
                        actionButtons.style.paddingTop = '16px';
                        actionButtons.style.borderTop = '1px solid var(--background-modifier-border)';
                        actionButtons.style.textAlign = 'center';

                        new Setting(actionButtons)
                                .addButton(button => button
                                        .setButtonText('💾 Save to Vault')
                                        .setCta()
                                        .setDisabled(item.isProcessing === true)
                                        .onClick(() => state.saveAndRemoveItem(item)));
        });
}

function renderEditableItemContent(itemEl: HTMLElement, item: EditableItem, state: InboxModalState) {
        let currentNextActions: string[] = [];

        if (item.editedNames && item.editedNames.length > 0) {
                currentNextActions = [...item.editedNames];
        } else if (item.editedName) {
                currentNextActions = [item.editedName];
        } else if (item.isAIProcessed && item.result) {
                if (item.result.nextActions && item.result.nextActions.length > 0) {
                        currentNextActions = [...item.result.nextActions];
                } else if (item.result.nextAction) {
                        currentNextActions = [item.result.nextAction];
                }
        } else {
                currentNextActions = [item.original];
        }

        const actionsContainer = itemEl.createDiv('flow-gtd-actions-editor');
        const actionsHeader = actionsContainer.createDiv('flow-gtd-actions-header');
        actionsHeader.style.display = 'flex';
        actionsHeader.style.alignItems = 'center';
        actionsHeader.style.gap = '8px';
        actionsHeader.style.justifyContent = 'flex-start';

        const actionsLabel = actionsHeader.createEl('label', {
                text: 'Next Actions:',
                cls: 'flow-gtd-label'
        });
        actionsLabel.style.marginBottom = '0';

        const addActionBtn = actionsHeader.createEl('button', {
                cls: 'flow-gtd-add-action-btn'
        });
        addActionBtn.setAttribute('type', 'button');
        addActionBtn.setAttribute('aria-label', 'Add action');
        addActionBtn.setAttribute('title', 'Add action');
        addActionBtn.setText('+');
        addActionBtn.style.padding = '2px 6px';
        addActionBtn.style.fontSize = '12px';
        addActionBtn.style.lineHeight = '1';
        addActionBtn.style.minWidth = 'auto';
        addActionBtn.addEventListener('click', () => {
                currentNextActions.push('');
                item.editedNames = [...currentNextActions];
                state.queueRender('editable');
        });

        const actionsList = actionsContainer.createDiv('flow-gtd-actions-list');
        currentNextActions.forEach((action, index) => {
                const actionItem = actionsList.createDiv('flow-gtd-action-item');

                const actionInput = actionItem.createEl('input', {
                        type: 'text',
                        cls: 'flow-gtd-action-input'
                });
                actionInput.value = action;
                actionInput.placeholder = `Next action ${index + 1}`;

                actionInput.addEventListener('input', (e) => {
                        const value = (e.target as HTMLInputElement).value;
                        currentNextActions[index] = value;
                        item.editedNames = [...currentNextActions];
                        if (currentNextActions.length > 1) {
                                item.editedName = undefined;
                        } else {
                                item.editedName = value;
                        }
                });

                const removeBtn = actionItem.createEl('button', {
                        cls: 'flow-gtd-remove-action-btn'
                });
                removeBtn.setAttribute('type', 'button');
                removeBtn.setAttribute('aria-label', 'Remove action');
                removeBtn.setAttribute('title', 'Remove action');
                removeBtn.setText('✕');
                removeBtn.addEventListener('click', () => {
                        currentNextActions.splice(index, 1);
                        item.editedNames = [...currentNextActions];
                        if (currentNextActions.length === 1) {
                                item.editedName = currentNextActions[0];
                        }
                        state.queueRender('editable');
                });
        });

        if (currentNextActions.length === 1) {
                item.editedName = currentNextActions[0];
                item.editedNames = undefined;
        }

        const actionSelectorEl = itemEl.createDiv('flow-gtd-action-selector');
        const actionRow = actionSelectorEl.createDiv('flow-gtd-inline-field');
        const actionSelectId = state.getUniqueId('flow-gtd-action');
        const actionLabel = actionRow.createEl('label', {
                text: 'Choose how to process:',
                cls: 'flow-gtd-inline-label flow-gtd-label'
        });
        actionLabel.setAttribute('for', actionSelectId);

        const actionControl = actionRow.createDiv('flow-gtd-inline-control');
        const actionDropdown = new DropdownComponent(actionControl);
        actionDropdown.selectEl.id = actionSelectId;
        actionDropdown.selectEl.addClass('flow-gtd-inline-select');
        actionDropdown.selectEl.setAttribute('aria-label', 'Choose how to process');
        const actions: Array<{ value: EditableItem['selectedAction']; label: string }> = [
                { value: 'create-project', label: 'Create New Project' },
                { value: 'add-to-project', label: 'Add to Existing Project' },
                { value: 'next-actions-file', label: 'Next Actions File' },
                { value: 'someday-file', label: 'Someday/Maybe File' },
                { value: 'reference', label: 'Reference (Not Actionable)' },
                { value: 'person', label: 'Discuss with Person' },
                { value: 'trash', label: 'Trash (Delete)' }
        ];
        actions.forEach(({ value, label }) => actionDropdown.addOption(value, label));
        actionDropdown.setValue(item.selectedAction ?? 'next-actions-file');
        actionDropdown.onChange((value) => {
                item.selectedAction = value as EditableItem['selectedAction'];
                state.queueRender('editable');
        });

        if (item.selectedAction === 'create-project') {
                renderProjectCreationSection(itemEl, item, state);
        } else if (item.selectedAction === 'add-to-project') {
                renderProjectSelectionSection(itemEl, item, state);
        } else if (item.selectedAction === 'person') {
                renderPersonSelectionSection(itemEl, item, state);
        }

        renderSphereSelector(itemEl, item, state);
}

function renderProjectCreationSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
        const projectEl = container.createDiv('flow-gtd-project-section');
        projectEl.createEl('p', {
                text: 'Project Outcome (what done looks like):',
                cls: 'flow-gtd-label'
        });

        const inputRow = projectEl.createDiv('flow-gtd-project-input-row');
        inputRow.style.display = 'flex';
        inputRow.style.gap = '8px';
        inputRow.style.alignItems = 'center';

        const projectInput = inputRow.createEl('input', {
                type: 'text',
                cls: 'flow-gtd-project-input'
        });
        projectInput.style.flex = '1';
        projectInput.placeholder = 'e.g., Vacation planned and booked';
        projectInput.value = item.editedProjectTitle || item.result?.projectOutcome || '';
        projectInput.addEventListener('input', (e) => {
                item.editedProjectTitle = (e.target as HTMLInputElement).value;
        });

        const suggestBtn = inputRow.createEl('button', {
                text: '✨ Suggest Project Name',
                cls: 'flow-gtd-suggest-project-btn'
        });
        suggestBtn.style.flexShrink = '0';
        suggestBtn.addEventListener('click', async () => {
                try {
                        const suggestedName = await state.suggestProjectName(item.original);
                        item.editedProjectTitle = suggestedName;
                        projectInput.value = suggestedName;
                } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        projectEl.createDiv('flow-gtd-error').setText(message);
                }
        });

        if (item.isAIProcessed && item.result?.suggestedProjects && item.result.suggestedProjects.length > 0) {
                const suggestionsEl = projectEl.createDiv('flow-gtd-project-suggestions');
                suggestionsEl.createEl('p', {
                        text: '✨ AI Suggested Projects:',
                        cls: 'flow-gtd-label flow-gtd-suggestions-label'
                });

                item.result.suggestedProjects.forEach(suggestion => {
                        const suggestionEl = suggestionsEl.createDiv('flow-gtd-suggestion-item');
                        suggestionEl.style.padding = '8px';
                        suggestionEl.style.margin = '4px 0';
                        suggestionEl.style.border = '1px solid var(--background-modifier-border)';
                        suggestionEl.style.borderRadius = '4px';
                        suggestionEl.style.cursor = 'pointer';

                        suggestionEl.createEl('strong', { text: suggestion.project.title });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: suggestion.relevance,
                                cls: 'flow-gtd-suggestion-relevance'
                        });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: `Confidence: ${suggestion.confidence}`,
                                cls: 'flow-gtd-suggestion-confidence'
                        });

                        suggestionEl.addEventListener('click', () => {
                                item.editedProjectTitle = suggestion.project.title;
                                projectInput.value = suggestion.project.title;
                        });
                });
        }
}

function renderProjectSelectionSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
        const projectSelectorEl = container.createDiv('flow-gtd-project-selector');
        const projectRow = projectSelectorEl.createDiv('flow-gtd-inline-field');
        const projectSelectId = state.getUniqueId('flow-gtd-project');
        const projectLabelText = 'Select existing project:';
        const projectLabel = projectRow.createEl('label', {
                text: projectLabelText,
                cls: 'flow-gtd-inline-label flow-gtd-label'
        });
        projectLabel.setAttribute('for', projectSelectId);

        const projectControl = projectRow.createDiv('flow-gtd-inline-control');
        const projectDropdown = new DropdownComponent(projectControl);
        projectDropdown.selectEl.id = projectSelectId;
        projectDropdown.selectEl.addClass('flow-gtd-inline-select');
        projectDropdown.selectEl.setAttribute('aria-label', projectLabelText);
        projectDropdown.addOption('', '-- Select a project --');
        state.existingProjects.forEach(project => {
                projectDropdown.addOption(project.file, project.title);
        });

        if (item.selectedProject) {
                const { file, title } = item.selectedProject;
                if (!state.existingProjects.find(project => project.file === file)) {
                        projectDropdown.addOption(file, title);
                }
                projectDropdown.setValue(file);
        }

        projectDropdown.onChange((value) => {
                item.selectedProject = state.existingProjects.find(project => project.file === value);
        });

        if (item.isAIProcessed && item.result?.suggestedProjects && item.result.suggestedProjects.length > 0) {
                const suggestionsEl = projectSelectorEl.createDiv('flow-gtd-project-suggestions');
                suggestionsEl.createEl('p', {
                        text: '✨ AI Suggested Projects:',
                        cls: 'flow-gtd-label flow-gtd-suggestions-label'
                });

                item.result.suggestedProjects.forEach(suggestion => {
                        const suggestionEl = suggestionsEl.createDiv('flow-gtd-suggestion-item');
                        suggestionEl.style.padding = '8px';
                        suggestionEl.style.margin = '4px 0';
                        suggestionEl.style.border = '1px solid var(--background-modifier-border)';
                        suggestionEl.style.borderRadius = '4px';
                        suggestionEl.style.cursor = 'pointer';

                        suggestionEl.createEl('strong', { text: suggestion.project.title });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: suggestion.relevance,
                                cls: 'flow-gtd-suggestion-relevance'
                        });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: `Confidence: ${suggestion.confidence}`,
                                cls: 'flow-gtd-suggestion-confidence'
                        });

                        suggestionEl.addEventListener('click', () => {
                                item.selectedProject = suggestion.project;
                                state.queueRender('editable');
                        });
                });
        }
}

function renderPersonSelectionSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
        const personSelectorEl = container.createDiv('flow-gtd-person-selector');
        const personRow = personSelectorEl.createDiv('flow-gtd-inline-field');
        const personSelectId = state.getUniqueId('flow-gtd-person');
        const personLabelText = 'Select person to discuss with:';
        const personLabel = personRow.createEl('label', {
                text: personLabelText,
                cls: 'flow-gtd-inline-label flow-gtd-label'
        });
        personLabel.setAttribute('for', personSelectId);

        const personControl = personRow.createDiv('flow-gtd-inline-control');
        const personDropdown = new DropdownComponent(personControl);
        personDropdown.selectEl.id = personSelectId;
        personDropdown.selectEl.addClass('flow-gtd-inline-select');
        personDropdown.selectEl.setAttribute('aria-label', personLabelText);
        personDropdown.addOption('', '-- Select a person --');
        state.existingPersons.forEach(person => {
                personDropdown.addOption(person.file, person.title);
        });

        let selectedValue = item.selectedPerson?.file || '';
        if (!selectedValue && item.isAIProcessed && item.result?.suggestedPersons) {
                const highConfidenceSuggestion = item.result.suggestedPersons.find(
                        suggestion => suggestion.confidence === 'high'
                );
                if (highConfidenceSuggestion) {
                        selectedValue = highConfidenceSuggestion.person.file;
                        item.selectedPerson = highConfidenceSuggestion.person;
                }
        }

        if (selectedValue && !state.existingPersons.find(person => person.file === selectedValue)) {
                personDropdown.addOption(selectedValue, item.selectedPerson?.title || selectedValue);
        }

        personDropdown.setValue(selectedValue);
        personDropdown.onChange((value) => {
                item.selectedPerson = state.existingPersons.find(
                        p => p.file === value
                ) || undefined;
        });

        if (item.isAIProcessed && item.result?.suggestedPersons && item.result.suggestedPersons.length > 0) {
                const suggestionsEl = personSelectorEl.createDiv('flow-gtd-person-suggestions');
                suggestionsEl.createEl('p', {
                        text: '✨ AI Suggested Persons:',
                        cls: 'flow-gtd-label flow-gtd-suggestions-label'
                });

                item.result.suggestedPersons.forEach(suggestion => {
                        const suggestionEl = suggestionsEl.createDiv('flow-gtd-suggestion-item');
                        suggestionEl.style.padding = '8px';
                        suggestionEl.style.margin = '4px 0';
                        suggestionEl.style.border = '1px solid var(--background-modifier-border)';
                        suggestionEl.style.borderRadius = '4px';
                        suggestionEl.style.cursor = 'pointer';

                        suggestionEl.createEl('strong', { text: suggestion.person.title });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: suggestion.relevance,
                                cls: 'flow-gtd-suggestion-relevance'
                        });
                        suggestionEl.createEl('br');
                        suggestionEl.createEl('span', {
                                text: `Confidence: ${suggestion.confidence}`,
                                cls: 'flow-gtd-suggestion-confidence'
                        });

                        suggestionEl.addEventListener('click', () => {
                                item.selectedPerson = suggestion.person;
                                state.queueRender('editable');
                        });
                });
        }
}

function renderSphereSelector(container: HTMLElement, item: EditableItem, state: InboxModalState) {
        const spheres = state.settingsSnapshot.spheres;
        if (spheres.length === 0) {
                return;
        }

        const sphereSelectorEl = container.createDiv('flow-gtd-sphere-selector');

        if (item.isAIProcessed && item.result?.recommendedSpheres && item.result.recommendedSpheres.length > 0) {
                const recommendationEl = sphereSelectorEl.createDiv('flow-gtd-sphere-recommendation');
                recommendationEl.createEl('p', {
                        text: `✨ Recommended: ${item.result.recommendedSpheres.join(', ')}`,
                        cls: 'flow-gtd-sphere-recommendation-text'
                });
                if (item.result.recommendedSpheresReasoning) {
                        recommendationEl.createEl('p', {
                                text: item.result.recommendedSpheresReasoning,
                                cls: 'flow-gtd-recommendation-reason'
                        });
                }
        }

        const sphereRow = sphereSelectorEl.createDiv('flow-gtd-sphere-row');
        sphereRow.style.display = 'flex';
        sphereRow.style.alignItems = 'center';
        sphereRow.style.gap = '12px';

        const sphereLabel = sphereRow.createEl('span', { text: 'Select spheres:', cls: 'flow-gtd-label' });
        sphereLabel.style.marginBottom = '0';

        const buttonContainer = sphereRow.createDiv('flow-gtd-sphere-buttons');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        spheres.forEach(sphere => {
                const button = buttonContainer.createEl('button', {
                        text: sphere,
                        cls: 'flow-gtd-sphere-button'
                });

                if (item.selectedSpheres.includes(sphere)) {
                        button.addClass('selected');
                }

                button.addEventListener('click', () => {
                        if (item.selectedSpheres.includes(sphere)) {
                                item.selectedSpheres = item.selectedSpheres.filter(s => s !== sphere);
                                button.removeClass('selected');
                        } else {
                                item.selectedSpheres.push(sphere);
                                button.addClass('selected');
                        }
                });
        });
}
