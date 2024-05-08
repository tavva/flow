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

export class ProcessEmailInboxView extends ItemView {
	constructor(leaf: WorkspaceLeaf, plugin: ObsidianGTDPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PROCESS_EMAIL_INBOX_VIEW;
	}

	getDisplayText(): string {
		return "Process email inbox view";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h4", { text: "Process email inbox view" });
	}

	async onClose(): Promise<void> {}
}
