import { Notice, Plugin, WorkspaceLeaf, TFile } from "obsidian";

import {
	ObsidianGTDSettings,
	DEFAULT_SETTINGS,
	ObsidianGTDSettingsTab,
} from "./settings";

import { openFile } from "./utils";
import { ProcessInboxesView, PROCESS_INBOXES_VIEW } from "./views";
import { processInboxFile } from "./process";

export default class ObsidianGTDPlugin extends Plugin {
	settings: ObsidianGTDSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ObsidianGTDSettingsTab(this.app, this));

		this.registerView(
			PROCESS_INBOXES_VIEW,
			(leaf) => new ProcessInboxesView(leaf, this),
		);

		this.addCommand({
			id: "process-inboxes",
			name: "Process inboxes",
			callback: this.processInboxes.bind(this),
		});
	}

	async onunload(): Promise<void> {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async processInboxes(): Promise<void> {
		console.log("Processing inboxes...");
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(PROCESS_INBOXES_VIEW);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({
				type: PROCESS_INBOXES_VIEW,
				active: true,
			});
		}

		processInboxFile(this, this.settings.inboxFilePath);

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}
}
