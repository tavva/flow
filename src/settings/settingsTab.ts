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
			.setName('Append to task')
			.setDesc(
				`Flow will append this to all tasks it creates. This is useful
				if you use the Tasks plugin and have a global task filter set.`,
			)
			.addText((text) =>
				text
					.setPlaceholder('Enter text to append to tasks')
					.setValue(this.plugin.settings.appendTask)
					.onChange(async (value) => {
						this.plugin.settings.appendTask = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Spheres')
			.setDesc('A comma-separated list of spheres.')
			.addText((text) =>
				text
					.setPlaceholder('Enter spheres')
					.setValue(this.plugin.settings.spheres.join(','))
					.onChange(async (value) => {
						if (!value.trim()) {
							text.setValue(
								this.plugin.settings.spheres.join(','),
							)
							return
						}

						this.plugin.settings.spheres = value
							.split(',')
							.map((sphere) => sphere.trim())
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl).setName('Inbox folders').setHeading()

		new Setting(containerEl)
			.setName('Line at a time')
			.setDesc(
				`Flow processes all lines in every file in this folder. We
				 allow multiple inbox files to help prevent syncing issues when
				 the inbox can be populated from many different sources.`,
			)
			.addSearch((cb) => {
				new FolderSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Inbox Files')
					.setValue(this.plugin.settings.inboxFilesFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFilesFolderPath = value
						this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('File at a time')
			.setDesc('Flow processes entire files one by one in this folder.')
			.addSearch((cb) => {
				new FolderSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: Inbox')
					.setValue(this.plugin.settings.inboxFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFolderPath = value
						this.plugin.saveSettings()
					})
			})

		new Setting(containerEl).setName('Your files').setHeading()

		new Setting(containerEl)
			.setName('Next actions')
			.setDesc(
				`This is where Flow will store Next Actions that aren't
				assigned to a project.`,
			)
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
			.setName('New project template')
			.setDesc('Flow will create new projects using this template.')
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
			.setName('Projects folder')
			.setDesc('This is where your project files are stored.')
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
			.setName('New person template')
			.setDesc('Flow will create new person files using this template.')
			.addSearch((cb) => {
				new FileSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: templates/Person.md')
					.setValue(this.plugin.settings.newPersonTemplateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.newPersonTemplateFilePath = value
						await this.plugin.saveSettings()
					})
			})

		new Setting(containerEl)
			.setName('People folder')
			.setDesc('This is where your people files are stored.')
			.addSearch((cb) => {
				new FolderSuggest(this.plugin, cb.inputEl)
				cb.setPlaceholder('Example: People')
					.setValue(this.plugin.settings.peopleFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.peopleFolderPath = value
						this.plugin.saveSettings()
					})
			})
	}
}
