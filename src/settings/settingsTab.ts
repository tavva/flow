import { App, PluginSettingTab, Setting } from 'obsidian'
import FlowPlugin from '../main'
import { FolderSuggest } from './suggesters/FolderSuggester'
import { FileSuggest } from './suggesters/FileSuggester'

export class FlowSettingsTab extends PluginSettingTab {
	plugin: FlowPlugin

	constructor(app: App, plugin: FlowPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('Inbox File Path')
			.setDesc('Path to the Inbox file')
			.addSearch((cb) => {
				new FileSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Inbox.md')
					.setValue(this.plugin.settings.inboxFilePath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFilePath = value
						this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('Inbox Folder Path')
			.setDesc('Path to the Inbox folder')
			.addSearch((cb) => {
				new FolderSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Inbox')
					.setValue(this.plugin.settings.inboxFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFolderPath = value
						this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('Next Actions File Path')
			.setDesc('Path to the Next Actions file')
			.addSearch((cb) => {
				new FileSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Next Actions.md')
					.setValue(this.plugin.settings.nextActionsFilePath)
					.onChange(async (value) => {
						this.plugin.settings.nextActionsFilePath = value
						await this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('New Project Template File Path')
			.setDesc('Path to the New Project Template File')
			.addSearch((cb) => {
				new FileSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: templates/Project.md')
					.setValue(this.plugin.settings.newProjectTemplateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.newProjectTemplateFilePath = value
						await this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('Projects Folder Path')
			.setDesc('Path to the Projects Folder')
			.addSearch((cb) => {
				new FolderSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Projects')
					.setValue(this.plugin.settings.projectsFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.projectsFolderPath = value
						this.plugin.saveSettings()
					})
			})

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
