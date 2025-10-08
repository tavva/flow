import { App, Modal, Setting, Notice, DropdownComponent } from 'obsidian';
import { GTDProcessingResult, FlowProject, PluginSettings, ProcessingAction, PersonNote } from './types';
import { InboxProcessingController, EditableItem } from './inbox-processing-controller';
import { InboxScanner } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';

type InputMode = 'single' | 'bulk' | 'inbox';

export class InboxProcessingModal extends Modal {
	private mindsweepItems: string[] = [];
	private editableItems: EditableItem[] = [];
	private currentInput: string = '';
	private bulkInput: string = '';
	private inputMode: InputMode = 'single';
	private deletionOffsets = new Map<string, number>();
	private controller: InboxProcessingController;
	private existingProjects: FlowProject[] = [];
	private existingPersons: PersonNote[] = [];
	private uniqueIdCounter = 0;

	constructor(
		app: App,
		private settings: PluginSettings,
		private startWithInbox: boolean = false
	) {
		super(app);
		this.controller = new InboxProcessingController(app, settings);

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

	private getUniqueId(prefix: string): string {
		this.uniqueIdCounter += 1;
		return `${prefix}-${this.uniqueIdCounter}`;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('flow-gtd-inbox-modal');

		// Load existing projects and persons
		try {
			this.existingProjects = await this.controller.loadExistingProjects();
			this.existingPersons = await this.controller.loadExistingPersons();
		} catch (error) {
			new Notice('Failed to load existing projects and persons');
			console.error(error);
		}

		// If starting with inbox mode, load the inbox items
		if (this.startWithInbox) {
			await this.loadInboxItems();
		} else {
			this.renderMindsweep();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// Clean up any pending render timeout
		if (this.renderTimeout) {
			clearTimeout(this.renderTimeout);
			this.renderTimeout = undefined;
		}
	}

	private renderMindsweep() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '📥 Inbox Processing' });
		contentEl.createEl('p', {
			text: 'Capture everything on your mind. Don\'t filter or organise yet—just capture!',
			cls: 'flow-gtd-description'
		});

		// Mode toggle
		const modeContainer = contentEl.createDiv('flow-gtd-mode-toggle');
		const modeSetting = new Setting(modeContainer);
		modeSetting.addButton(button => {
			button.setButtonText('Single Item')
				.onClick(() => {
					this.inputMode = 'single';
					this.renderMindsweep();
				});
			if (this.inputMode === 'single') button.setCta();
			return button;
		});
		modeSetting.addButton(button => {
			button.setButtonText('Bulk Input')
				.onClick(() => {
					this.inputMode = 'bulk';
					this.renderMindsweep();
				});
			if (this.inputMode === 'bulk') button.setCta();
			return button;
		});
		modeSetting.addButton(button => {
			button.setButtonText('From Inbox')
				.onClick(() => {
					this.inputMode = 'inbox';
					this.loadInboxItems();
				});
			if (this.inputMode === 'inbox') button.setCta();
			return button;
		});

		// Input area
		if (this.inputMode === 'bulk') {
			const bulkContainer = contentEl.createDiv('flow-gtd-bulk-input');
			const textarea = bulkContainer.createEl('textarea', {
				placeholder: 'Paste your list here, one item per line:\n\nCall dentist\nPlan vacation\nFix kitchen sink\nReview quarterly report\nBuy groceries',
				cls: 'flow-gtd-textarea'
			});
			textarea.value = this.bulkInput;
			textarea.rows = 10;
			textarea.addEventListener('input', (e) => {
				this.bulkInput = (e.target as HTMLTextAreaElement).value;
			});

			new Setting(bulkContainer)
				.addButton(button => button
					.setButtonText('Add All Items')
					.setCta()
					.onClick(() => this.addBulkItems()));
		} else if (this.inputMode === 'inbox') {
			const inboxContainer = contentEl.createDiv('flow-gtd-inbox-info');
			inboxContainer.createEl('p', {
				text: `Loading items from your Flow inbox folders...`,
				cls: 'flow-gtd-description'
			});
		} else {
			const inputContainer = contentEl.createDiv('flow-gtd-single-input');
			new Setting(inputContainer)
				.addText(text => {
					text
						.setPlaceholder('What\'s on your mind? (e.g., "call dentist", "plan vacation")')
						.setValue(this.currentInput)
						.onChange(value => this.currentInput = value);
					text.inputEl.addEventListener('keypress', (e) => {
						if (e.key === 'Enter') {
							this.addMindsweepItem();
						}
					});
				})
				.addButton(button => button
					.setButtonText('Add')
					.setCta()
					.onClick(() => this.addMindsweepItem()));
		}

