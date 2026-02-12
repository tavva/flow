import type { App } from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { FlowProject, GTDProcessingResult, PluginSettings, PersonNote } from "./types";
import { GTDResponseValidationError, FileNotFoundError, ValidationError } from "./errors";
import { EditableItem } from "./inbox-types";
import { sanitizeFileName } from "./validation";

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
    spheres: string[] = [],
    waitingFor: boolean[] = [],
    parentProject?: string,
    markAsDone: boolean[] = [],
    dueDate?: string,
    sourceNoteLink?: string
  ): Promise<TFile> {
    if (!result.nextAction || result.nextAction.trim().length === 0) {
      throw new GTDResponseValidationError(
        "Cannot create a project without a defined next action."
      );
    }

    if (!result.reasoning || result.reasoning.trim().length === 0) {
      throw new GTDResponseValidationError("Cannot create a project without supporting reasoning.");
    }

    const fileName = this.generateFileName(result.projectOutcome || originalItem);
    const folderPath = normalizePath(this.settings.projectsFolderPath);
    await this.ensureFolderExists(folderPath);
    const filePath = normalizePath(`${folderPath}/${fileName}.md`);

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      throw new ValidationError(`File ${filePath} already exists`);
    }

    const content = await this.buildProjectContent(
      result,
      originalItem,
      spheres,
      waitingFor,
      parentProject,
      markAsDone,
      dueDate,
      sourceNoteLink
    );
    const file = await this.app.vault.create(filePath, content);
    await this.processWithTemplater(file);

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

  private async ensureParentFolderExists(filePath: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf("/");

    if (lastSlashIndex > 0) {
      const parentPath = normalizedPath.slice(0, lastSlashIndex);
      await this.ensureFolderExists(parentPath);
    }
  }

  /**
   * Add an action to the Next Actions file
   *
   * @param actions - Single action or array of actions to add
   * @param spheres - Sphere tags to apply (e.g., ["personal", "work"])
   * @param waitingFor - Array of booleans indicating which actions are waiting-for items
   * @param markAsDone - Array of booleans indicating which actions should be marked as complete
   * @param dueDate - Optional due date in YYYY-MM-DD format (e.g., "2025-11-15")
   * @param sourceNoteLink - Optional wikilink to source note (e.g., "[[note-name|source]]")
   */
  async addToNextActionsFile(
    actions: string | string[],
    spheres: string[] = [],
    waitingFor: boolean[] = [],
    markAsDone: boolean[] = [],
    dueDate?: string,
    sourceNoteLink?: string
  ): Promise<void> {
    const actionsArray = Array.isArray(actions) ? actions : [actions];
    const sphereTags = spheres.map((s) => `#sphere/${s}`).join(" ");
    const dateSuffix = dueDate ? ` 📅 ${dueDate}` : "";
    const sourceSuffix = sourceNoteLink ? ` (${sourceNoteLink})` : "";

    for (let i = 0; i < actionsArray.length; i++) {
      const action = actionsArray[i];
      const isDone = markAsDone[i] || false;
      const isWaiting = waitingFor[i] || false;

      let checkbox: string;
      let actionText = action;

      if (isDone) {
        checkbox = "- [x]";
        const completionDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        actionText = `${action} ✅ ${completionDate}`;
      } else if (isWaiting) {
        checkbox = "- [w]";
      } else {
        checkbox = "- [ ]";
      }

      const content = sphereTags
        ? `${checkbox} ${actionText}${dateSuffix}${sourceSuffix} ${sphereTags}`
        : `${checkbox} ${actionText}${dateSuffix}${sourceSuffix}`;
      await this.appendToFile(this.settings.nextActionsFilePath, content);
    }
  }

  /**
   * Add one or more items to the Someday/Maybe file
   */
  async addToSomedayFile(
    items: string | string[],
    spheres: string[] = [],
    dueDate?: string,
    sourceNoteLink?: string
  ): Promise<void> {
    const itemsArray = Array.isArray(items) ? items : [items];
    const sphereTags = spheres.map((s) => `#sphere/${s}`).join(" ");
    const sourceSuffix = sourceNoteLink ? ` (${sourceNoteLink})` : "";

    for (const item of itemsArray) {
      const dateSuffix = dueDate ? ` 📅 ${dueDate}` : "";
      const content = sphereTags
        ? `- [ ] ${item}${dateSuffix}${sourceSuffix} ${sphereTags}`
        : `- [ ] ${item}${dateSuffix}${sourceSuffix}`;
      await this.appendToFile(this.settings.somedayFilePath, content);
    }
  }

  /**
   * Find a file by path with case-insensitive matching.
   * Returns the file if found, or null if not found.
   */
  private findFileCaseInsensitive(filePath: string): TFile | null {
    const normalizedPath = normalizePath(filePath);

    // Try exact match first (fastest path)
    const exactMatch = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (exactMatch instanceof TFile) {
      return exactMatch;
    }

    // Fall back to case-insensitive search
    const lowerPath = normalizedPath.toLowerCase();
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      if (file.path.toLowerCase() === lowerPath) {
        return file;
      }
    }

    return null;
  }

  /**
   * Append content to a file, creating it if it doesn't exist
   */
  private async appendToFile(filePath: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    let file = this.findFileCaseInsensitive(normalizedPath);

    if (!file) {
      // Create the file if it doesn't exist
      try {
        await this.ensureParentFolderExists(normalizedPath);
        file = await this.app.vault.create(normalizedPath, content + "\n");
      } catch (error) {
        // Handle race condition: file was created between findFileCaseInsensitive and create
        if (error instanceof Error && error.message.includes("already exists")) {
          // Retry by fetching the file and modifying it
          file = this.findFileCaseInsensitive(normalizedPath);
          if (file instanceof TFile) {
            const existingContent = await this.app.vault.read(file);
            const newContent = existingContent.trim() + "\n" + content + "\n";
            await this.app.vault.modify(file, newContent);
            return;
          }
        }
        // Re-throw if it's a different error
        throw error;
      }
    } else if (file instanceof TFile) {
      // Append to existing file
      const existingContent = await this.app.vault.read(file);
      const newContent = existingContent.trim() + "\n" + content + "\n";
      await this.app.vault.modify(file, newContent);
    } else {
      throw new FileNotFoundError(filePath);
    }
  }

  /**
   * Add a next action to an existing project
   */
  async addNextActionToProject(
    project: FlowProject,
    actions: string | string[],
    waitingFor: boolean[] = [],
    markAsDone: boolean[] = [],
    dueDate?: string
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(project.file);
    }

    const actionsArray = Array.isArray(actions) ? actions : [actions];
    let content = await this.app.vault.read(file);

    for (let i = 0; i < actionsArray.length; i++) {
      const action = actionsArray[i];
      const isWaiting = waitingFor[i] || false;
      const isDone = markAsDone[i] || false;
      content = this.addActionToSection(
        content,
        "## Next actions",
        action,
        isWaiting,
        isDone,
        dueDate
      );
    }

    await this.app.vault.modify(file, content);
  }

  /**
   * Add reference content to an existing project
   */
  async addReferenceToProject(project: FlowProject, referenceContent: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(project.file);
    }

    let content = await this.app.vault.read(file);
    const sectionName = "## Notes + resources";
    content = this.addContentToSection(content, sectionName, referenceContent);

    await this.app.vault.modify(file, content);
  }

  /**
   * Add an item to the "## Discuss next" section of a person note
   */
  async addToPersonDiscussNext(person: PersonNote, item: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(person.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(person.file);
    }

    let content = await this.app.vault.read(file);
    const sectionName = "## Discuss next";
    content = this.addActionToSection(content, sectionName, item);

    await this.app.vault.modify(file, content);
  }

  /**
   * Add an action to a person note from an EditableItem
   */
  async addToPersonNote(item: EditableItem): Promise<void> {
    if (!item.selectedPerson) {
      throw new ValidationError("No person selected for person note action");
    }

    if (!item.editedName) {
      throw new ValidationError("No action text provided for person note");
    }

    const file = this.app.vault.getAbstractFileByPath(item.selectedPerson.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(item.selectedPerson.file);
    }

    let content = await this.app.vault.read(file);
    const sectionName = "## Actions";
    content = this.addActionToSection(
      content,
      sectionName,
      item.editedName,
      false,
      false,
      item.dueDate
    );

    await this.app.vault.modify(file, content);
  }

  /**
   * Generate a clean file name from project title
   */
  private generateFileName(title: string): string {
    const cleaned = sanitizeFileName(title).replace(/\.+$/, ""); // Drop trailing dots that Windows forbids

    return cleaned.length > 0 ? cleaned : "Project";
  }

  private formatDescription(
    originalItem: string,
    sourceNoteLink?: string,
    description?: string
  ): string {
    // If a description is explicitly provided, use it directly (for manually created projects)
    if (description && description.length > 0) {
      return description;
    }
    // Otherwise, format as an inbox item reference
    return this.formatOriginalInboxItem(originalItem, sourceNoteLink);
  }

  private formatOriginalInboxItem(originalItem: string, sourceNoteLink?: string): string {
    const normalized = originalItem.replace(/\s+/g, " ").trim();
    const sourceSuffix = sourceNoteLink ? ` (${sourceNoteLink})` : "";
    return normalized.length > 0
      ? `Original inbox item: ${normalized}${sourceSuffix}`
      : "Original inbox item:";
  }

  /**
   * If Templater is installed, process the file to replace any <% %> syntax
   */
  private async processWithTemplater(file: TFile): Promise<void> {
    try {
      const templaterPlugin = (this.app as any).plugins?.plugins?.["templater-obsidian"];
      if (templaterPlugin?.templater?.overwrite_file_commands) {
        await templaterPlugin.templater.overwrite_file_commands(file);
      }
    } catch (error) {
      console.warn(
        "Flow: Templater processing failed, template syntax may remain unprocessed",
        error
      );
    }
  }

  /**
   * Build the content for a new project file using template
   */
  private async buildProjectContent(
    result: GTDProcessingResult,
    originalItem: string,
    spheres: string[] = [],
    waitingFor: boolean[] = [],
    parentProject?: string,
    markAsDone: boolean[] = [],
    dueDate?: string,
    sourceNoteLink?: string
  ): Promise<string> {
    const templateFile = this.app.vault.getAbstractFileByPath(
      this.settings.projectTemplateFilePath
    );

    if (!templateFile || !(templateFile instanceof TFile)) {
      // Fallback to hardcoded template if template file doesn't exist
      return this.buildProjectContentFallback(
        result,
        originalItem,
        spheres,
        waitingFor,
        parentProject,
        markAsDone,
        dueDate,
        sourceNoteLink
      );
    }

    let templateContent = await this.app.vault.read(templateFile);

    // Parse template variables
    const now = new Date();
    const dateTime = this.formatDateTime(now);
    const date = this.formatDate(now);
    const time = this.formatTime(now);
    const sphereTagsForTemplate =
      spheres.length > 0 ? spheres.map((s) => `project/${s}`).join("\n  - ") : "project/personal";

    const projectPriority =
      typeof result.projectPriority === "number" &&
      Number.isInteger(result.projectPriority) &&
      result.projectPriority >= 1 &&
      result.projectPriority <= 5
        ? result.projectPriority
        : this.settings.defaultPriority;

    // Replace template variables
    templateContent = templateContent
      .replace(/{{\s*date\s*}}/g, date)
      .replace(/{{\s*time\s*}}/g, time)
      .replace(/{{\s*priority\s*}}/g, projectPriority.toString())
      .replace(/{{\s*status\s*}}/g, this.settings.defaultStatus)
      .replace(/{{\s*sphere\s*}}/g, sphereTagsForTemplate)
      .replace(
        /{{\s*description\s*}}/g,
        this.formatDescription(originalItem, sourceNoteLink, result.description)
      );

    // Add parent-project to frontmatter if provided
    if (parentProject) {
      // Find the closing --- of the frontmatter
      const frontmatterEndMatch = templateContent.match(/^---\n[\s\S]*?\n---/m);
      if (frontmatterEndMatch) {
        const frontmatterEnd = frontmatterEndMatch[0];
        const frontmatterEndIndex = frontmatterEnd.lastIndexOf("---");
        const beforeEnd = frontmatterEnd.substring(0, frontmatterEndIndex);
        const afterEnd = templateContent.substring(
          frontmatterEndMatch.index! + frontmatterEnd.length
        );

        templateContent = beforeEnd + `parent-project: "${parentProject}"\n---` + afterEnd;
      }
    }

    // Add next actions to the template
    let content = templateContent;

    // Find the "## Next actions" section and add the actions
    const nextActionsRegex = /(## Next actions\s*\n)(\s*)/;
    const match = content.match(nextActionsRegex);

    if (match) {
      let actionsText = "";
      const dueDateSuffix = dueDate ? ` 📅 ${dueDate}` : "";

      if (result.nextActions && result.nextActions.length > 0) {
        actionsText =
          result.nextActions
            .map((action, i) => {
              const isDone = markAsDone[i] || false;
              const isWaiting = waitingFor[i] || false;

              let checkbox: string;
              let actionText = action;

              if (isDone) {
                checkbox = "- [x]";
                const completionDate = new Date().toISOString().split("T")[0];
                actionText = `${action} ✅ ${completionDate}`;
              } else if (isWaiting) {
                checkbox = "- [w]";
              } else {
                checkbox = "- [ ]";
              }

              return `${checkbox} ${actionText}${dueDateSuffix}`;
            })
            .join("\n") + "\n";
      } else if (result.nextAction) {
        const isDone = markAsDone[0] || false;
        const isWaiting = waitingFor[0] || false;

        let checkbox: string;
        let actionText = result.nextAction;

        if (isDone) {
          checkbox = "- [x]";
          const completionDate = new Date().toISOString().split("T")[0];
          actionText = `${result.nextAction} ✅ ${completionDate}`;
        } else if (isWaiting) {
          checkbox = "- [w]";
        } else {
          checkbox = "- [ ]";
        }

        actionsText = `${checkbox} ${actionText}${dueDateSuffix}\n`;
      }

      // Replace "## Next actions\n<any whitespace>" with "## Next actions\n<actions>\n"
      // This ensures proper spacing regardless of template whitespace
      content = content.replace(nextActionsRegex, `$1${actionsText}\n`);
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
    waitingFor: boolean[] = [],
    parentProject?: string,
    markAsDone: boolean[] = [],
    dueDate?: string,
    sourceNoteLink?: string
  ): string {
    const now = new Date();
    const dateTime = this.formatDateTime(now);
    const title = result.projectOutcome || originalItem;
    const description = this.formatDescription(originalItem, sourceNoteLink, result.description);

    // Format sphere tags for YAML list format
    const sphereTagsList =
      spheres.length > 0
        ? spheres.map((s) => `  - project/${s}`).join("\n")
        : "  - project/personal";

    const projectPriorityFallback =
      typeof result.projectPriority === "number" &&
      Number.isInteger(result.projectPriority) &&
      result.projectPriority >= 1 &&
      result.projectPriority <= 5
        ? result.projectPriority
        : this.settings.defaultPriority;

    let content = `---
creation-date: ${dateTime}
priority:
  ${projectPriorityFallback}
tags:
${sphereTagsList}
status: ${this.settings.defaultStatus}`;

    if (parentProject) {
      content += `\nparent-project: "${parentProject}"`;
    }

    content += `
---

# Description

${description}

## Next actions
`;

    // Handle multiple next actions or single next action
    const dueDateSuffix = dueDate ? ` 📅 ${dueDate}` : "";

    if (result.nextActions && result.nextActions.length > 0) {
      content +=
        result.nextActions
          .map((action, i) => {
            const isDone = markAsDone[i] || false;
            const isWaiting = waitingFor[i] || false;

            let checkbox: string;
            let actionText = action;

            if (isDone) {
              checkbox = "- [x]";
              const completionDate = new Date().toISOString().split("T")[0];
              actionText = `${action} ✅ ${completionDate}`;
            } else if (isWaiting) {
              checkbox = "- [w]";
            } else {
              checkbox = "- [ ]";
            }

            return `${checkbox} ${actionText}${dueDateSuffix}`;
          })
          .join("\n") + "\n";
    } else if (result.nextAction && result.nextAction.trim()) {
      const isDone = markAsDone[0] || false;
      const isWaiting = waitingFor[0] || false;

      let checkbox: string;
      let actionText = result.nextAction;

      if (isDone) {
        checkbox = "- [x]";
        const completionDate = new Date().toISOString().split("T")[0];
        actionText = `${result.nextAction} ✅ ${completionDate}`;
      } else if (isWaiting) {
        checkbox = "- [w]";
      } else {
        checkbox = "- [ ]";
      }

      content += `${checkbox} ${actionText}${dueDateSuffix}\n`;
    }

    content += `

## Notes + resources
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
    isWaiting: boolean = false,
    isDone: boolean = false,
    dueDate?: string
  ): string {
    const lines = content.split("\n");
    const sectionIndex = this.findSectionIndex(lines, sectionHeading);

    if (sectionIndex === -1) {
      // Section doesn't exist, create it at the end
      return this.createSectionWithAction(
        content,
        sectionHeading,
        action,
        isWaiting,
        isDone,
        dueDate
      );
    }

    // Find where to insert the action (after the heading, before next section)
    let insertIndex = sectionIndex + 1;

    // Skip any empty lines after the heading
    while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
      insertIndex++;
    }

    // Insert the action
    let checkbox: string;
    let actionText = action;

    if (isDone) {
      checkbox = "- [x]";
      const completionDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      actionText = `${action} ✅ ${completionDate}`;
    } else if (isWaiting) {
      checkbox = "- [w]";
    } else {
      checkbox = "- [ ]";
    }

    const dueDateSuffix = dueDate ? ` 📅 ${dueDate}` : "";
    lines.splice(insertIndex, 0, `${checkbox} ${actionText}${dueDateSuffix}`);

    return lines.join("\n");
  }

  /**
   * Add content to a specific section
   */
  private addContentToSection(content: string, sectionHeading: string, newContent: string): string {
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
    isWaiting: boolean = false,
    isDone: boolean = false,
    dueDate?: string
  ): string {
    // Add section at the end of the file
    let newContent = content.trim();

    if (!newContent.endsWith("\n")) {
      newContent += "\n";
    }

    let checkbox: string;
    let actionText = action;

    if (isDone) {
      checkbox = "- [x]";
      const completionDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      actionText = `${action} ✅ ${completionDate}`;
    } else if (isWaiting) {
      checkbox = "- [w]";
    } else {
      checkbox = "- [ ]";
    }

    const dueDateSuffix = dueDate ? ` 📅 ${dueDate}` : "";
    newContent += `\n${sectionHeading}\n${checkbox} ${actionText}${dueDateSuffix}\n`;

    return newContent;
  }

  /**
   * Create a new section with an item when section doesn't exist
   */
  private createSectionWithItem(content: string, sectionHeading: string, item: string): string {
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
    newContent: string
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
   * Format a datetime for Flow frontmatter (YYYY-MM-DDTHH:mm:00)
   */
  private formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:00`;
  }

  /**
   * Format a date for Flow frontmatter (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  /**
   * Format a time for Flow frontmatter (HH:mm)
   */
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
  }

  /**
   * Update project frontmatter tags
   */
  async updateProjectTags(project: FlowProject, newTags: string[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(project.file);
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Ensure all project tags are preserved
      const existingTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];

      const projectTags = existingTags.filter((tag: string) => tag.startsWith("project/"));
      const otherTags = existingTags.filter((tag: string) => !tag.startsWith("project/"));

      frontmatter.tags = [...new Set([...projectTags, ...newTags, ...otherTags])];
    });
  }

  /**
   * Update project priority in frontmatter
   */
  async updateProjectPriority(project: FlowProject, newPriority: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.file);
    if (!(file instanceof TFile)) {
      throw new FileNotFoundError(project.file);
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.priority = newPriority;
    });
  }
}
