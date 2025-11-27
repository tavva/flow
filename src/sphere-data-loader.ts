// ABOUTME: Loads and filters sphere data for the sphere view
// ABOUTME: Extracts data loading logic from sphere-view.ts for better separation of concerns

import { App, TFile } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { FlowProject, PluginSettings } from "./types";
import {
  buildProjectHierarchy,
  flattenHierarchy,
  sortHierarchy,
  ProjectNode,
} from "./project-hierarchy";

export interface SphereProjectSummary {
  project: FlowProject;
  priority: number | null;
  depth: number;
  parentName?: string;
}

export interface SphereViewData {
  projects: SphereProjectSummary[];
  projectsNeedingNextActions: SphereProjectSummary[];
  generalNextActions: string[];
  generalNextActionsNotice?: string;
}

export class SphereDataLoader {
  private readonly app: App;
  private readonly scanner: FlowProjectScanner;
  private readonly sphere: string;
  private readonly settings: PluginSettings;

  constructor(app: App, sphere: string, settings: PluginSettings) {
    this.app = app;
    this.sphere = sphere;
    this.settings = settings;
    this.scanner = new FlowProjectScanner(app);
  }

  async loadSphereData(): Promise<SphereViewData> {
    const allProjects = await this.scanner.scanProjects();

    // Build hierarchy from ALL projects first (so parent relationships are preserved)
    const hierarchy = buildProjectHierarchy(allProjects);

    // Build parent lookup for priority comparison
    const parentLookup = new Map<string, FlowProject>();
    const buildParentLookup = (nodes: ProjectNode[], parent?: FlowProject) => {
      for (const node of nodes) {
        if (parent) {
          parentLookup.set(node.project.file, parent);
        }
        buildParentLookup(node.children, node.project);
      }
    };
    buildParentLookup(hierarchy);

    // Sort hierarchy at each level (siblings within same parent)
    const sortedHierarchy = sortHierarchy(hierarchy, (a, b) => this.compareProjectNodes(a, b));

    // Flatten the sorted hierarchy (preserves parent-child grouping)
    const flattenedHierarchy = flattenHierarchy(sortedHierarchy);

    // Filter to sphere projects with live status and map to summaries
    const projectSummaries = flattenedHierarchy
      .filter(
        (node) =>
          node.project.tags.some((tag) => this.matchesSphereTag(tag)) &&
          node.project.status === "live" &&
          !node.project.file.startsWith("Templates/") &&
          node.project.file !== this.settings.projectTemplateFilePath
      )
      .map((node) => {
        const priority = this.normalizePriority(node.project.priority);
        const parent = parentLookup.get(node.project.file);

        let depth = node.depth;
        let parentName: string | undefined;

        // If this is a subproject with different priority than its parent,
        // promote it to root level but show parent indicator
        if (depth > 0 && parent) {
          const parentPriority = this.normalizePriority(parent.priority);
          if (priority !== parentPriority) {
            depth = 0;
            parentName = parent.title;
          }
        }

        return {
          project: node.project,
          priority,
          depth,
          parentName,
        };
      });

    // Re-sort by priority so promoted subprojects appear in correct section
    // Use stable sort (preserve original order within same priority)
    const indexedSummaries = projectSummaries.map((s, i) => ({ summary: s, originalIndex: i }));
    indexedSummaries.sort((a, b) => {
      const aPriority = a.summary.priority;
      const bPriority = b.summary.priority;

      // Primary sort by priority
      if (aPriority !== null && bPriority !== null && aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      if (aPriority !== null && bPriority === null) return -1;
      if (aPriority === null && bPriority !== null) return 1;

      // Same priority - preserve original order
      return a.originalIndex - b.originalIndex;
    });
    const sortedSummaries = indexedSummaries.map((is) => is.summary);

    const projectsNeedingNextActions = sortedSummaries.filter(
      ({ project }) => !project.nextActions || project.nextActions.length === 0
    );

    const { generalNextActions, generalNextActionsNotice } = await this.readGeneralNextActions();

    return {
      projects: sortedSummaries,
      projectsNeedingNextActions,
      generalNextActions,
      generalNextActionsNotice,
    };
  }

  filterData(data: SphereViewData, query: string): SphereViewData {
    // Empty query = no filtering
    if (!query.trim()) {
      return data;
    }

    const lowerQuery = query.toLowerCase();
    const matches = (text: string) => text.toLowerCase().includes(lowerQuery);

    // Filter projects: include if name matches OR has matching actions
    const filteredProjects = data.projects
      .map((summary) => {
        const filteredActions =
          summary.project.nextActions?.filter((action) => matches(action)) || [];

        const projectNameMatches = matches(summary.project.title);
        const includeProject = projectNameMatches || filteredActions.length > 0;

        if (!includeProject) return null;

        return {
          ...summary,
          project: {
            ...summary.project,
            nextActions: projectNameMatches ? summary.project.nextActions : filteredActions,
          },
        };
      })
      .filter((p): p is SphereProjectSummary => p !== null);

    // Filter general actions
    const filteredGeneralActions = data.generalNextActions.filter((action) => matches(action));

    return {
      projects: filteredProjects,
      projectsNeedingNextActions: data.projectsNeedingNextActions, // Not filtered
      generalNextActions: filteredGeneralActions,
      generalNextActionsNotice: data.generalNextActionsNotice,
    };
  }

  extractGeneralNextActions(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const actions: string[] = [];
    const checkboxPattern = /^[-*]\s*\[([ xXw])\]\s*(.+)$/;
    const normalizedSphere = this.normalizeSphereValue(this.sphere);

    for (const line of lines) {
      const match = line.match(checkboxPattern);
      if (!match) {
        continue;
      }

      const checkboxStatus = match[1];
      let rawText = match[2];

      // Skip completed items ([x] or [X])
      if (checkboxStatus === "x" || checkboxStatus === "X") {
        continue;
      }

      let belongsToSphere = false;

      rawText = rawText.replace(/#sphere\/([^\s]+)/gi, (fullMatch, captured) => {
        if (this.normalizeSphereValue(String(captured)) === normalizedSphere) {
          belongsToSphere = true;
          return "";
        }
        return fullMatch;
      });

      if (!belongsToSphere) {
        continue;
      }

      const cleaned = rawText.replace(/\s{2,}/g, " ").trim();
      if (cleaned.length > 0) {
        actions.push(cleaned);
      }
    }

    return actions;
  }