		// Captured items list
		if (this.mindsweepItems.length > 0) {
			const listContainer = contentEl.createDiv('flow-gtd-items-list');
			listContainer.createEl('h3', { text: `Captured Items (${this.mindsweepItems.length})` });

			this.mindsweepItems.forEach((item, index) => {
				const itemEl = listContainer.createDiv('flow-gtd-item');
				itemEl.createSpan({ text: item, cls: 'flow-gtd-item-text' });

				const deleteBtn = itemEl.createEl('button', {
					text: '×',
					cls: 'flow-gtd-delete-btn'
				});
				deleteBtn.addEventListener('click', () => {
					this.mindsweepItems.splice(index, 1);
					this.renderMindsweep();
				});
			});

			// Start processing button
			new Setting(contentEl)
				.addButton(button => button
					.setButtonText('Start Processing →')
					.setCta()
					.onClick(() => this.startProcessing()));
		} else {
			contentEl.createDiv('flow-gtd-empty-state').createEl('p', {
				text: '🧠 Start your mindsweep by adding items above',
				cls: 'flow-gtd-empty'
			});
		}
	}

	private addMindsweepItem() {
		if (this.currentInput.trim()) {
			this.mindsweepItems.push(this.currentInput.trim());
			this.currentInput = '';
			this.renderMindsweep();
		}
	}

	private addBulkItems() {
		if (this.bulkInput.trim()) {
			const items = this.bulkInput
				.split('\n')
				.map(item => item.trim())
				.filter(item => item.length > 0);
			this.mindsweepItems.push(...items);
			this.bulkInput = '';
			this.inputMode = 'single';
			this.renderMindsweep();
		}
	}

	private async loadInboxItems() {
		try {
			const inboxEditableItems = await this.controller.loadInboxEditableItems();

			if (inboxEditableItems.length === 0) {
				new Notice('No items found in inbox folders');
				this.inputMode = 'single';
				this.renderMindsweep();
				return;
			}

			this.editableItems = inboxEditableItems;
			new Notice(`Loaded ${inboxEditableItems.length} items from inbox`);
			this.renderEditableItemsList();
		} catch (error) {
			new Notice('Error loading inbox items');
			console.error(error);
			this.inputMode = 'single';
			this.renderMindsweep();
		}
	}

	private renderProcessingInProgress() {
		const { contentEl } = this;
		if (!contentEl) {
			return; // Guard against test environment where contentEl isn't initialized
		}
		contentEl.empty();

		contentEl.createEl('h2', { text: '✨ Processing Inbox Items...' });
		contentEl.createEl('p', {
			text: 'AI is analyzing your inbox items and creating quality next actions.',
			cls: 'flow-gtd-description'
		});

		const loadingEl = contentEl.createDiv('flow-gtd-loading');
		loadingEl.createEl('div', { cls: 'flow-gtd-spinner' });
		loadingEl.createEl('p', { text: 'This may take a moment...', cls: 'flow-gtd-loading-text' });
	}

	private renderEditableItemsList() {
		const { contentEl } = this;
		if (!contentEl) {
			return; // Guard against test environment where contentEl isn't initialized
		}
		contentEl.empty();

		contentEl.createEl('h2', { text: '📝 Edit and Save Items' });
		contentEl.createEl('p', {
			text: 'Review your inbox items. You can edit them manually or refine with AI, then save them to your vault.',
			cls: 'flow-gtd-description'
		});

		// Batch AI processing button
                if (this.editableItems.length > 0) {
                        const batchContainer = contentEl.createDiv('flow-gtd-batch-actions');
                        const totalCount = this.editableItems.length;
                        const completedCount = this.editableItems.filter(item => item.isAIProcessed).length;
                        const inFlightCount = this.editableItems.filter(item => item.isProcessing && !item.isAIProcessed).length;
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

                        const unprocessedCount = this.editableItems.filter(item => !item.isAIProcessed).length;

                        if (unprocessedCount > 0) {
                                new Setting(batchContainer)
                                        .addButton(button => button
                                                .setButtonText(`✨ Refine All ${unprocessedCount} Items with AI`)
                                                .setCta()
                                                .onClick(() => this.refineAllWithAI()));
                        }
                }

		// Render each item
		this.renderIndividualEditableItems(contentEl);

		// Show completion message when all items are processed
		if (this.editableItems.length === 0) {
			const completionEl = contentEl.createDiv('flow-gtd-completion');
			completionEl.createEl('h3', { text: '🎉 All items processed!' });
			completionEl.createEl('p', { text: 'Your inbox is now empty.' });

			new Setting(completionEl)
				.addButton(button => button
					.setButtonText('Close')
					.setCta()
					.onClick(() => this.close()));
		}
	}

	private async startProcessing() {
		if (this.mindsweepItems.length === 0) {
			new Notice('No items to process');
			return;
		}

		// Create editable items from mindsweep items
		this.editableItems = this.controller.createEditableItemsFromMindsweep(this.mindsweepItems);

		new Notice(`Loaded ${this.mindsweepItems.length} items`);
		this.renderEditableItemsList();
	}



	private renderIndividualEditableItems(container: HTMLElement) {
		if (!container) {
			return; // Guard against test environment where container is undefined
		}
		const listContainer = container.createDiv('flow-gtd-items-list');

		if (this.editableItems.length === 0) {
			listContainer.createEl('p', {
				text: 'No items to display.',
				cls: 'flow-gtd-empty'
			});
			return;
		}

		this.editableItems.forEach((item, index) => {
			const itemEl = listContainer.createDiv('flow-gtd-editable-item');

			const metaRow = itemEl.createDiv('flow-gtd-item-meta');
			let hasMeta = false;
			const showIndex = this.editableItems.length > 1;
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
					text: this.getActionLabel(item.result.recommendedAction),
					cls: `flow-gtd-item-pill flow-gtd-item-pill-${item.result.recommendedAction}`
				});
				hasMeta = true;
			}

			if (!hasMeta) {
				metaRow.remove();
			}

			const originalLabel = itemEl.createSpan({
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
				refineBtn.addEventListener('click', () => this.refineIndividualItem(item));
			}

			// Editable content
			this.renderEditableItemContent(itemEl, item);

			// Save button with enhanced styling
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
					.onClick(() => this.saveAndRemoveItem(item)));
		});
	}

	private renderEditableProcessedItems(container: HTMLElement) {
		// This method is for legacy compatibility only
		// The new workflow uses renderIndividualEditableItems instead
		return;
	}

	private renderItemsGroup(container: HTMLElement, items: EditableItem[], isSaved: boolean) {
		// This method is for legacy compatibility only
		// The new workflow doesn't use this method
		return;
	}

	private renderEditableItemContent(itemEl: HTMLElement, item: EditableItem) {
		// Determine current next actions (support multiple)
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

		// Next Actions section
		const actionsContainer = itemEl.createDiv('flow-gtd-actions-editor');
		const actionsHeader = actionsContainer.createDiv('flow-gtd-actions-header');
		actionsHeader.createEl('label', {
			text: 'Next Actions:',
			cls: 'flow-gtd-label'
		});

		// Add new action button
		const addActionBtn = actionsHeader.createEl('button', {
			text: '+ Add Action',
			cls: 'flow-gtd-add-action-btn'
		});
		addActionBtn.addEventListener('click', () => {
			currentNextActions.push('');
			item.editedNames = [...currentNextActions];
			this.renderEditableItemsList(); // Re-render to show new input
		});

		// Render each next action
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
				// Clear editedName if we're using multiple actions
				if (currentNextActions.length > 1) {
					item.editedName = undefined;
				} else {
					item.editedName = value;
				}
			});

			// Remove action button (only show if more than one action)
			if (currentNextActions.length > 1) {
				const removeBtn = actionItem.createEl('button', {
					text: '×',
					cls: 'flow-gtd-remove-action-btn'
				});
				removeBtn.addEventListener('click', () => {
					currentNextActions.splice(index, 1);
					item.editedNames = currentNextActions.length > 1 ? [...currentNextActions] : undefined;
					if (currentNextActions.length === 1) {
						item.editedName = currentNextActions[0];
					}
					this.renderEditableItemsList(); // Re-render to update UI
				});
			}
		});

		// AI Recommendation (only show if AI processed)
		if (item.isAIProcessed && item.result) {
			const recommendationEl = itemEl.createDiv('flow-gtd-recommendation');
			recommendationEl.createEl('p', {
				text: `✨ AI Recommendation: ${this.getActionLabel(item.result.recommendedAction)}`,
				cls: 'flow-gtd-ai-recommendation'
			});
			recommendationEl.createEl('p', {
				text: item.result.recommendedActionReasoning,
				cls: 'flow-gtd-recommendation-reason'
			});
		}

			// Action selector
			const actionSelectorEl = itemEl.createDiv('flow-gtd-action-selector');
			const actionRow = actionSelectorEl.createDiv('flow-gtd-inline-field');
			const actionSelectId = this.getUniqueId('flow-gtd-action');
			const actionLabel = actionRow.createEl('label', {
				text: 'Where should this go?',
				cls: 'flow-gtd-inline-label flow-gtd-label'
			});
			actionLabel.setAttribute('for', actionSelectId);

			const actionControl = actionRow.createDiv('flow-gtd-inline-control');
			const actionDropdown = new DropdownComponent(actionControl);
			actionDropdown.selectEl.id = actionSelectId;
			actionDropdown.selectEl.addClass('flow-gtd-inline-select');
			actionDropdown.selectEl.setAttribute('aria-label', 'Where should this go?');
			actionDropdown.addOption('create-project', '📁 Create New Project');
			actionDropdown.addOption('add-to-project', '➕ Add to Existing Project');
			actionDropdown.addOption('next-actions-file', '✅ Next Actions File');
			actionDropdown.addOption('someday-file', '💭 Someday/Maybe File');
			actionDropdown.addOption('reference', '📚 Reference (Not Actionable)');
			actionDropdown.addOption('person', '👤 Discuss with Person');
			actionDropdown.addOption('trash', '🗑️ Trash (Delete)');
			actionDropdown.setValue(item.selectedAction);
			actionDropdown.onChange((value) => {
				item.selectedAction = value as ProcessingAction;
				// Re-render the entire list to update conditional fields
				this.renderEditableItemsList();
			});

		// Editable project title (only show if action is create-project)
		if (item.selectedAction === 'create-project') {
			const projectTitleEl = itemEl.createDiv('flow-gtd-project-title-editor');

			const labelContainer = projectTitleEl.createDiv('flow-gtd-project-title-label-row');
			labelContainer.createEl('label', {
				text: 'Project Title:',
				cls: 'flow-gtd-label'
			});

			const titleInput = projectTitleEl.createEl('input', {
				type: 'text',
				cls: 'flow-gtd-project-title-input',
				placeholder: 'Enter project title or click "AI Suggest" below'
			});
			titleInput.value = item.editedProjectTitle ||
				(item.isAIProcessed && item.result ? item.result.projectOutcome : '') || '';
			titleInput.addEventListener('input', (e) => {
				const value = (e.target as HTMLInputElement).value;
				item.editedProjectTitle = value || undefined;
			});

			// AI Suggest button
			new Setting(projectTitleEl)
				.addButton(button => button
					.setButtonText('✨ AI Suggest Project Name')
					.setClass('flow-gtd-ai-suggest-button')
					.onClick(async () => {
						button.setButtonText('Suggesting...');
						button.setDisabled(true);
						try {
							const suggestedTitle = await this.suggestProjectName(item.original, item.result);
							titleInput.value = suggestedTitle;
							item.editedProjectTitle = suggestedTitle;
						} catch (error) {
							new Notice(`Error suggesting project name: ${error.message}`);
						} finally {
							button.setButtonText('✨ AI Suggest Project Name');
							button.setDisabled(false);
						}
					}));
		}

			// Project selector (only show if action is add-to-project or reference)
			if (item.selectedAction === 'add-to-project' || item.selectedAction === 'reference') {
				const projectSelectorEl = itemEl.createDiv('flow-gtd-project-selector');
				const labelText = item.selectedAction === 'reference' ? 'Select project to add reference to:' : 'Select project:';
				const projectRow = projectSelectorEl.createDiv('flow-gtd-inline-field');
				const projectSelectId = this.getUniqueId('flow-gtd-project');
				const projectLabel = projectRow.createEl('label', {
					text: labelText,
					cls: 'flow-gtd-inline-label flow-gtd-label'
				});
				projectLabel.setAttribute('for', projectSelectId);

				const projectControl = projectRow.createDiv('flow-gtd-inline-control');
				const projectDropdown = new DropdownComponent(projectControl);
				projectDropdown.selectEl.id = projectSelectId;
				projectDropdown.selectEl.addClass('flow-gtd-inline-select');
				projectDropdown.selectEl.setAttribute('aria-label', labelText);
				projectDropdown.addOption('', '-- Select a project --');
				this.existingProjects.forEach(project => {
					projectDropdown.addOption(project.file, project.title);
				});

				let selectedValue = item.selectedProject?.file || '';
				if (!selectedValue && item.isAIProcessed && item.result?.suggestedProjects) {
					const highConfidenceSuggestion = item.result.suggestedProjects.find(
						suggestion => suggestion.confidence === 'high'
					);
					if (highConfidenceSuggestion) {
						selectedValue = highConfidenceSuggestion.project.file;
						item.selectedProject = highConfidenceSuggestion.project;
					}
				}

				if (selectedValue && !this.existingProjects.find(project => project.file === selectedValue)) {
					projectDropdown.addOption(selectedValue, item.selectedProject?.title || selectedValue);
				}

				projectDropdown.setValue(selectedValue);
				projectDropdown.onChange((value) => {
					item.selectedProject = this.existingProjects.find(
						p => p.file === value
					) || undefined;
				});

				// Show AI suggested projects for reference items
				if (item.selectedAction === 'reference' && item.isAIProcessed && item.result?.suggestedProjects && item.result.suggestedProjects.length > 0) {
				const suggestionsEl = projectSelectorEl.createDiv('flow-gtd-reference-suggestions');
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
						// Re-render to update the dropdown
						this.renderEditableItemsList();
					});
				});
			}
		}

			// Person selector (only show if action is person)
			if (item.selectedAction === 'person') {
				const personSelectorEl = itemEl.createDiv('flow-gtd-person-selector');
				const personRow = personSelectorEl.createDiv('flow-gtd-inline-field');
				const personSelectId = this.getUniqueId('flow-gtd-person');
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
				this.existingPersons.forEach(person => {
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

				if (selectedValue && !this.existingPersons.find(person => person.file === selectedValue)) {
					personDropdown.addOption(selectedValue, item.selectedPerson?.title || selectedValue);
				}

				personDropdown.setValue(selectedValue);
				personDropdown.onChange((value) => {
					item.selectedPerson = this.existingPersons.find(
						p => p.file === value
					) || undefined;
				});

				// Show AI suggested persons
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
						// Re-render to update the dropdown
						this.renderEditableItemsList();
					});
				});
			}
		}

		// Sphere selector
		if (this.settings.spheres.length > 0) {
			const sphereSelectorEl = itemEl.createDiv('flow-gtd-sphere-selector');

			// Show AI recommendation if available
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

			sphereSelectorEl.createEl('p', { text: 'Select spheres:', cls: 'flow-gtd-label' });

			const buttonContainer = sphereSelectorEl.createDiv('flow-gtd-sphere-buttons');
			this.settings.spheres.forEach(sphere => {
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
	}

	private renderSavedItemSummary(itemEl: HTMLElement, item: EditableItem) {
		// Determine the final next actions that were saved
		let finalNextActions: string[] = [];
		if (item.editedNames && item.editedNames.length > 0) {
			finalNextActions = item.editedNames.filter(action => action.trim().length > 0);
		} else if (item.editedName) {
			finalNextActions = [item.editedName];
		} else if (item.result?.nextActions && item.result.nextActions.length > 0) {
			finalNextActions = item.result.nextActions;
		} else if (item.result?.nextAction) {
			finalNextActions = [item.result.nextAction];
		} else {
			finalNextActions = [item.original];
		}

		itemEl.createEl('p', {
			text: `Saved as: ${this.getActionLabel(item.selectedAction)}`,
			cls: 'flow-gtd-saved-action'
		});

		if (['create-project', 'add-to-project', 'next-actions-file'].includes(item.selectedAction)) {
			if (finalNextActions.length === 1) {
				itemEl.createEl('p', {
					text: `Next Action: "${finalNextActions[0]}"`,
					cls: 'flow-gtd-saved-content'
				});
			} else if (finalNextActions.length > 1) {
				itemEl.createEl('p', {
					text: `Next Actions (${finalNextActions.length}):`,
					cls: 'flow-gtd-saved-content'
				});
				const actionsList = itemEl.createEl('ul', { cls: 'flow-gtd-saved-actions-list' });
				finalNextActions.forEach(action => {
					actionsList.createEl('li', { text: `"${action}"` });
				});
			}
		}

		if (item.selectedAction === 'create-project' && (item.editedProjectTitle || (item.result && item.result.projectOutcome))) {
			itemEl.createEl('p', {
				text: `Project: "${item.editedProjectTitle || (item.result ? item.result.projectOutcome : '')}"`,
				cls: 'flow-gtd-saved-content'
			});
		}

		if (item.selectedAction === 'add-to-project' && item.selectedProject) {
			itemEl.createEl('p', {
				text: `Added to: ${item.selectedProject.title}`,
				cls: 'flow-gtd-saved-content'
			});
		}

		if (item.selectedSpheres.length > 0) {
			itemEl.createEl('p', {
				text: `Spheres: ${item.selectedSpheres.join(', ')}`,
				cls: 'flow-gtd-saved-content'
			});
		}
	}

	private renderProcessedItems(container: HTMLElement) {
		// This method is kept for compatibility with old workflow
		// but isn't used in the new immediate processing workflow
		this.renderEditableProcessedItems(container);
	}

	private getActionLabel(action: ProcessingAction): string {
		const labels: Record<ProcessingAction, string> = {
			'create-project': 'Create New Project',
			'add-to-project': 'Add to Existing Project',
			'next-actions-file': 'Next Actions File',
			'someday-file': 'Someday/Maybe File',
			'reference': 'Reference (Not Actionable)',
			'person': 'Discuss with Person',
			'trash': 'Trash (Delete)'
		};
		return labels[action] || action;
	}


	private async refineAllWithAI() {
                const unprocessedIndexes = this.editableItems.reduce<number[]>((indexes, item, index) => {
                        if (!item.isAIProcessed) {
                                indexes.push(index);
                        }
                        return indexes;
                }, []);

                if (unprocessedIndexes.length === 0) {
                        new Notice('No items to process');
                        return;
                }

                new Notice(`Processing ${unprocessedIndexes.length} items with AI...`);

                unprocessedIndexes.forEach(index => {
                        const current = this.editableItems[index];
                        if (!current) {
                                return;
                        }
                        this.editableItems[index] = {
                                ...current,
                                hasAIRequest: true
                        };
                });
                this.renderEditableItemsList();

                let successCount = 0;

                const processItem = async (index: number) => {
                        const item = this.editableItems[index];
                        if (!item) {
                                return;
                        }

                        this.editableItems[index] = {
                                ...item,
                                isProcessing: true
                        };
                        this.scheduleRender();

                        try {
                                const updatedItem = await this.controller.refineItem(
                                        this.editableItems[index],
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
                                this.scheduleRender();
                        }
                };

                await Promise.all(unprocessedIndexes.map(index => processItem(index)));

                this.renderEditableItemsList();
                new Notice(`✅ Processed ${successCount} of ${unprocessedIndexes.length} items`);
        }

	private renderTimeout?: NodeJS.Timeout;

	private scheduleRender() {
		// Debounce render calls to prevent interference during concurrent processing
		if (this.renderTimeout) {
			clearTimeout(this.renderTimeout);
		}
		this.renderTimeout = setTimeout(() => {
			this.renderEditableItemsList();
			this.renderTimeout = undefined;
		}, 50); // Small delay to batch concurrent updates
	}

	private async refineIndividualItem(item: EditableItem) {
		if (item.isProcessing || item.isAIProcessed) {
			return;
		}

                item.hasAIRequest = true;
                item.isProcessing = true;
                this.scheduleRender();

                try {
                        const updatedItem = await this.controller.refineItem(item, this.existingProjects, this.existingPersons);
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
			this.scheduleRender();
		}
	}

	private async saveAndRemoveItem(item: EditableItem) {
		try {
			await this.controller.saveItem(item, this.deletionOffsets);
			this.editableItems = this.editableItems.filter(current => current !== item);
			const actionLabel = this.getActionLabel(item.selectedAction);
			new Notice(`✅ Saved: ${actionLabel}`);
			this.renderEditableItemsList();
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

	private async saveAllItems() {
		// This method saves all remaining editable items
		if (this.editableItems.length === 0) {
			new Notice('No items to save');
			this.close();
			return;
		}

		new Notice(`Saving ${this.editableItems.length} remaining items...`);

		// Reset deletion offsets for batch operations
		this.deletionOffsets.clear();

		// Save all items (this will remove them from the list as they're saved)
		const itemsToSave = [...this.editableItems]; // Create a copy since items will be removed during saving
		for (const item of itemsToSave) {
			await this.saveAndRemoveItem(item);
		}

		this.close();
	}

	private async suggestProjectName(originalItem: string, _result?: GTDProcessingResult): Promise<string> {
		try {
			return await this.controller.suggestProjectName(originalItem);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to suggest project name: ${message}`);
		}
	}
}
