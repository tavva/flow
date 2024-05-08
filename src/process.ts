import { App, Modal, Setting, TFile } from "obsidian";

import { openFile, getFilesWithTagPrefix } from "./utils";

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

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h4", { text: "Process Inbox Line" });

		let editedLine = this.originalLine;

		new Setting(contentEl).setName("Edit line").addText((text) =>
			text.setValue(this.originalLine).onChange((value) => {
				editedLine = value;
			}),
		);

		new Setting(contentEl).setName("Add to project").addButton((button) =>
			button.setButtonText("Select").onClick(async () => {
				const projectFiles: TFile[] = getFilesWithTagPrefix(
					app,
					"project",
				);
				console.log(`Found ${projectFiles.length} project files.`);
				const projectModal = new SelectProjectModal(
					this.app,
					projectFiles,
				);
				projectModal.open();

				await new Promise((resolve) => {
					projectModal.onClose = resolve;
				});

				const selectedProject = projectModal.getSelectedProject();

				if (selectedProject) {
					this.result = {
						action: "addToProject",
						editedLine,
						selectedProject: selectedProject.path,
					};
				} else {
					console.error("No project was selected.");
				}

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

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class SelectProjectModal extends Modal {
	availableProjects: TFile[];
	selectedProject: TFile | null = null;

	constructor(app: App, projectFiles: TFile[]) {
		super(app);
		this.availableProjects = projectFiles;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h4", { text: "Select a Project" });

		this.availableProjects.forEach((projectFile) => {
			new Setting(contentEl)
				.setName(projectFile.basename)
				.setDesc(projectFile.path)
				.addButton((button) =>
					button.setButtonText("Select").onClick(() => {
						this.selectedProject = projectFile;
						this.close();
					}),
				);
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	getSelectedProject(): TFile | null {
		return this.selectedProject;
	}
}

async function selectProjectAndProcess(app: App): Promise<string | null> {
	const projectFiles: TFile[] = getFilesWithTagPrefix(app, "project");

	if (projectFiles.length === 0) {
		console.error("No project files found.");
		return null;
	}
	console.log(`Found ${projectFiles.length} project files.`);

	const modal = new SelectProjectModal(app, projectFiles);
	modal.open();

	await new Promise((resolve) => {
		modal.onClose = resolve;
	});

	const selectedProject = modal.getSelectedProject();
	return selectedProject ? selectedProject.path : null;
}

export async function processInboxFile(
	plugin: ObsidianGTDPlugin,
	inboxFilePath: string,
): Promise<void> {
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

async function addToNextActions(
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
