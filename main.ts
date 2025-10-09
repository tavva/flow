import { App, Plugin, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/types';
import { FlowGTDSettingTab } from './src/settings-tab';
import { InboxProcessingModal } from './src/inbox-modal';

type InboxCommandConfig = {
	id: string;
	name: string;
	includeDefaultInbox?: boolean;
};

export default class FlowGTDCoachPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('inbox', 'Flow GTD: Process Inbox', () => {
			this.openInboxModal();
		});

		const inboxCommands: InboxCommandConfig[] = [
			{ id: 'process-inbox', name: 'Process Inbox' },
			{ id: 'quick-capture', name: 'Quick Capture' },
			{ id: 'process-inbox-folders', name: 'Process Inbox Folders', includeDefaultInbox: true }
		];

		inboxCommands.forEach(config => this.registerInboxCommand(config));

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

	private registerInboxCommand(config: InboxCommandConfig) {
		this.addCommand({
			id: config.id,
			name: config.name,
			callback: () => {
				this.openInboxModal(config.includeDefaultInbox);
			}
		});
	}

	private openInboxModal(includeDefaultInbox: boolean = false) {
		if (!this.hasRequiredApiKey()) {
			new Notice(this.getMissingApiKeyMessage());
			return;
		}

		const modal = new InboxProcessingModal(this.app, this.settings, includeDefaultInbox);
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
