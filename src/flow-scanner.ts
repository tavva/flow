import { App, TFile, CachedMetadata } from "obsidian";
import { FlowProject } from "./types";
import { ProjectNode, buildProjectHierarchy } from "./project-hierarchy";

export class FlowProjectScanner {
  constructor(private app: App) {}

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
    const metadata = this.app.metadataCache.getFileCache(file);

    if (!metadata || !this.isFlowProject(metadata)) {
      return null;
    }

    const content = await this.app.vault.read(file);
    const frontmatter = metadata.frontmatter || {};

    return {
      file: file.path,
      title: file.basename,
      description: this.extractDescription(content),
      tags: this.extractProjectTags(frontmatter.tags),
      priority: frontmatter.priority,
      status: frontmatter.status,
      creationDate: frontmatter["creation-date"],
      mtime: file.stat.mtime,
      nextActions: this.extractSection(content, "## Next actions"),
      parentProject: frontmatter["parent-project"],
    };
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
        // Extract only incomplete checkbox items (skip completed tasks)
        const itemMatch = line.match(/^[-*]\s+\[[ ]\]\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1].trim());
        }
      }
    }

    return items;
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
