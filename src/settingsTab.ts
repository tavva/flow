import { App, PluginSettingTab, Setting } from 'obsidian'
import FlowPlugin from './main'

export class FlowSettingsTab extends PluginSettingTab {
	plugin: FlowPlugin

	constructor(app: App, plugin: FlowPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		containerEl.createEl('h2', { text: 'Flow Plugin Settings' })

		new Setting(containerEl)
			.setName('Inbox File Path')
			.setDesc('Path to the Inbox file')
			.addText((text) =>
				text
					.setPlaceholder('Enter path to Inbox file')
					.setValue(this.plugin.settings.inboxFilePath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFilePath = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Email Inbox Folder Path')
			.setDesc('Path to the Email Inbox folder')
			.addText((text) =>
				text
					.setPlaceholder('Enter path to Email Inbox folder')
					.setValue(this.plugin.settings.emailInboxFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.emailInboxFolderPath = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Next Actions File Path')
			.setDesc('Path to the Next Actions file')
			.addText((text) =>
				text
					.setPlaceholder('Enter path to Next Actions file')
					.setValue(this.plugin.settings.nextActionsFilePath)
					.onChange(async (value) => {
						this.plugin.settings.nextActionsFilePath = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('New Project Template File Path')
			.setDesc('Path to the New Project Template File')
			.addText((text) =>
				text
					.setPlaceholder('Enter path to New Project Template file')
					.setValue(this.plugin.settings.newProjectTemplateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.newProjectTemplateFilePath = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Projects Folder Path')
			.setDesc('Path to the Projects Folder')
			.addText((text) =>
				text
					.setPlaceholder('Enter path to Projects Folder')
					.setValue(this.plugin.settings.projectsFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.projectsFolderPath = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Append to task')
			.setDesc('Text (such as a #tag) to append to tasks')
			.addText((text) =>
				text
					.setPlaceholder('Enter text to append to tasks')
					.setValue(this.plugin.settings.appendTask)
					.onChange(async (value) => {
						this.plugin.settings.appendTask = value
						await this.plugin.saveSettings()
					}),
			)
	}
}
