import { App, Modal, Setting, TFile } from "obsidian";

import { openFile } from "./utils";

export interface UserActionResult {
	action: "trash" | "addToProject" | "addToNextActions";
	editedLine: string;
	selectedProject?: string;
}

export class ProcessLineModal extends Modal {
	originalLine: string;
	result: UserActionResult | null = null;

	constructor(app: App, originalLine: string) {
		super(app);
		this.originalLine = originalLine;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h4", { text: "Process Inbox Line" });

		let editedLine = this.originalLine;

		new Setting(contentEl).setName("Edit line").addText((text) =>
			text.setValue(this.originalLine).onChange((value) => {
				editedLine = value;
			}),
		);

		new Setting(contentEl).setName("Add to project").addButton((button) =>
			button.setButtonText("Select").onClick(() => {
				this.result = {
					action: "addToProject",
					editedLine,
					selectedProject: "", // You'd ideally use another modal to select the project here
				};
				this.close();
			}),
		);

		new Setting(contentEl)
			.setName("Add to general next actions")
			.addButton((button) =>
				button.setButtonText("Add").onClick(() => {
					this.result = {
						action: "addToNextActions",
						editedLine,
					};
					this.close();
				}),
			);

		new Setting(contentEl).setName("Trash").addButton((button) =>
			button.setButtonText("Trash").onClick(() => {
				this.result = { action: "trash", editedLine };
				this.close();
			}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export async function processInboxFile(app: App, inboxFilePath: string) {
	console.log(`Processing inbox file: ${inboxFilePath}`);
	file = await openFile(app, inboxFilePath);
	console.log(`File: ${file}`);
	console.log(`App: ${app}`);
	let fileContent = await app.vault.read(file);
	console.log(`File content: ${fileContent}`);

	let lines = fileContent.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];

		if (line.trim() === "") {
			continue; // Skip empty lines
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
				await addToNextActions(app, result.editedLine);
				lines[i] = "";
				break;
		}

		// Update the file progressively to maintain an accurate state
		fileContent = lines.filter(Boolean).join("\n");
		await app.vault.modify(file, fileContent);
	}
}

async function addToProject(app: App, projectFilePath: string, line: string) {
	const file = app.vault.getAbstractFileByPath(projectFilePath);
	if (file && file instanceof TFile) {
		const fileContent = await app.vault.read(file);

		// Find the "## Next actions" section or append to the end
		const nextActionsIndex = fileContent.indexOf("## Next actions");
		let newContent = fileContent;
		if (nextActionsIndex !== -1) {
			// Insert after "## Next actions"
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

		// Write back the updated content
		await app.vault.modify(file, newContent);
	} else {
		console.error(`Project file not found: ${projectFilePath}`);
	}
}

async function addToNextActions(app: App, line: string) {
	const nextActionsFilePath = "next_actions.md";
	const file = app.vault.getAbstractFileByPath(nextActionsFilePath);
	if (file && file instanceof TFile) {
		const fileContent = await app.vault.read(file);
		const newContent = fileContent + "\n- " + line;
		await app.vault.modify(file, newContent);
	} else {
		// Create the file if it doesn't exist
		await app.vault.create(nextActionsFilePath, "- " + line);
	}
}
