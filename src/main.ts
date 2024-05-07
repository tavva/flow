import { Notice, Plugin, ItemView, WorkspaceLeaf, TFile } from "obsidian";

import { ObsidianGTDSettingsTab } from "./settings";

export const PROCESS_INBOXES_VIEW = "process-inboxes-view";

interface ObsidianGTDSettings {
	inboxFilePath: string;
}

const DEFAULT_SETTINGS: Partial<ObsidianGTDSettings> = {
	inboxFilePath: "inbox.md",
};

export default class ObsidianGTDPlugin extends Plugin {
	settings: ObsidianGTDSettings;

	async onload() {
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

	async onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async processInboxes(): void {
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

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}
}

export class ProcessInboxesView extends ItemView {
	constructor(leaf: WorkspaceLeaf, plugin: ObsidianGTDPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return PROCESS_INBOXES_VIEW;
	}

	getDisplayText() {
		return "Process inboxes view";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h4", { text: "Process inboxes view" });

		const inboxFilePath = this.plugin.settings.inboxFile;
		const inboxFile = await this.openFile(inboxFilePath);

		const lineCount = await this.countLinesInFile(inboxFile);
		if (lineCount === -1) {
			container.createEl("p", {
				text: `Failed to read inbox file: ${inboxFilePath}`,
			});
			return;
		}
		container.createEl("p", { text: `Inbox file: ${inboxFilePath}` });
		container.createEl("p", { text: `Lines in inbox: ${lineCount}` });

		console.log(`Opened inbox file: ${inboxFilePath}`);
		const inboxFileContent = await this.plugin.app.vault.read(inboxFile);
		console.log(`Inbox file content: ${inboxFileContent}`);
	}

	async openFile(filePath: string): Promise<TFile> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (file && file instanceof TFile) {
				return file;
			} else {
				console.error(`File not found: ${filePath}`);
				return null;
			}
		} catch (e) {
			console.error(`Failed to read file: ${filePath}`, e);
			return null;
		}
	}

	async countLinesInFile(file: TFile): Promise<number> {
		const fileContent = await this.plugin.app.vault.read(file);
		return fileContent.split(/\r?\n/).length;
	}

	async onClose() {}
}
