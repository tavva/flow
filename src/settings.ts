import { ObsidianGTDPlugin } from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface ObsidianGTDSettings {
	inboxFilePath: string;
}

export const DEFAULT_SETTINGS: Partial<ObsidianGTDSettings> = {
	inboxFilePath: "inbox.md",
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
	}
}
