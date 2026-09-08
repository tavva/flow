// ABOUTME: Resolves the configured vault-relative focus file path.
// ABOUTME: Keeps persistence and file change listeners consistent with the default.

import { normalizePath } from "obsidian";
import { DEFAULT_SETTINGS } from "./types/settings";

export function resolveFocusFilePath(filePath?: string): string {
  return normalizePath(filePath?.trim() || DEFAULT_SETTINGS.focusFilePath);
}
