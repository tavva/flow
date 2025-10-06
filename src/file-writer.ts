import { App, TFile, normalizePath } from 'obsidian';
import { FlowProject, GTDProcessingResult, PluginSettings } from './types';

export class FileWriter {
	constructor(
		private app: App,
		private settings: PluginSettings
	) {}

	/**
	 * Create a new Flow project file
	 */
	async createProject(
		result: GTDProcessingResult,
		originalItem: string,
		spheres: string[] = []
	): Promise<TFile> {
		const fileName = this.generateFileName(result.projectOutcome || originalItem);
                const folderPath = normalizePath(this.settings.projectsFolderPath);
                await this.ensureFolderExists(folderPath);
                const filePath = normalizePath(`${folderPath}/${fileName}.md`);

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		if (existingFile) {
			throw new Error(`File ${filePath} already exists`);
		}

                const content = this.buildProjectContent(result, originalItem, spheres);
                const file = await this.app.vault.create(filePath, content);

                return file;
        }

        private async ensureFolderExists(folderPath: string): Promise<void> {
                const normalizedPath = normalizePath(folderPath);
                const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

                if (existing) {
                        return;
                }

                const lastSlashIndex = normalizedPath.lastIndexOf('/');
                if (lastSlashIndex > 0) {
                        const parentPath = normalizedPath.slice(0, lastSlashIndex);
                        await this.ensureFolderExists(parentPath);
                }

                await this.app.vault.createFolder(normalizedPath);
        }

	/**
	 * Add an action to the Next Actions file
	 */
	async addToNextActionsFile(action: string, spheres: string[] = []): Promise<void> {
		const sphereTags = spheres.map(s => `#sphere/${s}`).join(' ');
		const content = sphereTags ? `- [ ] ${action} ${sphereTags}` : `- [ ] ${action}`;
		await this.appendToFile(this.settings.nextActionsFilePath, content);
	}

	/**
	 * Add an item to the Someday/Maybe file
	 */
	async addToSomedayFile(item: string, spheres: string[] = []): Promise<void> {
		const sphereTags = spheres.map(s => `#sphere/${s}`).join(' ');
		const content = sphereTags ? `- ${item} ${sphereTags}` : `- ${item}`;
		await this.appendToFile(this.settings.somedayFilePath, content);
	}

	/**
	 * Append content to a file, creating it if it doesn't exist
	 */
	private async appendToFile(filePath: string, content: string): Promise<void> {
		const normalizedPath = normalizePath(filePath);
		let file = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!file) {
			// Create the file if it doesn't exist
			file = await this.app.vault.create(normalizedPath, content + '\n');
		} else if (file instanceof TFile) {
			// Append to existing file
			const existingContent = await this.app.vault.read(file);
			const newContent = existingContent.trim() + '\n' + content + '\n';
			await this.app.vault.modify(file, newContent);
		} else {
			throw new Error(`${filePath} is not a file`);
		}
	}

	/**
	 * Add a next action to an existing project
	 */
	async addNextActionToProject(
		project: FlowProject,
		action: string,
		isFuture: boolean = false
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(project.file);
		if (!(file instanceof TFile)) {
			throw new Error(`Project file not found: ${project.file}`);
		}

		const content = await this.app.vault.read(file);
		const sectionName = isFuture ? '## Future next actions' : '## Next actions';
		const updatedContent = this.addActionToSection(content, sectionName, action);

		await this.app.vault.modify(file, updatedContent);
	}

	/**
	 * Generate a clean file name from project title
	 */
	private generateFileName(title: string): string {
		return title
			.replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
			.replace(/\s+/g, ' ') // Normalize spaces
			.trim()
			.replace(/\s/g, '-'); // Replace spaces with hyphens
	}

	/**
	 * Build the content for a new project file
	 */
	private buildProjectContent(
		result: GTDProcessingResult,
		originalItem: string,
		spheres: string[] = []
	): string {
		const date = this.formatDate(new Date());
		const title = result.projectOutcome || originalItem;

		// Format sphere tags (e.g., "project/personal project/work")
		const sphereTags = spheres.length > 0
			? spheres.map(s => `project/${s}`).join(' ')
			: 'project/personal';

		let content = `---
creation-date: ${date}
priority: ${this.settings.defaultPriority}
tags: ${sphereTags}
status: ${this.settings.defaultStatus}
---

# ${title}

${result.reasoning}

## Next actions
- [ ] ${result.nextAction}

## Future next actions
`;

		if (result.futureActions && result.futureActions.length > 0) {
			content += result.futureActions.map(action => `- [ ] ${action}`).join('\n');
		}

		return content;
	}

	/**
	 * Add an action item to a specific section
	 */
	private addActionToSection(
		content: string,
		sectionHeading: string,
		action: string
	): string {
		const lines = content.split('\n');
		const sectionIndex = this.findSectionIndex(lines, sectionHeading);

		if (sectionIndex === -1) {
			// Section doesn't exist, create it at the end
			return this.createSectionWithAction(content, sectionHeading, action);
		}

		// Find where to insert the action (after the heading, before next section)
		let insertIndex = sectionIndex + 1;

		// Skip any empty lines after the heading
		while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
			insertIndex++;
		}

		// Insert the action
		lines.splice(insertIndex, 0, `- [ ] ${action}`);

		return lines.join('\n');
	}

	/**
	 * Find the index of a section heading
	 */
	private findSectionIndex(lines: string[], heading: string): number {
		const normalizedHeading = heading.replace(/^#+\s+/, '').trim();

		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
			if (match && match[2].trim() === normalizedHeading) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Create a new section with an action when section doesn't exist
	 */
	private createSectionWithAction(
		content: string,
		sectionHeading: string,
		action: string
	): string {
		// Add section at the end of the file
		let newContent = content.trim();

		if (!newContent.endsWith('\n')) {
			newContent += '\n';
		}

		newContent += `\n${sectionHeading}\n- [ ] ${action}\n`;

		return newContent;
	}

	/**
	 * Format a date for Flow frontmatter (YYYY-MM-DD HH:mm)
	 */
	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	/**
	 * Update project frontmatter tags
	 */
	async updateProjectTags(
		project: FlowProject,
		newTags: string[]
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(project.file);
		if (!(file instanceof TFile)) {
			throw new Error(`Project file not found: ${project.file}`);
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Ensure all project tags are preserved
			const existingTags = Array.isArray(frontmatter.tags)
				? frontmatter.tags
				: [frontmatter.tags];

			const projectTags = existingTags.filter((tag: string) => tag.startsWith('project/'));
			const otherTags = existingTags.filter((tag: string) => !tag.startsWith('project/'));

			frontmatter.tags = [...new Set([...projectTags, ...newTags, ...otherTags])];
		});
	}
}
