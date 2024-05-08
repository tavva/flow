import { ObsidianGTDPlugin } from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface ObsidianGTDSettings {
	inboxFilePath: string;
	nextActionsFilePath: string;
	incomingEmailFolderPath: string;
}

export const DEFAULT_SETTINGS: Partial<ObsidianGTDSettings> = {
	inboxFilePath: "Inbox.md",
	nextActionsFilePath: "Next actions.md",
	incomingEmailFolderPath: "Email inbox",
};

export class ObsidianGTDSettingsTab extends PluginSettingTab {
	plugin: ObsidianGTDPlugin;

	constructor(app: App, plugin: ObsidianGTDPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Inbox file")
			.setDesc("The file where our inbox items are stored")
			.addText((text) =>
				text
					.setPlaceholder("path/to/file.md")
					.setValue(this.plugin.settings.inboxFilePath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFilePath = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Next actions file")
			.setDesc("The file where next actions with no project are stored")
			.addText((text) =>
				text
					.setPlaceholder("path/to/file.md")
					.setValue(this.plugin.settings.nextActionsFilePath)
					.onChange(async (value) => {
						this.plugin.settings.nextActionsFilePath = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Incoming email folder")
			.setDesc("The folder where incoming email files are stored")
			.addText((text) =>
				text
					.setPlaceholder("path/to/folder")
					.setValue(this.plugin.settings.incomingEmailFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.incomingEmailFolderPath = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
