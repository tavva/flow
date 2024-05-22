import { App, PluginSettingTab, Setting } from 'obsidian'
import GTDPlugin from './main'

class GTDSettingsTab extends PluginSettingTab {
	plugin: GTDPlugin

	constructor(app: App, plugin: GTDPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		containerEl.createEl('h2', { text: 'GTD Plugin Settings' })

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
	}
}

export default GTDSettingsTab
