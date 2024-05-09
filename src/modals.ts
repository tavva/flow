import { App, Modal, Setting } from "obsidian";
import { getFilesWithTagPrefix } from "./utils";

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
				const selectedProject = openProjectModalForSelection(app);

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
		this.app = app;
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

export function openProjectModalForSelection(app: App): TFile | null {
	const projectFiles: TFile[] = getFilesWithTagPrefix(app, "project");
	console.log(`Found ${projectFiles.length} project files.`);
	const projectModal = new SelectProjectModal(app, projectFiles);
	projectModal.open();

	await new Promise((resolve) => {
		projectModal.onClose = resolve;
	});

	return projectModal.getSelectedProject();
}
