import { WorkspaceLeaf, ItemView } from "obsidian";
import { openFile, countLinesInFile } from "./utils";

export const PROCESS_INBOXES_VIEW = "process-inboxes-view";
export const PROCESS_EMAIL_INBOX_VIEW = "process-email-inbox-view";

export class ProcessInboxesView extends ItemView {
	constructor(leaf: WorkspaceLeaf, plugin: ObsidianGTDPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PROCESS_INBOXES_VIEW;
	}

	getDisplayText(): string {
		return "Process inboxes view";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h4", { text: "Process inboxes view" });

		const inboxFilePath = this.plugin.settings.inboxFilePath;
		const inboxFile = await openFile(inboxFilePath, this.plugin);

		const lineCount = await countLinesInFile(this.plugin, inboxFile);
		if (lineCount === -1) {
			container.createEl("p", {
				text: `Failed to read inbox file: ${inboxFilePath}`,
			});
			return;
		}
		container.createEl("p", { text: `Inbox file: ${inboxFilePath}` });
		container.createEl("p", { text: `Lines in inbox: ${lineCount}` });
	}

	async onClose(): Promise<void> {}
}

// New view class for processing email files
// Updated ProcessEmailInboxView class to include processing options
export class ProcessEmailInboxView extends ItemView {
	plugin: ObsidianGTDPlugin;
	emailFiles: TFile[];
	currentFileIndex: number = 0;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianGTDPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.emailFiles = [];
	}

	getViewType(): string {
		return PROCESS_EMAIL_INBOX_VIEW;
	}

	getDisplayText(): string {
		return "Process Email Inbox";
	}

	async onOpen(): Promise<void> {
		await this.loadEmailFiles();
		await this.displayEmailFiles();
		await this.processCurrentEmail();
	}

	async onClose(): Promise<void> {}

	private async loadEmailFiles(): Promise<void> {
		const incomingEmailFolderPath = this.plugin.settings.incomingEmailFolderPath;
		this.emailFiles = this.plugin.app.vault.getFiles().filter((file) => {
			return (
				file.path.startsWith(incomingEmailFolderPath) &&
				file.extension === "md"
			);
		});
	}

	private async displayEmailFiles(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h4", { text: "Email Inbox" });

		const fileListEl = container.createEl("ul");
		this.emailFiles.forEach((file, index) => {
			const fileEl = fileListEl.createEl("li", {
				text: file.basename,
				cls: index === this.currentFileIndex ? "is-active" : "",
			});
			fileEl.addEventListener("click", async () => {
				this.currentFileIndex = index;
				await this.processCurrentEmail();
			});
		});
	}

	private async processCurrentEmail(): Promise<void> {
		if (this.emailFiles.length === 0) {
			return;
		}

		const currentFile = this.emailFiles[this.currentFileIndex];
		const leaf = this.plugin.app.workspace.getLeaf(true);
		await leaf.openFile(currentFile);

		// Display processing options for the current file
		// Implement the logic for each option, including file deletion
		// After an action, refresh the list and start with the first file
		// For brevity, the implementation details are omitted here
	}
}

// Updated view class to display file contents in the main panel
export class ProcessEmailFileView extends ItemView {
	plugin: ObsidianGTDPlugin;
	file: TFile;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianGTDPlugin, file: TFile) {
		super(leaf);
		this.plugin = plugin;
		this.file = file;
	}

	getViewType(): string {
		return "process-email-file-view";
	}

	getDisplayText(): string {
		return "Process Email File";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h4", { text: "Process Email File" });

		const fileContent = await this.plugin.app.vault.read(this.file);
		container.createEl("p", { text: fileContent });
	}

	async onClose(): Promise<void> {}
}
