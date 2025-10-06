import { App, Modal, Setting, Notice } from 'obsidian';
import { GTDProcessor } from './gtd-processor';
import { FlowProjectScanner } from './flow-scanner';
import { FileWriter } from './file-writer';
import { GTDProcessingResult, FlowProject, PluginSettings, ProcessingAction } from './types';
import { InboxScanner, InboxItem } from './inbox-scanner';

interface ProcessedItem {
	original: string;
	result: GTDProcessingResult;
	selectedProject?: FlowProject;
	selectedAction: ProcessingAction; // User's final decision
	selectedSpheres: string[]; // User's sphere selection
	inboxItem?: InboxItem; // Track the original inbox item for deletion
}

type InputMode = 'single' | 'bulk' | 'inbox';

export class InboxProcessingModal extends Modal {
	private mindsweepItems: string[] = [];
	private processedItems: ProcessedItem[] = [];
	private currentInput: string = '';
	private bulkInput: string = '';
	private inputMode: InputMode = 'single';
	private currentProcessingIndex: number = 0;
	private isProcessing: boolean = false;
	private inboxItems: InboxItem[] = [];

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
		this.processor = new GTDProcessor(settings.anthropicApiKey, settings.spheres);
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

			// Add inbox items to mindsweep list
			this.mindsweepItems = this.inboxItems.map(item => item.content);
			new Notice(`Loaded ${this.inboxItems.length} items from inbox`);
			this.renderMindsweep();
		} catch (error) {
			new Notice('Error loading inbox items');
			console.error(error);
			this.inputMode = 'single';
			this.renderMindsweep();
		}
	}

	private startProcessing() {
		this.currentProcessingIndex = 0;
		this.processedItems = [];
		this.renderProcessing();
	}

	private async renderProcessing() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '✨ Process: Create Quality Next Actions' });

		// Progress bar
		const progress = (this.currentProcessingIndex / this.mindsweepItems.length) * 100;
		const progressContainer = contentEl.createDiv('flow-gtd-progress');
		progressContainer.createEl('div', {
			text: `${this.currentProcessingIndex} of ${this.mindsweepItems.length}`,
			cls: 'flow-gtd-progress-text'
		});
		const progressBar = progressContainer.createDiv('flow-gtd-progress-bar');
		progressBar.createDiv('flow-gtd-progress-fill').style.width = `${progress}%`;

		if (this.currentProcessingIndex < this.mindsweepItems.length) {
			// Show current item
			const currentItem = this.mindsweepItems[this.currentProcessingIndex];
			const itemContainer = contentEl.createDiv('flow-gtd-current-item');
			itemContainer.createEl('p', { text: 'Current item:', cls: 'flow-gtd-label' });
			itemContainer.createEl('p', { text: currentItem, cls: 'flow-gtd-current-text' });

			// Action buttons
			const buttonContainer = contentEl.createDiv('flow-gtd-buttons');
			new Setting(buttonContainer)
				.addButton(button => button
					.setButtonText(this.isProcessing ? 'Processing...' : '✨ Refine with AI')
					.setCta()
					.setDisabled(this.isProcessing)
					.onClick(() => this.processCurrentItem()))
				.addButton(button => button
					.setButtonText('Keep As-Is')
					.setDisabled(this.isProcessing)
					.onClick(() => this.skipCurrentItem()));
		} else {
			// Processing complete
			contentEl.createDiv('flow-gtd-complete').createEl('p', {
				text: '✅ Processing complete!',
				cls: 'flow-gtd-complete-text'
			});

			new Setting(contentEl)
				.addButton(button => button
					.setButtonText('Continue to Review →')
					.setCta()
					.onClick(() => this.renderReview()));
		}

		// Show processed items
		if (this.processedItems.length > 0) {
			this.renderProcessedItems(contentEl);
		}
	}

	private async processCurrentItem() {
		this.isProcessing = true;
		this.renderProcessing();

		const item = this.mindsweepItems[this.currentProcessingIndex];

		try {
			const result = await this.processor.processInboxItem(item, this.existingProjects);

			// Find the corresponding inbox item if we're in inbox mode
			const inboxItem = this.inputMode === 'inbox'
				? this.inboxItems[this.currentProcessingIndex]
				: undefined;

			this.processedItems.push({
				original: item,
				result,
				selectedProject: result.suggestedProjects && result.suggestedProjects.length > 0
					? result.suggestedProjects[0].project
					: undefined,
				selectedAction: result.recommendedAction,
				selectedSpheres: result.recommendedSpheres || [],
				inboxItem
			});

			this.currentProcessingIndex++;
		} catch (error) {
			new Notice(`Error processing item: ${error.message}`);
			console.error(error);
		} finally {
			this.isProcessing = false;
			this.renderProcessing();
		}
	}

	private skipCurrentItem() {
		const item = this.mindsweepItems[this.currentProcessingIndex];

		// Find the corresponding inbox item if we're in inbox mode
		const inboxItem = this.inputMode === 'inbox'
			? this.inboxItems[this.currentProcessingIndex]
			: undefined;

		this.processedItems.push({
			original: item,
			result: {
				isActionable: true,
				category: 'next-action',
				nextAction: item,
				reasoning: 'Skipped processing',
				suggestedProjects: [],
				recommendedAction: 'next-actions-file',
				recommendedActionReasoning: 'User skipped AI processing',
				recommendedSpheres: [],
				recommendedSpheresReasoning: ''
			},
			selectedAction: 'next-actions-file',
			selectedSpheres: [],
			inboxItem
		});

		this.currentProcessingIndex++;
		this.renderProcessing();
	}

	private renderProcessedItems(container: HTMLElement) {
		const listContainer = container.createDiv('flow-gtd-processed-list');
		listContainer.createEl('h3', { text: `Processed Items (${this.processedItems.length})` });

		this.processedItems.forEach((item, index) => {
			const itemEl = listContainer.createDiv('flow-gtd-processed-item');

			// Category badge
			const badge = itemEl.createSpan({
				text: item.result.category.toUpperCase().replace('-', ' '),
				cls: `flow-gtd-badge flow-gtd-badge-${item.result.category}`
			});

			// Original item
			itemEl.createEl('p', {
				text: `Original: ${item.original}`,
				cls: 'flow-gtd-original'
			});

			// Next action
			itemEl.createEl('p', {
				text: `Next Action: ${item.result.nextAction}`,
				cls: 'flow-gtd-action'
			});

			// AI Recommendation
			const recommendationEl = itemEl.createDiv('flow-gtd-recommendation');
			recommendationEl.createEl('p', {
				text: `✨ AI Recommendation: ${this.getActionLabel(item.result.recommendedAction)}`,
				cls: 'flow-gtd-ai-recommendation'
			});
			recommendationEl.createEl('p', {
				text: item.result.recommendedActionReasoning,
				cls: 'flow-gtd-recommendation-reason'
			});

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
					});
				});

			// Project selector (only show if action is add-to-project)
			if (item.selectedAction === 'add-to-project' && item.result.suggestedProjects && item.result.suggestedProjects.length > 0) {
				const projectSelectorEl = itemEl.createDiv('flow-gtd-project-selector');
				projectSelectorEl.createEl('p', { text: 'Select project:', cls: 'flow-gtd-label' });

				new Setting(projectSelectorEl)
					.addDropdown(dropdown => {
						item.result.suggestedProjects!.forEach(suggestion => {
							dropdown.addOption(
								suggestion.project.file,
								`${suggestion.project.title} (${suggestion.confidence})`
							);
						});

						dropdown.setValue(item.selectedProject?.file || '');
						dropdown.onChange((value) => {
							item.selectedProject = item.result.suggestedProjects!.find(
								s => s.project.file === value
							)?.project;
						});
					});
			}

			// Sphere selector
			if (this.settings.spheres.length > 0) {
				const sphereSelectorEl = itemEl.createDiv('flow-gtd-sphere-selector');

				// Show AI recommendation if available
				if (item.result.recommendedSpheres && item.result.recommendedSpheres.length > 0) {
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
		});
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

	private renderReview() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '📋 Review and Save' });
		contentEl.createEl('p', {
			text: 'Review your processed items and save them to your vault.',
			cls: 'flow-gtd-description'
		});

		this.renderProcessedItems(contentEl);

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Save All to Vault')
				.setCta()
				.onClick(() => this.saveAllItems()))
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()));
	}

	private async saveAllItems() {
		new Notice('Saving items to vault...');
		let savedCount = 0;
		let skippedCount = 0;

		for (const item of this.processedItems) {
			try {
				switch (item.selectedAction) {
					case 'create-project':
						await this.writer.createProject(item.result, item.original, item.selectedSpheres);
						savedCount++;
						break;

					case 'add-to-project':
						if (item.selectedProject) {
							await this.writer.addNextActionToProject(
								item.selectedProject,
								item.result.nextAction
							);
							savedCount++;
						} else {
							new Notice(`No project selected for: ${item.original}`);
							skippedCount++;
						}
						break;

					case 'next-actions-file':
						await this.writer.addToNextActionsFile(item.result.nextAction, item.selectedSpheres);
						savedCount++;
						break;

					case 'someday-file':
						await this.writer.addToSomedayFile(item.original, item.selectedSpheres);
						savedCount++;
						break;

					case 'reference':
						// For reference items, we could add them to a reference file
						// For now, just notify the user
						new Notice(`Reference item not saved: ${item.original}`);
						skippedCount++;
						break;

					case 'trash':
						// Just delete from inbox, don't save anywhere
						skippedCount++;
						break;
				}

				// Delete the inbox item if it exists (even for trash items)
				if (item.inboxItem) {
					await this.inboxScanner.deleteInboxItem(item.inboxItem);
				}
			} catch (error) {
				new Notice(`Error saving ${item.original}: ${error.message}`);
				console.error(error);
			}
		}

		new Notice(`✅ Saved ${savedCount} items, skipped ${skippedCount}`);
		this.close();
	}
}
