import { App, Modal, Setting, Notice } from 'obsidian';
import { GTDProcessor } from './gtd-processor';
import { FlowProjectScanner } from './flow-scanner';
import { FileWriter } from './file-writer';
import { GTDProcessingResult, FlowProject, PluginSettings, ProcessingAction } from './types';
import { InboxScanner, InboxItem } from './inbox-scanner';
import { GTDResponseValidationError } from './errors';

interface ProcessedItem {
	original: string;
	result: GTDProcessingResult;
	selectedProject?: FlowProject;
	selectedAction: ProcessingAction; // User's final decision
	selectedSpheres: string[]; // User's sphere selection
	inboxItem?: InboxItem; // Track the original inbox item for deletion
	editedName?: string; // User's edited name for the next action
	editedProjectTitle?: string; // User's edited project title (for create-project)
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
		const displayIndex = this.currentProcessingIndex + 1; // Display as 1-indexed
		progressContainer.createEl('div', {
			text: `${displayIndex} of ${this.mindsweepItems.length}`,
			cls: 'flow-gtd-progress-text'
		});
		const progressBar = progressContainer.createDiv('flow-gtd-progress-bar');
		progressBar.createDiv('flow-gtd-progress-fill').style.width = `${progress}%`;

		if (this.currentProcessingIndex < this.mindsweepItems.length) {
			// Show current item
			const currentItem = this.mindsweepItems[this.currentProcessingIndex];
			const itemContainer = contentEl.createDiv('flow-gtd-current-item');
			itemContainer.createEl('p', {
				text: `Current item (${displayIndex}/${this.mindsweepItems.length}):`,
				cls: 'flow-gtd-label'
			});
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
					.onClick(() => this.skipCurrentItem()))
				.addButton(button => button
					.setButtonText('⚡ Refine All Remaining')
					.setDisabled(this.isProcessing)
					.onClick(() => this.processAllRemaining()))
				.addButton(button => button
					.setButtonText('Finish Session')
					.setDisabled(this.isProcessing)
					.onClick(() => this.finishSession()));
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
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;
		this.renderProcessing();

		const currentIndex = this.currentProcessingIndex;
		const item = this.mindsweepItems[currentIndex];

		try {
			const result = await this.processor.processInboxItem(item, this.existingProjects);

			// Verify we're still on the same item (in case of race conditions)
			if (this.currentProcessingIndex !== currentIndex) {
				return;
			}

			// Find the corresponding inbox item if we're in inbox mode
			const inboxItem = this.inputMode === 'inbox'
				? this.inboxItems[currentIndex]
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

	private async processAllRemaining() {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;
		this.renderProcessing();

		const remainingItems = this.mindsweepItems.slice(this.currentProcessingIndex);
		new Notice(`Processing ${remainingItems.length} remaining items...`);

		try {
			for (let i = 0; i < remainingItems.length; i++) {
				const absoluteIndex = this.currentProcessingIndex + i;
				const item = remainingItems[i];

				try {
					const result = await this.processor.processInboxItem(item, this.existingProjects);

					// Find the corresponding inbox item if we're in inbox mode
					const inboxItem = this.inputMode === 'inbox'
						? this.inboxItems[absoluteIndex]
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

					// Update UI periodically to show progress
					if ((i + 1) % 3 === 0 || i === remainingItems.length - 1) {
						this.renderProcessing();
						// Small delay to prevent UI freezing
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				} catch (error) {
					new Notice(`Error processing "${item}": ${error.message}`);
					console.error(error);
					this.currentProcessingIndex++;
				}
			}

			new Notice(`✅ Processed ${remainingItems.length} items`);
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

	private finishSession() {
		// Skip directly to review with items processed so far
		this.currentProcessingIndex = this.mindsweepItems.length;
		this.renderReview();
	}

	private renderProcessedItems(container: HTMLElement) {
		// Find existing processed list container or create new one
		let listContainer = container.querySelector('.flow-gtd-processed-list') as HTMLElement;
		if (listContainer) {
			listContainer.empty();
		} else {
			listContainer = container.createDiv('flow-gtd-processed-list');
		}

		listContainer.createEl('h3', { text: `Processed Items (${this.processedItems.length})` });

		const itemsWithIndex = this.processedItems.map((item, index) => ({
			item,
			displayIndex: index + 1
		}));

		for (let i = itemsWithIndex.length - 1; i >= 0; i--) {
			const { item, displayIndex } = itemsWithIndex[i];
			const itemEl = listContainer.createDiv('flow-gtd-processed-item');

			// Item number header
			itemEl.createEl('h4', {
				text: `Item ${displayIndex}`,
				cls: 'flow-gtd-item-number'
			});

			// Category badge
			const badge = itemEl.createSpan({
				text: item.result.category.toUpperCase().replace('-', ' '),
				cls: `flow-gtd-badge flow-gtd-badge-${item.result.category}`
			});

			// Original item - more prominent
			itemEl.createEl('p', {
				text: `Original: "${item.original}"`,
				cls: 'flow-gtd-original'
			}).style.fontWeight = 'bold';

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
			actionInput.value = item.editedName || item.result.nextAction;
			actionInput.addEventListener('input', (e) => {
				const value = (e.target as HTMLInputElement).value;
				item.editedName = value !== item.result.nextAction ? value : undefined;
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
						this.renderProcessedItems(container);
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
				titleInput.value = item.editedProjectTitle || item.result.projectOutcome || '';
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
		}
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
		const deletionOffsets = new Map<string, number>();

		for (const item of this.processedItems) {
			try {
				// Use edited values if available
				const finalNextAction = item.editedName || item.result.nextAction;
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
				const modifiedResult: GTDProcessingResult = {
					...item.result,
					nextAction: sanitizedNextAction,
					projectOutcome: item.editedProjectTitle || item.result.projectOutcome
				};

				switch (item.selectedAction) {
					case 'create-project':
						await this.writer.createProject(modifiedResult, item.original, item.selectedSpheres);
						savedCount++;
						break;

					case 'add-to-project':
						if (item.selectedProject) {
							await this.writer.addNextActionToProject(
								item.selectedProject,
								sanitizedNextAction
							);
							savedCount++;
						} else {
							new Notice(`No project selected for: ${item.original}`);
							skippedCount++;
						}
						break;

					case 'next-actions-file':
						await this.writer.addToNextActionsFile(sanitizedNextAction, item.selectedSpheres);
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
			} catch (error) {
				if (error instanceof GTDResponseValidationError) {
					new Notice(`Skipped ${item.original}: ${error.message}`);
					skippedCount++;
				} else {
					new Notice(`Error saving ${item.original}: ${error.message}`);
					skippedCount++;
				}
				console.error(error);
			}
		}

		new Notice(`✅ Saved ${savedCount} items, skipped ${skippedCount}`);
		this.close();
	}

	private async suggestProjectName(originalItem: string, result: GTDProcessingResult): Promise<string> {
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
