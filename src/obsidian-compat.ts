// ABOUTME: Compatibility layer for Obsidian API functions when running in Node.js CLI environment
// ABOUTME: Provides polyfills for runtime functions like normalizePath that don't exist outside Obsidian

/**
 * Polyfill for Obsidian's normalizePath function
 * Normalizes a file path to use forward slashes and remove redundant separators
 */
export function normalizePath(filePath: string): string {
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, "/");

  // Remove redundant slashes
  normalized = normalized.replace(/\/+/g, "/");

  // Remove trailing slash unless it's the root
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Remove leading ./ if present
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  return normalized;
}

/**
 * Minimal TFile implementation for CLI environment
 * Provides compatible interface with Obsidian's TFile for instanceof checks
 */
export class TFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  parent: any;
  vault: any;
  stat: { ctime: number; mtime: number; size: number };

  constructor(data: { path: string; basename: string; extension: string }) {
    this.path = data.path;
    this.basename = data.basename;
    this.extension = data.extension;
    this.name = `${data.basename}.${data.extension}`;
    this.parent = null;
    this.vault = null;
    this.stat = { ctime: 0, mtime: 0, size: 0 };
  }
}

/**
 * Type stubs for Obsidian API types used in CLI
 * These are minimal implementations for type compatibility only
 */
export interface App {
  vault: any;
  metadataCache: any;
}

export interface CachedMetadata {
  frontmatter?: Record<string, any>;
  sections?: any[];
  headings?: any[];
  links?: any[];
  tags?: any[];
}
