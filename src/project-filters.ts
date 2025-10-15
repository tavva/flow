// ABOUTME: Utility functions for filtering Flow projects
// ABOUTME: Provides reusable filtering logic for templates and project status

import { FlowProject } from "./types";

/**
 * Filter out template projects that shouldn't be shown to users or LLMs
 * Templates are identified by:
 * - Being in the Templates/ folder
 * - Matching the configured project template file path
 */
export function filterTemplates(
  projects: FlowProject[],
  projectTemplateFilePath: string
): FlowProject[] {
  return projects.filter((project) => {
    // Filter out projects in Templates folder
    if (project.file.startsWith("Templates/")) {
      return false;
    }

    // Filter out the configured template file
    if (project.file === projectTemplateFilePath) {
      return false;
    }

    return true;
  });
}

/**
 * Filter projects to only include those with "live" status
 * Empty status is treated as "live"
 */
export function filterLiveProjects(projects: FlowProject[]): FlowProject[] {
  return projects.filter((project) => {
    const status = typeof project.status === "string" ? project.status.trim().toLowerCase() : "";
    return status === "" || status === "live";
  });
}

/**
 * Combined filter: removes templates AND filters to live projects only
 */
export function filterLiveNonTemplateProjects(
  projects: FlowProject[],
  projectTemplateFilePath: string
): FlowProject[] {
  const withoutTemplates = filterTemplates(projects, projectTemplateFilePath);
  return filterLiveProjects(withoutTemplates);
}
