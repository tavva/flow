// ABOUTME: Scans vault for someday items (from Someday file and paused/someday projects).
// ABOUTME: Returns array of someday items and projects with file location for viewing.

import { App, TFile } from "obsidian";
import { FlowProject, PluginSettings } from "./types";
import { FlowProjectScanner } from "./flow-scanner";

export interface SomedayItem {
  file: string;
  fileName: string;
  lineNumber: number;
  lineContent: string; // Full line content for validation
  text: string;
  sphere?: string; // Sphere extracted from inline tag
}

export interface SomedayProject {
  project: FlowProject;
  sphere?: string; // Sphere extracted from project tags
}

export interface SomedayData {
  items: SomedayItem[];
  projects: SomedayProject[];
}

export class SomedayScanner {
  private app: App;
  private settings: PluginSettings;
  private projectScanner: FlowProjectScanner;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
    this.projectScanner = new FlowProjectScanner(app);
  }

  private extractSphere(lineContent: string): string | undefined {
    // Check for inline #sphere/X tag
    const sphereTagMatch = lineContent.match(/#sphere\/([^\s]+)/i);
    if (sphereTagMatch) {
      return sphereTagMatch[1];
    }
    return undefined;
  }

  private extractProjectSphere(project: FlowProject): string | undefined {
    // Extract sphere from project tags (project/sphere format)
    for (const tag of project.tags) {
      const match = tag.match(/^project\/(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  async scanSomedayData(): Promise<SomedayData> {
    const [items, projects] = await Promise.all([
      this.scanSomedayFile(),
      this.scanSomedayProjects(),
    ]);

    return { items, projects };
  }

  private async scanSomedayFile(): Promise<SomedayItem[]> {
    const somedayFilePath = this.settings.somedayFilePath;
    const file = this.app.vault.getAbstractFileByPath(somedayFilePath);

    if (!(file instanceof TFile)) {
      return [];
    }

    const items: SomedayItem[] = [];
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Match any list item with optional checkbox
    const itemPattern = /^[-*]\s+(?:\[([ xXw])\]\s+)?(.+)$/;

    lines.forEach((line, index) => {
      const match = line.match(itemPattern);
      if (match) {
        const checkboxStatus = match[1];
        const text = match[2].replace(/\s{2,}/g, " ").trim();

        // Only include items that are not completed ([x] or [X])
        if (!checkboxStatus || checkboxStatus === " " || checkboxStatus === "w") {
          items.push({
            file: file.path,
            fileName: file.basename,
            lineNumber: index + 1,
            lineContent: line,
            text,
            sphere: this.extractSphere(line),
          });
        }
      }
    });

    return items;
  }

  private async scanSomedayProjects(): Promise<SomedayProject[]> {
    const allProjects = await this.projectScanner.scanProjects();

    // Filter to projects with status 'someday' or 'paused' (case insensitive)
    const somedayProjects = allProjects.filter((project) => {
      if (!project.status) {
        return false;
      }
      const status = project.status.toLowerCase();
      return status === "someday" || status === "paused";
    });

    return somedayProjects.map((project) => ({
      project,
      sphere: this.extractProjectSphere(project),
    }));
  }
}
