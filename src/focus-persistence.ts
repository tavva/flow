// ABOUTME: Handles persistence of focus items to a file in the vault
// ABOUTME: Uses JSONL format (one JSON object per line) for sync-friendly storage

import { Vault, TFile, TFolder } from "obsidian";
import { FocusItem } from "./types";
import { ValidationError } from "./errors";

import { resolveFocusFilePath } from "./focus-file-path";
import { DEFAULT_SETTINGS } from "./types/settings";
import { withFocusFileLock, resolveMovedFocusFilePath } from "./focus-file-operations";

export const FOCUS_FILE_PATH = DEFAULT_SETTINGS.focusFilePath;

interface LegacyFocusFileFormat {
  version: number;
  items: FocusItem[];
}

/**
 * Check if content is legacy JSON format (a single JSON object with version and items)
 */
function isLegacyFormat(content: string): boolean {
  const trimmed = content.trim();
  // Legacy format is a single JSON object containing { "version": ..., "items": [...] }
  // JSONL format has one JSON object per line, each starting with {
  // Detect legacy by checking if it parses as an object with "version" property
  if (!trimmed.startsWith("{")) return false;

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && "version" in parsed;
  } catch {
    // If it fails to parse as a single JSON, it's likely JSONL or corrupted
    return false;
  }
}

/**
 * Parse legacy JSON format
 */
function parseLegacyFormat(content: string): FocusItem[] {
  const data: LegacyFocusFileFormat = JSON.parse(content);
  const items = data.items || [];
  for (const item of items) {
    if (!item.contexts) {
      item.contexts = [];
    }
  }
  return items;
}

/**
 * Parse JSONL format (one JSON object per line)
 */
function parseJsonlFormat(content: string): FocusItem[] {
  const items: FocusItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const item: FocusItem = JSON.parse(trimmed);
      if (!item.contexts) {
        item.contexts = [];
      }
      items.push(item);
    } catch {
      console.warn("Skipping invalid line in focus file:", trimmed.substring(0, 50));
    }
  }

  return items;
}

/**
 * Load focus items from the vault file
 */
export async function loadFocusItems(vault: Vault, filePath?: string): Promise<FocusItem[]> {
  return withFocusFileLock(vault, async () => {
    const focusFilePath = resolveMovedFocusFilePath(vault, resolveFocusFilePath(filePath));
    try {
      let file = vault.getAbstractFileByPath(focusFilePath);

      // If file not found via cache, try reading directly from adapter
      if (!(file instanceof TFile)) {
        try {
          // Check if file exists on disk but not in cache yet
          const exists = await vault.adapter.exists(focusFilePath);
          if (exists) {
            const content = await vault.adapter.read(focusFilePath);
            if (isLegacyFormat(content)) {
              return parseLegacyFormat(content);
            }
            return parseJsonlFormat(content);
          }
        } catch {
          // File doesn't exist yet, will return empty array below
        }

        // File doesn't exist at all, return empty array
        return [];
      }

      const content = await vault.read(file);

      // Handle legacy JSON format for migration
      if (isLegacyFormat(content)) {
        return parseLegacyFormat(content);
      }

      return parseJsonlFormat(content);
    } catch (error) {
      console.error("Failed to load focus items from file", error);
      return [];
    }
  });
}

/**
 * Convert items to JSONL format (one JSON object per line)
 */
function toJsonlFormat(items: FocusItem[]): string {
  if (items.length === 0) return "";
  return items.map((item) => JSON.stringify(item)).join("\n");
}

/**
 * Save focus items to the vault file
 */
export async function saveFocusItems(
  vault: Vault,
  items: FocusItem[],
  filePath?: string
): Promise<void> {
  return withFocusFileLock(vault, async () => {
    const focusFilePath = resolveMovedFocusFilePath(vault, resolveFocusFilePath(filePath));
    try {
      await ensureFocusDataDirectory(vault, focusFilePath);

      const content = toJsonlFormat(items);

      // Check if file exists via cache first
      const file = vault.getAbstractFileByPath(focusFilePath);

      if (file instanceof TFile) {
        await vault.modify(file, content);
      } else {
        // File not in cache, check if it exists on disk
        const existsOnDisk = await vault.adapter.exists(focusFilePath);

        if (existsOnDisk) {
          await vault.adapter.write(focusFilePath, content);
        } else {
          await vault.create(focusFilePath, content);
        }
      }
    } catch (error) {
      console.error("Failed to save focus items to file", error);
      throw error;
    }
  });
}

/** Create each parent folder, checking the adapter when the cache is behind. */
export async function ensureFocusDataDirectory(vault: Vault, filePath: string): Promise<void> {
  const parts = filePath.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const folderPath = parts.slice(0, i).join("/");
    const stat = await vault.adapter.stat(folderPath);
    if (stat?.type === "folder") continue;
    const cached = vault.getAbstractFileByPath(folderPath);
    if (stat || (cached && !(cached instanceof TFolder))) {
      throw new ValidationError(`${folderPath} exists but is not a folder`);
    }
    if (cached instanceof TFolder) continue;
    try {
      await vault.createFolder(folderPath);
    } catch (error) {
      // Another device or operation may have created the folder in the meantime.
      if ((await vault.adapter.stat(folderPath))?.type !== "folder") throw error;
    }
  }
}
