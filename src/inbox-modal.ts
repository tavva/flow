import { App, Modal, Setting, Notice } from 'obsidian';
import { GTDProcessor } from './gtd-processor';
import { FlowProjectScanner } from './flow-scanner';
import { FileWriter } from './file-writer';
import { GTDProcessingResult, FlowProject, PluginSettings, ProcessingAction } from './types';
import { InboxScanner, InboxItem } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';

interface EditableItem {
	original: string;
	inboxItem?: InboxItem; // Track the original inbox item for deletion
	isAIProcessed: boolean; // Whether this item has been processed by AI
	result?: GTDProcessingResult; // AI processing result (if processed)
	selectedProject?: FlowProject;
	selectedAction: ProcessingAction; // User's final decision
	selectedSpheres: string[]; // User's sphere selection
	editedName?: string; // User's edited name for the next action
	editedProjectTitle?: string; // User's edited project title (for create-project)
	isProcessing?: boolean; // Whether this item is currently being processed by AI
}

type InputMode = 'single' | 'bulk' | 'inbox';

export class InboxProcessingModal extends Modal {
	private mindsweepItems: string[] = [];
	private editableItems: EditableItem[] = [];
	private currentInput: string = '';
	private bulkInput: string = '';
	private inputMode: InputMode = 'single';
	private inboxItems: InboxItem[] = [];
	private deletionOffsets = new Map<string, number>();

	private processor: GTDProcessor;
	private scanner: FlowProjectScanner;
	private writer: FileWriter;
	private inboxScanner: InboxScanner;
	private existingProjects: FlowProject[] = [];

