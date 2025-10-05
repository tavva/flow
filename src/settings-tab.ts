import { App, PluginSettingTab, Setting } from 'obsidian';
import FlowGTDCoachPlugin from '../main';

export class FlowGTDSettingTab extends PluginSettingTab {
	plugin: FlowGTDCoachPlugin;

	constructor(app: App, plugin: FlowGTDCoachPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Flow GTD Coach Settings' });

		// Anthropic API Key
		new Setting(containerEl)
			.setName('Anthropic API Key')
			.setDesc('Enter your Anthropic API key to enable AI-powered GTD processing')
			.addText(text => text
				.setPlaceholder('sk-ant-...')
				.setValue(this.plugin.settings.anthropicApiKey)
				.onChange(async (value) => {
					this.plugin.settings.anthropicApiKey = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Get API Key')
				.onClick(() => {
					window.open('https://console.anthropic.com/settings/keys', '_blank');
				}));

		// Add info about API key
		containerEl.createDiv('setting-item-description').innerHTML = `
			<p>You can get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic Console</a>.</p>
			<p><strong>Note:</strong> Your API key is stored locally and never shared.</p>
		`;

		containerEl.createEl('h3', { text: 'Default Project Settings' });
		containerEl.createDiv('setting-item-description').innerHTML = `
			<p>These settings are used when creating new Flow projects.</p>
		`;

		// Default Priority
		new Setting(containerEl)
			.setName('Default Priority')
			.setDesc('Default priority level for new projects (1-5, where 1 is highest)')
			.addSlider(slider => slider
				.setLimits(1, 5, 1)
				.setValue(this.plugin.settings.defaultPriority)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.defaultPriority = value;
					await this.plugin.saveSettings();
				}));

		// Default Status
		new Setting(containerEl)
			.setName('Default Status')
			.setDesc('Default status for new projects')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'live': 'Live',
					'active': 'Active',
					'planning': 'Planning',
					'paused': 'Paused',
					'completed': 'Completed'
				})
				.setValue(this.plugin.settings.defaultStatus)
				.onChange(async (value) => {
					this.plugin.settings.defaultStatus = value;
					await this.plugin.saveSettings();
				}));

		// Inbox Settings
		containerEl.createEl('h3', { text: 'Inbox Settings' });
		containerEl.createDiv('setting-item-description').innerHTML = `
			<p>Configure inbox folders for processing. These match the Flow plugin's inbox settings.</p>
		`;

		// Line-at-a-time inbox
		new Setting(containerEl)
			.setName('Line at a time')
			.setDesc('Flow processes all lines in every note in this folder.')
			.addText(text => text
				.setPlaceholder('Flow Inbox Files')
				.setValue(this.plugin.settings.inboxFilesFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.inboxFilesFolderPath = value;
					await this.plugin.saveSettings();
				}));

		// Note-at-a-time inbox
		new Setting(containerEl)
			.setName('Note at a time')
			.setDesc('Flow processes entire notes one by one in this folder.')
			.addText(text => text
				.setPlaceholder('Flow Inbox Folder')
				.setValue(this.plugin.settings.inboxFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.inboxFolderPath = value;
					await this.plugin.saveSettings();
				}));

		// GTD Principles Info
		containerEl.createEl('h3', { text: 'GTD Principles' });
		const gtdInfo = containerEl.createDiv('flow-gtd-info');
		gtdInfo.innerHTML = `
			<p><strong>This plugin helps you implement GTD (Getting Things Done) methodology:</strong></p>
			<ul>
				<li><strong>Capture:</strong> Collect everything that has your attention</li>
				<li><strong>Clarify:</strong> Process what each item means and what to do about it</li>
				<li><strong>Organise:</strong> Put it where it belongs (projects, next actions, etc.)</li>
				<li><strong>Review:</strong> Look over your system regularly</li>
				<li><strong>Engage:</strong> Simply do what needs to be done</li>
			</ul>
			<p>This plugin focuses on the Capture, Clarify, and Organise steps, helping you process inbox items into well-formed projects and next actions.</p>
		`;
	}
}
