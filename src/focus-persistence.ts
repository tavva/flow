// ABOUTME: Handles persistence of focus items to a JSON file in the vault
// ABOUTME: Provides methods to load and save focus items with automatic migration

import { Vault, TFile, TFolder } from "obsidian";
import { FocusItem } from "./types";

const FOCUS_FILE_PATH = ".flow/focus.json";
const FOCUS_FILE_VERSION = 1;

interface FocusFileFormat {
  version: number;
  items: FocusItem[];
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
          const data: FocusFileFormat = JSON.parse(content);
          return data.items || [];
        }
      } catch (adapterError) {
        // File doesn't exist yet, will return empty array below
      }

      // File doesn't exist at all, return empty array
      return [];
    }

    const content = await vault.read(file);
    const data: FocusFileFormat = JSON.parse(content);

    // Validate version
    if (data.version !== FOCUS_FILE_VERSION) {
      console.warn(
        `Focus file version mismatch: expected ${FOCUS_FILE_VERSION}, got ${data.version}`
      );
      // Could add migration logic here in the future
    }

    return data.items || [];
  } catch (error) {
    console.error("Failed to load focus items from file", error);
    return [];
  }
}

/**
 * Save focus items to the vault file
 */
export async function saveFocusItems(vault: Vault, items: FocusItem[]): Promise<void> {
  try {
    // Ensure .flow directory exists
    await ensureFlowDirectory(vault);

    const data: FocusFileFormat = {
      version: FOCUS_FILE_VERSION,
      items,
    };

    const content = JSON.stringify(data, null, 2);

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
 * Ensure the .flow directory exists
 */
async function ensureFlowDirectory(vault: Vault): Promise<void> {
  // Check if folder exists on disk first (adapter is more reliable than cache)
  try {
    const exists = await vault.adapter.exists(".flow");
    if (exists) {
      const stat = await vault.adapter.stat(".flow");
      if (stat?.type === "folder") {
        return;
      }
    }
  } catch (error) {
    // Ignore errors, will try cache or create below
  }

  // Try to get from cache
  const flowDir = vault.getAbstractFileByPath(".flow");

  if (flowDir instanceof TFolder) {
    return;
  }

  if (flowDir) {
    throw new Error(".flow exists but is not a folder");
  }

  // Create the folder
  try {
    await vault.createFolder(".flow");
  } catch (error) {
    // Might have been created in race condition, check if it exists now
    const exists = await vault.adapter.exists(".flow");
    if (exists) {
      return;
    }
    throw error;
  }
}
