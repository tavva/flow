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
