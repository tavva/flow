import { App, Modal, Setting, TFile } from "obsidian";

import { openFile, getFilesWithTagPrefix } from "./utils";
import { ProcessLineModal, ProcessFileModal } from "./modals";
import { PROCESS_EMAIL_INBOX_VIEW } from "./views";

export interface UserActionResult {
	action: "trash" | "addToProject" | "addToNextActions";
	editedLine: string;
	selectedProject?: string;
}

export async function processInboxFile(
	plugin: ObsidianGTDPlugin,
): Promise<void> {
	const inboxFilePath = plugin.settings.inboxFilePath;
	file = await openFile(inboxFilePath, plugin);
	let fileContent = await plugin.app.vault.read(file);

	let lines = fileContent.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];

		if (line.trim() === "") {
			continue;
		}

		const modal = new ProcessLineModal(app, line);
		modal.open();

		await new Promise((resolve) => {
			modal.onClose = resolve;
		});

		const result = modal.result;
		if (!result) {
			// The user didn't select anything; keep the original line
			continue;
		}

		switch (result.action) {
			case "trash":
				lines[i] = "";
				break;

			case "addToProject":
				if (result.selectedProject) {
					await addToProject(
						app,
						result.selectedProject,
						result.editedLine,
					);
					lines[i] = "";
				}
				break;

			case "addToNextActions":
				await addToNextActions(plugin, result.editedLine);
				lines[i] = "";
				break;
		}

		// Update the file progressively to maintain an accurate state
		fileContent = lines.filter(Boolean).join("\n");
		await app.vault.modify(file, fileContent);
	}
}

export async function processEmailInbox(
	plugin: ObsidianGTDPlugin,
): Promise<void> {
	const incomingEmailFolderPath = plugin.settings.incomingEmailFolderPath;
	const folderFiles = plugin.app.vault.getFiles().filter((file) => {
		return (
			file.path.startsWith(incomingEmailFolderPath) &&
			file.extension === "md"
		);
	});

	if (folderFiles.length > 0) {
		const firstFile = folderFiles[0];
		const leaf = plugin.app.workspace.getLeaf(true);
		await leaf.openFile(firstFile);
		await plugin.app.workspace.getRightLeaf(false).setViewState({
			type: PROCESS_EMAIL_INBOX_VIEW,
			state: { file: firstFile },
			active: true,
		});
	}
}

async function addToProject(
	app: App,
	projectFilePath: string,
	line: string,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(projectFilePath);
	line = `[ ] ${line}`;

	if (file && file instanceof TFile) {
		const fileContent = await app.vault.read(file);

		// Find the "## Next actions" section or append to the end
		const nextActionsIndex = fileContent.indexOf("## Next actions");
		let newContent = fileContent;

		if (nextActionsIndex !== -1) {
			const insertionIndex =
				nextActionsIndex + "## Next actions".length + 1;
			newContent =
				newContent.slice(0, insertionIndex) +
				"\n- " +
				line +
				newContent.slice(insertionIndex);
		} else {
			// Append to the end of the file
			newContent += "\n## Next actions\n- " + line;
		}

		await app.vault.modify(file, newContent);
	} else {
		console.error(`Project file not found: ${projectFilePath}`);
	}
}

export async function addToNextActions(
	plugin: ObsidianGTDPlugin,
	line: string,
): Promise<void> {
	const nextActionsFilePath = plugin.settings.nextActionsFilePath;
	const file = app.vault.getAbstractFileByPath(nextActionsFilePath);
	if (file && file instanceof TFile) {
		const fileContent = await plugin.app.vault.read(file);
		const newContent = fileContent + "\n- " + line;
		await plugin.app.vault.modify(file, newContent);
	} else {
		await plugin.app.vault.create(nextActionsFilePath, "- " + line);
	}
}