        constructor(
                app: App,
                private settings: PluginSettings,
                private startWithInbox: boolean = false
        ) {
                super(app);
                this.processor = new GTDProcessor(
                        settings.anthropicApiKey,
                        settings.spheres,
                        settings.anthropicModel
                );
                this.scanner = new FlowProjectScanner(app);
                this.writer = new FileWriter(app, settings);
                this.inboxScanner = new InboxScanner(app, settings);

		if (startWithInbox) {
			this.inputMode = 'inbox';
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('flow-gtd-inbox-modal');

		// Load existing projects
		try {
			this.existingProjects = await this.scanner.scanProjects();
		} catch (error) {
			new Notice('Failed to load existing projects');
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
			this.inboxItems = await this.inboxScanner.getAllInboxItems();

			if (this.inboxItems.length === 0) {
				new Notice('No items found in inbox folders');
				this.inputMode = 'single';
				this.renderMindsweep();
				return;
			}

			// Create editable items immediately without AI processing
			this.editableItems = this.inboxItems.map(item => ({
				original: item.content,
				inboxItem: item,
				isAIProcessed: false,
				selectedAction: 'next-actions-file' as ProcessingAction,
				selectedSpheres: []
			}));

			new Notice(`Loaded ${this.inboxItems.length} items from inbox`);
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
		this.editableItems = this.mindsweepItems.map(item => ({
			original: item,
			isAIProcessed: false,
			selectedAction: 'next-actions-file' as ProcessingAction,
			selectedSpheres: []
		}));

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

			// Add visual separation and distinct styling
			itemEl.style.marginBottom = '24px';
			itemEl.style.padding = '16px';
			itemEl.style.border = '2px solid var(--background-modifier-border)';
			itemEl.style.borderRadius = '8px';
			itemEl.style.backgroundColor = 'var(--background-primary-alt)';

			// Add alternating background colors for better distinction
			if (index % 2 === 1) {
				itemEl.style.backgroundColor = 'var(--background-secondary)';
			}

			// Item header with enhanced styling
			const headerEl = itemEl.createDiv('flow-gtd-item-header');
			headerEl.style.display = 'flex';
			headerEl.style.alignItems = 'center';
			headerEl.style.marginBottom = '12px';
			headerEl.style.paddingBottom = '8px';
			headerEl.style.borderBottom = '1px solid var(--background-modifier-border)';

			const itemNumberEl = headerEl.createEl('h4', {
				text: `Item ${index + 1}`,
				cls: 'flow-gtd-item-number'
			});
			itemNumberEl.style.margin = '0';
			itemNumberEl.style.padding = '4px 12px';
			itemNumberEl.style.backgroundColor = 'var(--interactive-accent)';
			itemNumberEl.style.color = 'var(--text-on-accent)';
			itemNumberEl.style.borderRadius = '12px';
			itemNumberEl.style.fontSize = '0.9em';
			itemNumberEl.style.fontWeight = 'bold';
			itemNumberEl.style.marginRight = '12px';

			// AI status badge with enhanced styling
			if (item.isAIProcessed) {
				const aiBadge = headerEl.createSpan({
					text: '✨ AI Refined',
					cls: 'flow-gtd-ai-badge'
				});
				aiBadge.style.padding = '4px 8px';
				aiBadge.style.backgroundColor = 'var(--color-green)';
				aiBadge.style.color = 'var(--text-on-accent)';
				aiBadge.style.borderRadius = '6px';
				aiBadge.style.fontSize = '0.8em';
				aiBadge.style.fontWeight = 'bold';
				aiBadge.style.marginRight = '8px';
			}

			if (item.isProcessing === true) {
				const processingBadge = headerEl.createSpan({
					text: '⏳ Processing...',
					cls: 'flow-gtd-processing-badge'
				});
				processingBadge.style.padding = '4px 8px';
				processingBadge.style.backgroundColor = 'var(--color-orange)';
				processingBadge.style.color = 'var(--text-on-accent)';
				processingBadge.style.borderRadius = '6px';
				processingBadge.style.fontSize = '0.8em';
				processingBadge.style.fontWeight = 'bold';
				processingBadge.style.marginRight = '8px';
				processingBadge.style.animation = 'pulse 1.5s infinite';
			}

			// Category badge (if AI processed) - positioned after header
			if (item.isAIProcessed && item.result) {
				const categoryContainer = itemEl.createDiv('flow-gtd-category-container');
				categoryContainer.style.marginBottom = '12px';

				const badge = categoryContainer.createSpan({
					text: item.result.category.toUpperCase().replace('-', ' '),
					cls: `flow-gtd-badge flow-gtd-badge-${item.result.category}`
				});
				badge.style.padding = '6px 12px';
				badge.style.borderRadius = '16px';
				badge.style.fontSize = '0.85em';
				badge.style.fontWeight = 'bold';
				badge.style.textTransform = 'uppercase';
				badge.style.letterSpacing = '0.5px';

				// Category-specific colors
				switch (item.result.category) {
					case 'project':
						badge.style.backgroundColor = 'var(--color-blue)';
						badge.style.color = 'white';
						break;
					case 'next-action':
						badge.style.backgroundColor = 'var(--color-green)';
						badge.style.color = 'white';
						break;
					case 'reference':
						badge.style.backgroundColor = 'var(--color-purple)';
						badge.style.color = 'white';
						break;
					case 'someday':
						badge.style.backgroundColor = 'var(--color-yellow)';
						badge.style.color = 'var(--text-normal)';
						break;
					default:
						badge.style.backgroundColor = 'var(--background-modifier-border)';
						badge.style.color = 'var(--text-normal)';
				}
			}

			// Original item - enhanced styling for better visibility
			const originalEl = itemEl.createEl('div', {
				cls: 'flow-gtd-original-container'
			});
			originalEl.style.marginBottom = '16px';
			originalEl.style.padding = '12px';
			originalEl.style.backgroundColor = 'var(--background-modifier-hover)';
			originalEl.style.borderRadius = '6px';
			originalEl.style.borderLeft = '4px solid var(--interactive-accent)';

			originalEl.createEl('p', {
				text: `Original: "${item.original}"`,
				cls: 'flow-gtd-original'
			}).style.fontWeight = 'bold';

			// Individual refine button (if not processed and not processing)
			if (!item.isAIProcessed && !item.isProcessing) {
				const refineContainer = itemEl.createDiv('flow-gtd-refine-action');
				refineContainer.style.marginBottom = '16px';
				refineContainer.style.textAlign = 'center';

				new Setting(refineContainer)
					.addButton(button => button
						.setButtonText('✨ Refine with AI')
						.setClass('mod-warning')
						.onClick(() => this.refineIndividualItem(item)));
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
		// Determine the current next action text
		const currentNextAction = item.editedName ||
			(item.isAIProcessed && item.result ? item.result.nextAction : item.original);
		// Editable next action
		const actionContainer = itemEl.createDiv('flow-gtd-action-editor');
		actionContainer.createEl('label', {
			text: 'Next Action:',
			cls: 'flow-gtd-label'
		});

		const actionInput = actionContainer.createEl('input', {
			type: 'text',
			cls: 'flow-gtd-action-input'
		});
		actionInput.value = currentNextAction;
		actionInput.addEventListener('input', (e) => {
			const value = (e.target as HTMLInputElement).value;
			const originalValue = item.isAIProcessed && item.result ? item.result.nextAction : item.original;
			item.editedName = value !== originalValue ? value : undefined;
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
		actionSelectorEl.createEl('p', { text: 'Where should this go?', cls: 'flow-gtd-label' });

		new Setting(actionSelectorEl)
			.addDropdown(dropdown => {
				dropdown
					.addOption('create-project', '📁 Create New Project')
					.addOption('add-to-project', '➕ Add to Existing Project')
					.addOption('next-actions-file', '✅ Next Actions File')
					.addOption('someday-file', '💭 Someday/Maybe File')
					.addOption('reference', '📚 Reference (Not Actionable)')
					.addOption('trash', '🗑️ Trash (Delete)');

				dropdown.setValue(item.selectedAction);
				dropdown.onChange((value) => {
					item.selectedAction = value as ProcessingAction;
					// Re-render the entire list to update conditional fields
					this.renderEditableItemsList();
				});
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

		// Project selector (only show if action is add-to-project)
		if (item.selectedAction === 'add-to-project') {
			const projectSelectorEl = itemEl.createDiv('flow-gtd-project-selector');
			projectSelectorEl.createEl('p', { text: 'Select project:', cls: 'flow-gtd-label' });

			new Setting(projectSelectorEl)
				.addDropdown(dropdown => {
					// Add all existing projects to the dropdown
					this.existingProjects.forEach(project => {
						dropdown.addOption(project.file, project.title);
					});

					dropdown.setValue(item.selectedProject?.file || '');
					dropdown.onChange((value) => {
						item.selectedProject = this.existingProjects.find(
							p => p.file === value
						);
					});
				});
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
		const finalNextAction = item.editedName ||
			(item.result ? item.result.nextAction : item.original);

		itemEl.createEl('p', {
			text: `Saved as: ${this.getActionLabel(item.selectedAction)}`,
			cls: 'flow-gtd-saved-action'
		});

		if (['create-project', 'add-to-project', 'next-actions-file'].includes(item.selectedAction)) {
			itemEl.createEl('p', {
				text: `Next Action: "${finalNextAction}"`,
				cls: 'flow-gtd-saved-content'
			});
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
			'trash': 'Trash (Delete)'
		};
		return labels[action] || action;
	}


	private async refineAllWithAI() {
		const unprocessedItems = this.editableItems.filter(item => !item.isAIProcessed);

		if (unprocessedItems.length === 0) {
			new Notice('No items to process');
			return;
		}

		new Notice(`Processing ${unprocessedItems.length} items with AI...`);

		// Mark all items as processing
		unprocessedItems.forEach(item => {
			item.isProcessing = true;
		});
		this.renderEditableItemsList();

		// Process all items
		for (const item of unprocessedItems) {
			try {
				const result = await this.processor.processInboxItem(item.original, this.existingProjects);

				item.result = result;
				item.isAIProcessed = true;
				item.selectedProject = result.suggestedProjects && result.suggestedProjects.length > 0
					? result.suggestedProjects[0].project
					: undefined;
				item.selectedAction = result.recommendedAction;
				item.selectedSpheres = result.recommendedSpheres || [];
			} catch (error) {
				new Notice(`Error processing "${item.original}": ${error.message}`);
				console.error(error);
				// Keep item unprocessed but remove processing state
			}

			item.isProcessing = false;
		}

		new Notice(`✅ Processed ${unprocessedItems.length} items`);
		this.renderEditableItemsList();
	}

	private async refineIndividualItem(item: EditableItem) {
		if (item.isProcessing || item.isAIProcessed) {
			return;
		}

		item.isProcessing = true;
		this.renderEditableItemsList();

		try {
			const result = await this.processor.processInboxItem(item.original, this.existingProjects);

			item.result = result;
			item.isAIProcessed = true;
			item.selectedProject = result.suggestedProjects && result.suggestedProjects.length > 0
				? result.suggestedProjects[0].project
				: undefined;
			item.selectedAction = result.recommendedAction;
			item.selectedSpheres = result.recommendedSpheres || [];

			new Notice(`✅ Refined: "${item.original}"`);
		} catch (error) {
			new Notice(`Error processing "${item.original}": ${error.message}`);
			console.error(error);
		} finally {
			item.isProcessing = false;
			this.renderEditableItemsList();
		}
	}

	private async saveAndRemoveItem(item: EditableItem) {
		try {
			// Use edited values if available
			const finalNextAction = item.editedName ||
				(item.isAIProcessed && item.result ? item.result.nextAction : item.original);
			const trimmedNextAction = finalNextAction?.trim() ?? '';
			const sanitizedNextAction =
				trimmedNextAction.length > 0 ? trimmedNextAction : finalNextAction;

			if (
				['create-project', 'add-to-project', 'next-actions-file'].includes(item.selectedAction) &&
				trimmedNextAction.length === 0
			) {
				throw new GTDResponseValidationError('Next action cannot be empty when saving this item.');
			}

			// Create a modified result for saving
			const resultForSaving: GTDProcessingResult = item.result || {
				isActionable: true,
				category: 'next-action',
				nextAction: sanitizedNextAction,
				reasoning: 'User input',
				suggestedProjects: [],
				recommendedAction: item.selectedAction,
				recommendedActionReasoning: 'User selection',
				recommendedSpheres: item.selectedSpheres,
				recommendedSpheresReasoning: ''
			};

			resultForSaving.nextAction = sanitizedNextAction;
			resultForSaving.projectOutcome = item.editedProjectTitle || resultForSaving.projectOutcome;

			switch (item.selectedAction) {
				case 'create-project':
					await this.writer.createProject(resultForSaving, item.original, item.selectedSpheres);
					break;

				case 'add-to-project':
					if (item.selectedProject) {
						await this.writer.addNextActionToProject(
							item.selectedProject,
							sanitizedNextAction
						);
					} else {
						throw new Error('No project selected');
					}
					break;

				case 'next-actions-file':
					await this.writer.addToNextActionsFile(sanitizedNextAction, item.selectedSpheres);
					break;

				case 'someday-file':
					await this.writer.addToSomedayFile(item.original, item.selectedSpheres);
					break;

				case 'reference':
					new Notice(`Reference item not saved: ${item.original}`);
					break;

				case 'trash':
					// Just delete from inbox, don't save anywhere
					break;
			}

			// Delete the inbox item if it exists
			if (item.inboxItem) {
				let inboxItemToDelete = item.inboxItem;

				if (item.inboxItem.type === 'line' && item.inboxItem.sourceFile?.path) {
					const filePath = item.inboxItem.sourceFile.path;
					const priorDeletions = this.deletionOffsets.get(filePath) ?? 0;
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
					const priorDeletions = this.deletionOffsets.get(filePath) ?? 0;
					this.deletionOffsets.set(filePath, priorDeletions + 1);
				}
			}

			// Remove item from the list
			const index = this.editableItems.indexOf(item);
			if (index > -1) {
				this.editableItems.splice(index, 1);
			}

			// Show success message
			const actionLabel = this.getActionLabel(item.selectedAction);
			new Notice(`✅ Saved: ${actionLabel}`);

			// Re-render the list to update the UI
			this.renderEditableItemsList();

		} catch (error) {
			if (error instanceof GTDResponseValidationError) {
				new Notice(`Cannot save: ${error.message}`);
			} else {
				new Notice(`Error saving item: ${error.message}`);
			}
			console.error(error);
		}
	}

	private async saveIndividualItem(item: EditableItem) {
		try {
			// Use edited values if available
			const finalNextAction = item.editedName ||
				(item.result ? item.result.nextAction : item.original);
			const trimmedNextAction = finalNextAction?.trim() ?? '';
			const sanitizedNextAction =
				trimmedNextAction.length > 0 ? trimmedNextAction : finalNextAction;

			if (
				['create-project', 'add-to-project', 'next-actions-file'].includes(item.selectedAction) &&
				trimmedNextAction.length === 0
			) {
				throw new GTDResponseValidationError('Next action cannot be empty when saving this item.');
			}

			// Create a modified result with edited values
			const modifiedResult: GTDProcessingResult = item.result ? {
				...item.result,
				nextAction: sanitizedNextAction,
				projectOutcome: item.editedProjectTitle || item.result.projectOutcome
			} : {
				isActionable: true,
				category: 'next-action',
				nextAction: sanitizedNextAction,
				reasoning: 'User input',
				suggestedProjects: [],
				recommendedAction: item.selectedAction,
				recommendedActionReasoning: 'User selection',
				recommendedSpheres: item.selectedSpheres,
				recommendedSpheresReasoning: '',
				projectOutcome: item.editedProjectTitle
			};

			switch (item.selectedAction) {
				case 'create-project':
					await this.writer.createProject(modifiedResult, item.original, item.selectedSpheres);
					break;

				case 'add-to-project':
					if (item.selectedProject) {
						await this.writer.addNextActionToProject(
							item.selectedProject,
							sanitizedNextAction
						);
					} else {
						throw new Error('No project selected');
					}
					break;

				case 'next-actions-file':
					await this.writer.addToNextActionsFile(sanitizedNextAction, item.selectedSpheres);
					break;

				case 'someday-file':
					await this.writer.addToSomedayFile(item.original, item.selectedSpheres);
					break;

				case 'reference':
					// For reference items, we could add them to a reference file
					// For now, just notify the user
					new Notice(`Reference item not saved: ${item.original}`);
					break;

				case 'trash':
					// Just delete from inbox, don't save anywhere
					break;
			}

			// Delete the inbox item if it exists (even for trash items)
			if (item.inboxItem) {
				let inboxItemToDelete = item.inboxItem;

				if (item.inboxItem.type === 'line' && item.inboxItem.sourceFile?.path) {
					const filePath = item.inboxItem.sourceFile.path;
					const priorDeletions = this.deletionOffsets.get(filePath) ?? 0;
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
					const priorDeletions = this.deletionOffsets.get(filePath) ?? 0;
					this.deletionOffsets.set(filePath, priorDeletions + 1);
				}
			}

			// Item will be removed from the list, so no need to mark as saved

			// Show success message
			const actionLabel = this.getActionLabel(item.selectedAction);
			new Notice(`✅ Saved: ${actionLabel}`);

			// Re-render the list to update the UI
			this.renderEditableItemsList();

		} catch (error) {
			if (error instanceof GTDResponseValidationError) {
				new Notice(`Cannot save: ${error.message}`);
			} else {
				new Notice(`Error saving item: ${error.message}`);
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

	private async suggestProjectName(originalItem: string, result?: GTDProcessingResult): Promise<string> {
		// Use the GTD processor to suggest a project name
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

		try {
			const response = await this.processor.callAI(prompt);
			return response.trim();
		} catch (error) {
			throw new Error(`Failed to suggest project name: ${error.message}`);
		}
	}
}
