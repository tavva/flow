import type { App, TFile, CachedMetadata } from "obsidian";
import { FlowProject, milestonesHeaderText, nextActionsHeaderText, PluginSettings } from "./types";
import { ProjectNode, buildProjectHierarchy } from "./project-hierarchy";

export class FlowProjectScanner {
  private cache: Map<string, { mtime: number; project: FlowProject }> = new Map();

  constructor(
    private app: App,
    private settings: PluginSettings
  ) {}

  /**
   * Scans the vault for all Flow projects (files with tags starting with 'project/')
   */
  async scanProjects(): Promise<FlowProject[]> {
    const projects: FlowProject[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const project = await this.parseProjectFile(file);
      if (project) {
        projects.push(project);
      }
    }

    return projects;
  }

  /**
   * Scans the vault and builds a hierarchical tree of projects
   */
  async scanProjectTree(): Promise<ProjectNode[]> {
    const projects = await this.scanProjects();
    return buildProjectHierarchy(projects);
  }

  /**
   * Parses a single file to extract Flow project information
   */
  async parseProjectFile(file: TFile): Promise<FlowProject | null> {
    // Check cache first
    const cached = this.cache.get(file.path);
    if (cached && cached.mtime === file.stat.mtime) {
      return cached.project;
    }

    const metadata = this.app.metadataCache.getFileCache(file);

    if (!metadata || !this.isFlowProject(metadata)) {
      return null;
    }

    const content = await this.app.vault.read(file);
    const frontmatter = metadata.frontmatter || {};

    const project: FlowProject = {
      file: file.path,
      title: file.basename,
      description: this.extractDescription(content),
      tags: this.extractProjectTags(frontmatter.tags),
      priority: frontmatter.priority,
      status: frontmatter.status,
      creationDate: frontmatter["creation-date"],
      mtime: file.stat.mtime,
      nextActions: this.extractSection(content, `## ${nextActionsHeaderText(this.settings)}`),
      parentProject: frontmatter["parent-project"],
      milestones: this.extractSectionText(content, `## ${milestonesHeaderText(this.settings)}`),
      coverImage: frontmatter["cover-image"],
      current: frontmatter.current === true,
    };

    // Update cache
    this.cache.set(file.path, {
      mtime: file.stat.mtime,
      project,
    });

    return project;
  }

  /**
   * Checks if a file is a Flow project (has tags starting with 'project/')
   */
  private isFlowProject(metadata: CachedMetadata): boolean {
    const frontmatter = metadata.frontmatter;
    if (!frontmatter || !frontmatter.tags) {
      return false;
    }

    const tags = this.normalizeTags(frontmatter.tags);
    return tags.some((tag) => tag.startsWith("project/"));
  }

  /**
   * Normalizes tags to array format
   */
  private normalizeTags(tags: string | string[]): string[] {
    if (Array.isArray(tags)) {
      return tags.filter((tag) => typeof tag === "string");
    }
    if (typeof tags === "string") {
      return [tags];
    }
    return [];
  }

  /**
   * Extracts project-specific tags (those starting with 'project/')
   */
  private extractProjectTags(tags: string | string[]): string[] {
    const normalizedTags = this.normalizeTags(tags);
    return normalizedTags.filter((tag) => tag.startsWith("project/"));
  }

  /**
   * Extracts content from a markdown section
   */
  private extractSection(content: string, heading: string): string[] {
    const lines = content.split("\n");
    const items: string[] = [];
    let inSection = false;
    let sectionLevel = 0;
    const normalizedHeading = heading.replace(/^#+\s+/, "").toLowerCase();

    for (const line of lines) {
      // Check if this is a heading line
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        if (title.toLowerCase() === normalizedHeading) {
          inSection = true;
          sectionLevel = level;
          continue;
        } else if (inSection && level <= sectionLevel) {
          // We've hit another section at the same or higher level
          break;
        }
      }

      if (inSection) {
        // Extract list items, excluding completed ones
        const itemMatch = line.match(/^[-*]\s+(?:\[([ xXw])\]\s+)?(.+)$/);
        if (itemMatch) {
          const checkboxStatus = itemMatch[1];
          const text = itemMatch[2].trim();

          // Only include items that are not completed ([x] or [X])
          if (!checkboxStatus || checkboxStatus === " " || checkboxStatus === "w") {
            items.push(text);
          }
        }
      }
    }

    return items;
  }

  /**
   * Extracts raw text content from a markdown section
   */
  private extractSectionText(content: string, heading: string): string | undefined {
    const lines = content.split("\n");
    const sectionLines: string[] = [];
    let inSection = false;
    let sectionLevel = 0;
    const normalizedHeading = heading.replace(/^#+\s+/, "").toLowerCase();

    for (const line of lines) {
      // Check if this is a heading line
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        if (title.toLowerCase() === normalizedHeading) {
          inSection = true;
          sectionLevel = level;
          continue;
        } else if (inSection && level <= sectionLevel) {
          // We've hit another section at the same or higher level
          break;
        }
      }

      if (inSection) {
        sectionLines.push(line);
      }
    }

    const text = sectionLines.join("\n").trim();
    return text.length > 0 ? text : undefined;
  }

  /**
   * Extracts the description from a project file (content between frontmatter and first heading)
   */
  private extractDescription(content: string): string {
    const lines = content.split("\n");
    let inFrontmatter = false;
    let frontmatterEnded = false;
    const descriptionLines: string[] = [];

    for (const line of lines) {
      // Track frontmatter boundaries
      if (line.trim() === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          frontmatterEnded = true;
          continue;
        }
      }

      // Skip frontmatter lines
      if (inFrontmatter && !frontmatterEnded) {
        continue;
      }

      // Stop at first heading (marks start of a section)
      if (frontmatterEnded && line.match(/^#{1,6}\s+/)) {
        break;
      }

      // Collect description lines after frontmatter
      if (frontmatterEnded) {
        descriptionLines.push(line);
      }
    }

    return descriptionLines.join("\n").trim();
  }

  /**
   * Searches for projects by keyword
   */
  searchProjects(projects: FlowProject[], query: string): FlowProject[] {
    const lowerQuery = query.toLowerCase();
    return projects.filter(
      (project) =>
        project.title.toLowerCase().includes(lowerQuery) ||
        project.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        project.nextActions.some((action) => action.toLowerCase().includes(lowerQuery))
    );
  }
}
