// ABOUTME: Builds and manages hierarchical project relationships based on parent-project frontmatter.
// ABOUTME: Provides utilities for tree traversal, cycle detection, and action aggregation.

import { FlowProject } from "./types";

export interface ProjectNode {
  project: FlowProject;
  children: ProjectNode[];
  depth: number; // 0 for root projects, 1 for immediate children, etc.
  allNextActions: string[]; // Aggregated from this project and all descendants
}

/**
 * Extracts the project file path from a wikilink
 * Converts "[[Project Name]]" or "[[folder/Project Name]]" to file path
 */
export function extractParentPath(parentProject: string): string | null {
  if (!parentProject || typeof parentProject !== "string") {
    return null;
  }

  // Remove [[ ]] brackets
  const withoutBrackets = parentProject.replace(/^\[\[|\]\]$/g, "").trim();

  if (!withoutBrackets) {
    return null;
  }

  // If it already has .md extension, return as-is
  if (withoutBrackets.endsWith(".md")) {
    return withoutBrackets;
  }

  // Otherwise add .md extension
  return `${withoutBrackets}.md`;
}

/**
 * Builds a hierarchical tree structure from a flat list of projects
 * Detects and prevents cycles
 */
export function buildProjectHierarchy(projects: FlowProject[]): ProjectNode[] {
  // Build lookup maps by both file path and title
  const nodesByFile = new Map<string, ProjectNode>();
  const nodesByTitle = new Map<string, ProjectNode>();

  projects.forEach((project) => {
    const node: ProjectNode = {
      project,
      children: [],
      depth: 0,
      allNextActions: [...project.nextActions],
    };
    nodesByFile.set(project.file, node);
    // Also index by title + .md for title-based lookups
    nodesByTitle.set(project.title + ".md", node);
  });

  // Build parent-child relationships
  const rootNodes: ProjectNode[] = [];

  projects.forEach((project) => {
    const node = nodesByFile.get(project.file)!;

    if (!project.parentProject) {
      // This is a root node
      rootNodes.push(node);
      return;
    }

    // Extract parent path from wikilink
    const parentPath = extractParentPath(project.parentProject);
    if (!parentPath) {
      // Invalid parent link - treat as root
      rootNodes.push(node);
      return;
    }

    // Try to find parent by file path first, then by title
    let parentNode = nodesByFile.get(parentPath);
    if (!parentNode) {
      parentNode = nodesByTitle.get(parentPath);
    }

    if (!parentNode) {
      // Parent doesn't exist - treat as root (orphaned sub-project)
      rootNodes.push(node);
      return;
    }

    // Check for cycles before adding relationship
    if (wouldCreateCycle(node.project.file, parentNode.project.file, nodesByFile, nodesByTitle)) {
      // Cycle detected - treat as root to prevent infinite loop
      console.warn(
        `Cycle detected: "${project.file}" -> "${parentNode.project.file}". Treating "${project.file}" as root project.`
      );
      rootNodes.push(node);
      return;
    }

    // Add child to parent
    parentNode.children.push(node);
  });

  // Calculate depths and aggregate actions recursively
  rootNodes.forEach((node) => {
    calculateDepthAndActions(node, 0);
  });

  return rootNodes;
}

/**
 * Looks up a node by wikilink path, trying file path first then title
 */
function findNodeByPath(
  wikilinkPath: string,
  nodesByFile: Map<string, ProjectNode>,
  nodesByTitle: Map<string, ProjectNode>
): ProjectNode | undefined {
  const node = nodesByFile.get(wikilinkPath);
  if (node) {
    return node;
  }
  return nodesByTitle.get(wikilinkPath);
}

/**
 * Checks if adding a parent-child relationship would create a cycle
 */
function wouldCreateCycle(
  childPath: string,
  parentPath: string,
  nodesByFile: Map<string, ProjectNode>,
  nodesByTitle: Map<string, ProjectNode>
): boolean {
  // Walk up the parent chain from parentPath
  // If we encounter childPath, we have a cycle
  let currentPath: string | null = parentPath;
  const visited = new Set<string>();

  while (currentPath) {
    if (currentPath === childPath) {
      return true; // Cycle detected
    }

    if (visited.has(currentPath)) {
      // We've already seen this node - there's a cycle somewhere but not involving childPath
      return false;
    }

    visited.add(currentPath);

    const currentNode = nodesByFile.get(currentPath);
    if (!currentNode) {
      break;
    }

    if (!currentNode.project.parentProject) {
      // Reached a root node
      break;
    }

    const parentWikilinkPath = extractParentPath(currentNode.project.parentProject);
    if (!parentWikilinkPath) {
      break;
    }

    // Find the parent using dual lookup
    const parentNode = findNodeByPath(parentWikilinkPath, nodesByFile, nodesByTitle);
    if (!parentNode) {
      break;
    }

    currentPath = parentNode.project.file;
  }

  return false;
}

/**
 * Recursively calculates depth and aggregates next actions for a node and its descendants
 */
function calculateDepthAndActions(node: ProjectNode, depth: number): void {
  node.depth = depth;

  // Start with this project's next actions
  const allActions = [...node.project.nextActions];

  // Recursively process children
  node.children.forEach((child) => {
    calculateDepthAndActions(child, depth + 1);
    // Add child's aggregated actions to this node
    allActions.push(...child.allNextActions);
  });

  node.allNextActions = allActions;
}

/**
 * Flattens a hierarchy tree into a depth-first ordered list
 * Useful for rendering with proper indentation
 */
export function flattenHierarchy(roots: ProjectNode[]): ProjectNode[] {
  const result: ProjectNode[] = [];

  function traverse(node: ProjectNode) {
    result.push(node);
    node.children.forEach(traverse);
  }

  roots.forEach(traverse);
  return result;
}

/**
 * Gets the display name for a project, including parent context if applicable
 * Returns format: "Project Name (Parent Name)" with parent portion for dimming
 */
export function getProjectDisplayName(
  projectPath: string,
  allProjects: FlowProject[]
): { primary: string; parent?: string } {
  const project = allProjects.find((p) => p.file === projectPath);

  if (!project) {
    return { primary: projectPath };
  }

  if (!project.parentProject) {
    return { primary: project.title };
  }

  const parentPath = extractParentPath(project.parentProject);
  if (!parentPath) {
    return { primary: project.title };
  }

  const parentProject = allProjects.find((p) => p.file === parentPath);
  const parentName = parentProject ? parentProject.title : parentPath.replace(".md", "");

  return {
    primary: project.title,
    parent: parentName,
  };
}
