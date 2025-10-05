import { App, Modal, Setting, Notice } from 'obsidian';
import { GTDProcessor } from './gtd-processor';
import { FlowProjectScanner } from './flow-scanner';
import { FileWriter } from './file-writer';
import { GTDProcessingResult, FlowProject, PluginSettings } from './types';

interface ProcessedItem {
	original: string;
	result: GTDProcessingResult;
	selectedProject?: FlowProject;
	createNew: boolean;
}

export class InboxProcessingModal extends Modal {
	private mindsweepItems: string[] = [];
	private processedItems: ProcessedItem[] = [];
	private currentInput: string = '';
	private bulkInput: string = '';
	private isBulkMode: boolean = false;
	private currentProcessingIndex: number = 0;
	private isProcessing: boolean = false;

	private processor: GTDProcessor;
	private scanner: FlowProjectScanner;
	private writer: FileWriter;
	private existingProjects: FlowProject[] = [];

	constructor(
		app: App,
		private settings: PluginSettings
	) {
		super(app);
		this.processor = new GTDProcessor(settings.anthropicApiKey);
		this.scanner = new FlowProjectScanner(app);
		this.writer = new FileWriter(app, settings);
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

		this.renderMindsweep();
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
					this.isBulkMode = false;
					this.renderMindsweep();
				});
			if (!this.isBulkMode) button.setCta();
			return button;
		});
		modeSetting.addButton(button => {
			button.setButtonText('Bulk Input')
				.onClick(() => {
					this.isBulkMode = true;
					this.renderMindsweep();
				});
			if (this.isBulkMode) button.setCta();
			return button;
		});

		// Input area
		if (this.isBulkMode) {
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
			this.isBulkMode = false;
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

			this.processedItems.push({
				original: item,
				result,
				createNew: result.category === 'project' || (result.suggestedProjects?.length ?? 0) === 0
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

		this.processedItems.push({
			original: item,
			result: {
				isActionable: true,
				category: 'next-action',
				nextAction: item,
				reasoning: 'Skipped processing',
				suggestedProjects: []
			},
			createNew: true
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

			// Project suggestions
			if (item.result.suggestedProjects && item.result.suggestedProjects.length > 0) {
				const suggestionsEl = itemEl.createDiv('flow-gtd-suggestions');
				suggestionsEl.createEl('p', { text: 'Suggested projects:', cls: 'flow-gtd-label' });

				item.result.suggestedProjects.forEach(suggestion => {
					const suggestionEl = suggestionsEl.createDiv('flow-gtd-suggestion');
					suggestionEl.createSpan({ text: suggestion.project.title });
					suggestionEl.createSpan({
						text: ` (${suggestion.confidence})`,
						cls: 'flow-gtd-confidence'
					});
				});
			}
		});
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

		for (const item of this.processedItems) {
			try {
				if (item.result.category === 'project' && item.createNew) {
					await this.writer.createProject(item.result, item.original);
				} else if (item.selectedProject) {
					await this.writer.addNextActionToProject(
						item.selectedProject,
						item.result.nextAction
					);
				} else if (item.result.category === 'next-action' && item.createNew) {
					// Could create a dedicated "Next Actions" file or handle differently
					new Notice(`Next action needs manual placement: ${item.result.nextAction}`);
				}
			} catch (error) {
				new Notice(`Error saving ${item.original}: ${error.message}`);
				console.error(error);
			}
		}

		new Notice('✅ Items saved successfully!');
		this.close();
	}
}
