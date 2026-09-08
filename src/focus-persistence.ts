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
  return withFocusFileLock(vault, () =>
    readFocusItems(vault, resolveMovedFocusFilePath(vault, resolveFocusFilePath(filePath)))
  );
}

// Only call while holding the vault's focus lock. Read errors must abort updates.
async function readFocusItems(vault: Vault, filePath: string): Promise<FocusItem[]> {
  const file = vault.getAbstractFileByPath(filePath);
  let content: string;
  if (file instanceof TFile) {
    content = await vault.read(file);
  } else {
    if (!(await vault.adapter.exists(filePath))) return [];
    content = await vault.adapter.read(filePath);
  }
  return isLegacyFormat(content) ? parseLegacyFormat(content) : parseJsonlFormat(content);
}

/**
 * Read, change, and save the latest focus list under one lock, including relocation.
 * Callbacks must not call other locking focus operations.
 */
export async function updateFocusItems(
  vault: Vault,
  update: (items: FocusItem[]) => FocusItem[] | Promise<FocusItem[]>,
  filePath?: string
): Promise<FocusItem[]> {
  return withFocusFileLock(vault, async () => {
    const path = resolveMovedFocusFilePath(vault, resolveFocusFilePath(filePath));
    const items = await update(await readFocusItems(vault, path));
    await writeFocusItems(vault, items, path);
    return items;
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
  return withFocusFileLock(vault, () =>
    writeFocusItems(vault, items, resolveMovedFocusFilePath(vault, resolveFocusFilePath(filePath)))
  );
}

// Only call while holding the vault's focus lock.
async function writeFocusItems(vault: Vault, items: FocusItem[], filePath: string): Promise<void> {
  await ensureFocusDataDirectory(vault, filePath);
  const content = toJsonlFormat(items);
  const file = vault.getAbstractFileByPath(filePath);
  if (file instanceof TFile) {
    await vault.modify(file, content);
  } else if (await vault.adapter.exists(filePath)) {
    await vault.adapter.write(filePath, content);
  } else {
    await vault.create(filePath, content);
  }
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
