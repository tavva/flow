import { App, TFile, normalizePath } from "obsidian";
import {
  FlowProject,
  GTDProcessingResult,
  PluginSettings,
  PersonNote,
} from "./types";
import { GTDResponseValidationError } from "./errors";

export class FileWriter {
  constructor(
    private app: App,
    private settings: PluginSettings,
  ) {}

  /**
   * Create a new Flow project file
   */
  async createProject(
    result: GTDProcessingResult,
    originalItem: string,
    spheres: string[] = [],
  ): Promise<TFile> {
    if (!result.nextAction || result.nextAction.trim().length === 0) {
      throw new GTDResponseValidationError(
        "Cannot create a project without a defined next action.",
      );
    }

    if (!result.reasoning || result.reasoning.trim().length === 0) {
      throw new GTDResponseValidationError(
        "Cannot create a project without supporting reasoning.",
      );
    }

    const fileName = this.generateFileName(
      result.projectOutcome || originalItem,
    );
    const folderPath = normalizePath(this.settings.projectsFolderPath);
    await this.ensureFolderExists(folderPath);
    const filePath = normalizePath(`${folderPath}/${fileName}.md`);

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      throw new Error(`File ${filePath} already exists`);
    }

    const content = await this.buildProjectContent(result, originalItem, spheres);
    const file = await this.app.vault.create(filePath, content);

    return file;
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (existing) {
      return;
    }

    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    if (lastSlashIndex > 0) {
      const parentPath = normalizedPath.slice(0, lastSlashIndex);
      await this.ensureFolderExists(parentPath);
    }

