import { App, Plugin, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/types';
import { FlowGTDSettingTab } from './src/settings-tab';
import { InboxProcessingModal } from './src/inbox-modal';

export default class FlowGTDCoachPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('inbox', 'Flow GTD: Process Inbox', () => {
			this.openInboxModal();
		});

		// Add command for inbox processing
		this.addCommand({
			id: 'process-inbox',
			name: 'Process Inbox',
			callback: () => {
				this.openInboxModal();
			}
		});

		// Add command for quick capture
		this.addCommand({
			id: 'quick-capture',
			name: 'Quick Capture',
			callback: () => {
				this.openInboxModal();
			}
		});

		// Add command for processing inbox folders
		this.addCommand({
			id: 'process-inbox-folders',
			name: 'Process Inbox Folders',
			callback: () => {
				this.openInboxModalWithInbox();
			}
		});

		// Add settings tab
		this.addSettingTab(new FlowGTDSettingTab(this.app, this));

		console.log('Flow GTD Coach plugin loaded');
	}

	onunload() {
		console.log('Flow GTD Coach plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

        private openInboxModal() {
                if (!this.hasRequiredApiKey()) {
                        new Notice(this.getMissingApiKeyMessage());
                        return;
                }

                const modal = new InboxProcessingModal(this.app, this.settings);
                modal.open();
        }

        private openInboxModalWithInbox() {
                if (!this.hasRequiredApiKey()) {
                        new Notice(this.getMissingApiKeyMessage());
                        return;
                }

                const modal = new InboxProcessingModal(this.app, this.settings, true);
                modal.open();
        }

        private hasRequiredApiKey(): boolean {
                if (this.settings.llmProvider === 'openai-compatible') {
                        return Boolean(this.settings.openaiApiKey);
                }

                return Boolean(this.settings.anthropicApiKey);
        }

        private getMissingApiKeyMessage(): string {
                if (this.settings.llmProvider === 'openai-compatible') {
                        return 'Please set your OpenAI-compatible API key in the plugin settings first';
                }

                return 'Please set your Anthropic API key in the plugin settings first';
        }
}