  normalizePriority(priority: FlowProject["priority"]): number | null {
    if (typeof priority === "number" && Number.isFinite(priority)) {
      return priority;
    }
    return null;
  }

  matchesSphereTag(tag: string): boolean {
    const normalizedTag = tag.replace(/^#/, "").toLowerCase();
    if (!normalizedTag.startsWith("project/")) {
      return false;
    }

    const sphereTag = normalizedTag.slice("project/".length);
    return this.normalizeSphereValue(sphereTag) === this.normalizeSphereValue(this.sphere);
  }

  private normalizeSphereValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
  }

  private compareProjectNodes(a: ProjectNode, b: ProjectNode): number {
    const aPriority = this.normalizePriority(a.project.priority);
    const bPriority = this.normalizePriority(b.project.priority);

    if (aPriority !== null && bPriority !== null && aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (aPriority !== null && bPriority === null) {
      return -1;
    }

    if (aPriority === null && bPriority !== null) {
      return 1;
    }

    return a.project.title.localeCompare(b.project.title);
  }

  private async readGeneralNextActions(): Promise<{
    generalNextActions: string[];
    generalNextActionsNotice?: string;
  }> {
    const path = this.settings.nextActionsFilePath?.trim();
    if (!path) {
      return {
        generalNextActions: [],
        generalNextActionsNotice: "Next actions file path is not configured in settings.",
      };
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return {
        generalNextActions: [],
        generalNextActionsNotice: `Next actions file "${path}" was not found in the vault.`,
      };
    }

    try {
      const content = await this.app.vault.read(file);
      return { generalNextActions: this.extractGeneralNextActions(content) };
    } catch (error) {
      console.error("Failed to read next actions file", error);
      return {
        generalNextActions: [],
        generalNextActionsNotice: "Unable to read next actions file.",
      };
    }
  }
}