    await this.app.vault.createFolder(normalizedPath);
  }

  /**
   * Add an action to the Next Actions file
   */
  async addToNextActionsFile(
    actions: string | string[],
    spheres: string[] = [],
  ): Promise<void> {
    const actionsArray = Array.isArray(actions) ? actions : [actions];
    const sphereTags = spheres.map((s) => `#sphere/${s}`).join(" ");

    for (const action of actionsArray) {
      const content = sphereTags
        ? `- [ ] ${action} ${sphereTags}`
        : `- [ ] ${action}`;
      await this.appendToFile(this.settings.nextActionsFilePath, content);
    }
  }

  /**
   * Add an item to the Someday/Maybe file
   */
  async addToSomedayFile(item: string, spheres: string[] = []): Promise<void> {
    const sphereTags = spheres.map((s) => `#sphere/${s}`).join(" ");
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
      file = await this.app.vault.create(normalizedPath, content + "\n");
    } else if (file instanceof TFile) {
      // Append to existing file
      const existingContent = await this.app.vault.read(file);
      const newContent = existingContent.trim() + "\n" + content + "\n";
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
    actions: string | string[],
    isFuture: boolean = false,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project.file}`);
    }

    const actionsArray = Array.isArray(actions) ? actions : [actions];
    let content = await this.app.vault.read(file);

    for (const action of actionsArray) {
      const sectionName = isFuture
        ? "## Future next actions"
        : "## Next actions";
      content = this.addActionToSection(content, sectionName, action);
    }

    await this.app.vault.modify(file, content);
  }

  /**
   * Add reference content to an existing project
   */
  async addReferenceToProject(
    project: FlowProject,
    referenceContent: string,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project.file}`);
    }

    let content = await this.app.vault.read(file);
    const sectionName = "## Notes + resources";
    content = this.addContentToSection(content, sectionName, referenceContent);

    await this.app.vault.modify(file, content);
  }

  /**
   * Add an item to the "## Discuss next" section of a person note
   */
  async addToPersonDiscussNext(
    person: PersonNote,
    item: string,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(person.file);
    if (!(file instanceof TFile)) {
      throw new Error(`Person file not found: ${person.file}`);
    }

    let content = await this.app.vault.read(file);
    const sectionName = "## Discuss next";
    content = this.addActionToSection(content, sectionName, item);

    await this.app.vault.modify(file, content);
  }

  /**
   * Generate a clean file name from project title
   */
  private generateFileName(title: string): string {
    const cleaned = title
      .replace(/[\\/:*?"<>|]/g, "") // Remove filesystem-problematic chars
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()
      .replace(/\.+$/, ""); // Drop trailing dots that Windows forbids

    return cleaned.length > 0 ? cleaned : "Project";
  }

  /**
   * Build the content for a new project file using template
   */
  private async buildProjectContent(
    result: GTDProcessingResult,
    originalItem: string,
    spheres: string[] = [],
  ): Promise<string> {
    const templateFile = this.app.vault.getAbstractFileByPath(
      this.settings.projectTemplateFilePath,
    );

    if (!templateFile || !(templateFile instanceof TFile)) {
      // Fallback to hardcoded template if template file doesn't exist
      return this.buildProjectContentFallback(result, originalItem, spheres);
    }

    let templateContent = await this.app.vault.read(templateFile);

    // Parse template variables
    const date = this.formatDate(new Date());
    const sphereTags =
      spheres.length > 0
        ? spheres.map((s) => `project/${s}`).join(" ")
        : "project/personal";

    // Replace template variables
    templateContent = templateContent
      .replace(/{{\s*priority\s*}}/g, this.settings.defaultPriority.toString())
      .replace(/{{\s*sphere\s*}}/g, sphereTags)
      .replace(/{{\s*description\s*}}/g, result.reasoning || originalItem);

    // Handle Templater syntax for creation date (if Templater is not available, use our date)
    if (templateContent.includes('<% tp.date.now("YYYY-MM-DD HH:mm") %>')) {
      templateContent = templateContent.replace(
        /<% tp\.date\.now\("YYYY-MM-DD HH:mm"\) %>/g,
        date
      );
    }

    // Add next actions to the template
    let content = templateContent;

    // Find the "## Next actions" section and add the actions
    const nextActionsRegex = /(## Next actions\s*\n)/;
    const match = content.match(nextActionsRegex);

    if (match) {
      let actionsText = "";
      if (result.nextActions && result.nextActions.length > 0) {
        actionsText = result.nextActions.map((action) => `- [ ] ${action}`).join("\n") + "\n";
      } else if (result.nextAction) {
        actionsText = `- [ ] ${result.nextAction}\n`;
      }

      content = content.replace(nextActionsRegex, `$1${actionsText}`);
    }

    // Add future actions if any
    if (result.futureActions && result.futureActions.length > 0) {
      const futureActionsRegex = /(## Future next actions\s*\n)/;
      const futureMatch = content.match(futureActionsRegex);

      if (futureMatch) {
        const futureActionsText = result.futureActions
          .map((action) => `- [ ] ${action}`)
          .join("\n") + "\n";
        content = content.replace(futureActionsRegex, `$1${futureActionsText}`);
      }
    }

    return content;
  }

  /**
   * Fallback method for building project content when template file is not available
   */
  private buildProjectContentFallback(
    result: GTDProcessingResult,
    originalItem: string,
    spheres: string[] = [],
  ): string {
    const date = this.formatDate(new Date());
    const title = result.projectOutcome || originalItem;

    // Format sphere tags (e.g., "project/personal project/work")
    const sphereTags =
      spheres.length > 0
        ? spheres.map((s) => `project/${s}`).join(" ")
        : "project/personal";

    let content = `---
creation-date: ${date}
priority: ${this.settings.defaultPriority}
tags: ${sphereTags}
status: ${this.settings.defaultStatus}
---

# Description

${result.reasoning}

## Focus areas

## Next actions
`;

    // Handle multiple next actions or single next action
    if (result.nextActions && result.nextActions.length > 0) {
      content +=
        result.nextActions.map((action) => `- [ ] ${action}`).join("\n") + "\n";
    } else {
      content += `- [ ] ${result.nextAction}\n`;
    }

    content += `
## Future next actions
`;

    if (result.futureActions && result.futureActions.length > 0) {
      content += result.futureActions
        .map((action) => `- [ ] ${action}`)
        .join("\n");
    }

    content += `

## Notes + resources

## Focus areas detail

## Log
`;

    return content;
  }

  /**
   * Add an action item to a specific section
   */
  private addActionToSection(
    content: string,
    sectionHeading: string,
    action: string,
  ): string {
    const lines = content.split("\n");
    const sectionIndex = this.findSectionIndex(lines, sectionHeading);

    if (sectionIndex === -1) {
      // Section doesn't exist, create it at the end
      return this.createSectionWithAction(content, sectionHeading, action);
    }

    // Find where to insert the action (after the heading, before next section)
    let insertIndex = sectionIndex + 1;

    // Skip any empty lines after the heading
    while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
      insertIndex++;
    }

    // Insert the action
    lines.splice(insertIndex, 0, `- [ ] ${action}`);

    return lines.join("\n");
  }

  /**
   * Add content to a specific section
   */
  private addContentToSection(
    content: string,
    sectionHeading: string,
    newContent: string,
  ): string {
    const lines = content.split("\n");
    const sectionIndex = this.findSectionIndex(lines, sectionHeading);

    if (sectionIndex === -1) {
      // Section doesn't exist, create it at the end
      return this.createSectionWithContent(content, sectionHeading, newContent);
    }

    // Find where to insert the content (after the heading, before next section)
    let insertIndex = sectionIndex + 1;

    // Skip any empty lines after the heading
    while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
      insertIndex++;
    }

    // Insert the content (split into lines if it contains newlines)
    const contentLines = newContent.split("\n");
    lines.splice(insertIndex, 0, ...contentLines);

    return lines.join("\n");
  }

  /**
   * Find the index of a section heading
   */
  private findSectionIndex(lines: string[], heading: string): number {
    const normalizedHeading = heading.replace(/^#+\s+/, "").trim();

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
    action: string,
  ): string {
    // Add section at the end of the file
    let newContent = content.trim();

    if (!newContent.endsWith("\n")) {
      newContent += "\n";
    }

    newContent += `\n${sectionHeading}\n- [ ] ${action}\n`;

    return newContent;
  }

  /**
   * Create a new section with an item when section doesn't exist
   */
  private createSectionWithItem(
    content: string,
    sectionHeading: string,
    item: string,
  ): string {
    // Add section at the end of the file
    let newContent = content.trim();

    if (!newContent.endsWith("\n")) {
      newContent += "\n";
    }

    newContent += `\n${sectionHeading}\n- ${item}\n`;

    return newContent;
  }

  /**
   * Create a new section with content when section doesn't exist
   */
  private createSectionWithContent(
    content: string,
    sectionHeading: string,
    newContent: string,
  ): string {
    // Add section at the end of the file
    let fileContent = content.trim();

    if (!fileContent.endsWith("\n")) {
      fileContent += "\n";
    }

    fileContent += `\n${sectionHeading}\n${newContent}\n`;

    return fileContent;
  }

  /**
   * Format a date for Flow frontmatter (YYYY-MM-DD HH:mm)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Update project frontmatter tags
   */
  async updateProjectTags(
    project: FlowProject,
    newTags: string[],
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

      const projectTags = existingTags.filter((tag: string) =>
        tag.startsWith("project/"),
      );
      const otherTags = existingTags.filter(
        (tag: string) => !tag.startsWith("project/"),
      );

      frontmatter.tags = [
        ...new Set([...projectTags, ...newTags, ...otherTags]),
      ];
    });
  }
}
