// ABOUTME: Handles persistence of focus items to a file in the vault
// ABOUTME: Uses JSONL format (one JSON object per line) for sync-friendly storage

import { Vault, TFile, TFolder } from "obsidian";
import { FocusItem } from "./types";
import { ValidationError } from "./errors";

export const FOCUS_FILE_PATH = "flow-focus-data/focus.md";

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
export async function loadFocusItems(vault: Vault): Promise<FocusItem[]> {
  try {
    let file = vault.getAbstractFileByPath(FOCUS_FILE_PATH);

    // If file not found via cache, try reading directly from adapter
    if (!(file instanceof TFile)) {
      try {
        // Check if file exists on disk but not in cache yet
        const exists = await vault.adapter.exists(FOCUS_FILE_PATH);
        if (exists) {
          const content = await vault.adapter.read(FOCUS_FILE_PATH);
          if (isLegacyFormat(content)) {
            return parseLegacyFormat(content);
          }
          return parseJsonlFormat(content);
        }
      } catch (adapterError) {
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
export async function saveFocusItems(vault: Vault, items: FocusItem[]): Promise<void> {
  try {
    // Ensure flow-focus-data directory exists
    await ensureFocusDataDirectory(vault);

    const content = toJsonlFormat(items);

    // Check if file exists via cache first
    const file = vault.getAbstractFileByPath(FOCUS_FILE_PATH);

    if (file instanceof TFile) {
      await vault.modify(file, content);
    } else {
      // File not in cache, check if it exists on disk
      const existsOnDisk = await vault.adapter.exists(FOCUS_FILE_PATH);

      if (existsOnDisk) {
        await vault.adapter.write(FOCUS_FILE_PATH, content);
      } else {
        await vault.create(FOCUS_FILE_PATH, content);
      }
    }
  } catch (error) {
    console.error("Failed to save focus items to file", error);
    throw error;
  }
}

/**
 * Ensure the flow-focus-data directory exists
 */
async function ensureFocusDataDirectory(vault: Vault): Promise<void> {
  // Check if folder exists on disk first (adapter is more reliable than cache)
  try {
    const exists = await vault.adapter.exists("flow-focus-data");
    if (exists) {
      const stat = await vault.adapter.stat("flow-focus-data");
      if (stat?.type === "folder") {
        return;
      }
    }
  } catch (error) {
    // Ignore errors, will try cache or create below
  }

  // Try to get from cache
  const focusDataDir = vault.getAbstractFileByPath("flow-focus-data");

  if (focusDataDir instanceof TFolder) {
    return;
  }

  if (focusDataDir) {
    throw new ValidationError("flow-focus-data exists but is not a folder");
  }

  // Create the folder
  try {
    await vault.createFolder("flow-focus-data");
  } catch (error) {
    // Might have been created in race condition, check if it exists now
    const exists = await vault.adapter.exists("flow-focus-data");
    if (exists) {
      return;
    }
    throw error;
  }
}
