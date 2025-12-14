// ABOUTME: Migration for users upgrading from #flow-planned tags to JSON focus storage.
// ABOUTME: Contains scanner, migration logic, tag removal, and modals. Delete when migration complete.

import { App, Modal, Setting, TFile, Vault } from "obsidian";
import { FocusItem, PluginSettings } from "./types";
import { isCheckboxLine, extractActionText } from "./checkbox-utils";
import { loadFocusItems, saveFocusItems } from "./focus-persistence";
import { FocusView, FOCUS_VIEW_TYPE } from "./focus-view";

const LEGACY_TAG = "#flow-planned";

export interface LegacyFocusItem {
  file: string;
  lineNumber: number;
  lineContent: string;
}

export interface MigrationResult {
  migrated: FocusItem[];
  skippedNoSphere: LegacyFocusItem[];
  skippedDuplicate: LegacyFocusItem[];
}

/**
 * Scan the entire vault for checkbox lines containing #flow-planned
 */
export async function scanForLegacyFocusTags(vault: Vault): Promise<LegacyFocusItem[]> {
  const result: LegacyFocusItem[] = [];
  const files = vault.getMarkdownFiles();

  for (const file of files) {
    const content = await vault.read(file);
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCheckboxLine(line) && line.includes(LEGACY_TAG)) {
        result.push({
          file: file.path,
          lineNumber: i + 1, // 1-indexed
          lineContent: line,
        });
      }
    }
  }

  return result;
}

/**
 * Determine sphere from file frontmatter or inline tag
 */
async function determineSphere(
  app: App,
  filePath: string,
  lineContent: string
): Promise<string | null> {
  const file = app.vault.getAbstractFileByPath(filePath);

  // Check frontmatter for project/* tags
  if (file instanceof TFile) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.tags) {
      const tags = Array.isArray(cache.frontmatter.tags)
        ? cache.frontmatter.tags
        : [cache.frontmatter.tags];

      for (const tag of tags) {
        const normalizedTag = tag.replace(/^#/, "");
        if (normalizedTag.startsWith("project/")) {
          return normalizedTag.slice("project/".length);
        }
      }
    }
  }

  // Check for inline #sphere/X tag
  const sphereTagMatch = lineContent.match(/#sphere\/([^\s]+)/i);
  if (sphereTagMatch) {
    return sphereTagMatch[1];
  }

  return null;
}

/**
 * Convert legacy items to FocusItems, skipping duplicates and items without sphere
 */
export async function migrateLegacyFocusItems(
  app: App,
  legacyItems: LegacyFocusItem[],
  existingFocus: FocusItem[],
  settings: PluginSettings
): Promise<MigrationResult> {
  const migrated: FocusItem[] = [];
  const skippedNoSphere: LegacyFocusItem[] = [];
  const skippedDuplicate: LegacyFocusItem[] = [];

  const nextActionsFile = settings.nextActionsFilePath?.trim() || "Next actions.md";

  for (const legacy of legacyItems) {
    // Check for duplicate
    const isDuplicate = existingFocus.some(
      (existing) => existing.file === legacy.file && existing.lineContent === legacy.lineContent
    );

    if (isDuplicate) {
      skippedDuplicate.push(legacy);
      continue;
    }

    // Determine sphere
    const sphere = await determineSphere(app, legacy.file, legacy.lineContent);
    if (!sphere) {
      skippedNoSphere.push(legacy);
      continue;
    }

    // Create FocusItem
    const focusItem: FocusItem = {
      file: legacy.file,
      lineNumber: legacy.lineNumber,
      lineContent: legacy.lineContent,
      text: extractActionText(legacy.lineContent),
      sphere,
      isGeneral: legacy.file === nextActionsFile,
      addedAt: Date.now(),
      isPinned: false,
    };

    migrated.push(focusItem);
  }

  return { migrated, skippedNoSphere, skippedDuplicate };
}

/**
 * Remove #flow-planned tags from source files
 */
export async function removeLegacyTags(vault: Vault, items: LegacyFocusItem[]): Promise<void> {
  // Group items by file for efficient processing
  const itemsByFile = new Map<string, Set<number>>();
  for (const item of items) {
    const existing = itemsByFile.get(item.file) || new Set();
    existing.add(item.lineNumber);
    itemsByFile.set(item.file, existing);
  }

  // Process each file
  for (const [filePath, lineNumbers] of itemsByFile) {
    const file = vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      console.warn(`Legacy migration: file not found: ${filePath}`);
      continue;
    }

    const content = await vault.read(file);
    const lines = content.split("\n");

    // Process each line that has a legacy tag
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1; // 1-indexed
      if (lineNumbers.has(lineNum)) {
        // Remove tag and clean up whitespace
        lines[i] = lines[i]
          .replace(new RegExp(`\\s*${LEGACY_TAG}`, "g"), "")
          .replace(/\s+$/, "")
          .replace(/\s{2,}/g, " ");
      }
    }

    await vault.modify(file, lines.join("\n"));
  }
}

/**
 * Modal for confirming migration from legacy tags
 */
export class LegacyMigrationModal extends Modal {
  private itemCount: number;
  private onMigrate: () => Promise<void>;
  private onDismissForever: () => Promise<void>;

  constructor(
    app: App,
    itemCount: number,
    onMigrate: () => Promise<void>,
    onDismissForever: () => Promise<void>
  ) {
    super(app);
    this.itemCount = itemCount;
    this.onMigrate = onMigrate;
    this.onDismissForever = onDismissForever;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-legacy-migration-modal");

    contentEl.createEl("h2", { text: "Migrate Legacy Focus Items" });
    contentEl.createEl("p", {
      text: `Found ${this.itemCount} item${this.itemCount === 1 ? "" : "s"} with #flow-planned tags. Would you like to migrate them to the new focus system?`,
    });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const migrateBtn = buttonContainer.createEl("button", {
      text: "Migrate",
      cls: "mod-cta",
    });
    migrateBtn.addEventListener("click", async () => {
      this.close();
      await this.onMigrate();
    });

    const notNowBtn = buttonContainer.createEl("button", { text: "Not now" });
    notNowBtn.addEventListener("click", () => {
      this.close();
    });

    const dismissBtn = buttonContainer.createEl("button", { text: "Don't ask again" });
    dismissBtn.addEventListener("click", async () => {
      this.close();
      await this.onDismissForever();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for confirming tag removal after migration
 */
export class TagRemovalModal extends Modal {
  private migratedCount: number;
  private skippedCount: number;
  private onRemove: () => Promise<void>;
  private onKeepForever: () => Promise<void>;

  constructor(
    app: App,
    migratedCount: number,
    skippedCount: number,
    onRemove: () => Promise<void>,
    onKeepForever: () => Promise<void>
  ) {
    super(app);
    this.migratedCount = migratedCount;
    this.skippedCount = skippedCount;
    this.onRemove = onRemove;
    this.onKeepForever = onKeepForever;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-tag-removal-modal");

    contentEl.createEl("h2", { text: "Remove Legacy Tags" });

    let message = `Migration complete. ${this.migratedCount} item${this.migratedCount === 1 ? "" : "s"} migrated.`;
    if (this.skippedCount > 0) {
      message += ` (${this.skippedCount} item${this.skippedCount === 1 ? "" : "s"} skipped — no sphere detected)`;
    }
    contentEl.createEl("p", { text: message });

    contentEl.createEl("p", {
      text: "Would you like to remove the #flow-planned tags from your files?",
    });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const removeBtn = buttonContainer.createEl("button", {
      text: "Remove tags",
      cls: "mod-cta",
    });
    removeBtn.addEventListener("click", async () => {
      this.close();
      await this.onRemove();
    });

    const keepNowBtn = buttonContainer.createEl("button", { text: "Keep for now" });
    keepNowBtn.addEventListener("click", () => {
      this.close();
    });

    const keepForeverBtn = buttonContainer.createEl("button", { text: "Keep forever" });
    keepForeverBtn.addEventListener("click", async () => {
      this.close();
      await this.onKeepForever();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Refresh the focus view if it's open
 */
async function refreshFocusView(app: App): Promise<void> {
  const leaves = app.workspace.getLeavesOfType(FOCUS_VIEW_TYPE);
  for (const leaf of leaves) {
    const view = leaf.view;
    if (view instanceof FocusView) {
      await view.triggerRefresh();
    }
  }
}

/**
 * Main entry point: check for legacy tags and prompt user for migration
 */
export async function checkAndPromptLegacyMigration(
  app: App,
  settings: PluginSettings,
  saveSettings: () => Promise<void>
): Promise<void> {
  // Skip if user has permanently dismissed
  if (settings.legacyFocusMigrationDismissed) {
    return;
  }

  // Scan for legacy tags
  const legacyItems = await scanForLegacyFocusTags(app.vault);

  if (legacyItems.length === 0) {
    // No legacy tags, check if we should prompt for tag removal
    // (user migrated but chose to keep tags previously)
    return;
  }

  // Show migration modal
  const modal = new LegacyMigrationModal(
    app,
    legacyItems.length,
    async () => {
      // Migrate
      const existingFocus = await loadFocusItems(app.vault);
      const result = await migrateLegacyFocusItems(app, legacyItems, existingFocus, settings);

      // Save migrated items
      const newFocus = [...existingFocus, ...result.migrated];
      await saveFocusItems(app.vault, newFocus);

      // Refresh focus view to show migrated items
      await refreshFocusView(app);

      // Check if tag removal is dismissed
      if (!settings.legacyFocusTagRemovalDismissed) {
        // Show tag removal modal
        const tagModal = new TagRemovalModal(
          app,
          result.migrated.length,
          result.skippedNoSphere.length,
          async () => {
            // Remove tags from source files
            await removeLegacyTags(app.vault, legacyItems);

            // Update focus items to match new line content (without tags)
            const focusItems = await loadFocusItems(app.vault);
            const updatedItems = focusItems.map((item) => ({
              ...item,
              lineContent: item.lineContent
                .replace(new RegExp(`\\s*${LEGACY_TAG}`, "g"), "")
                .replace(/\s+$/, "")
                .replace(/\s{2,}/g, " "),
              text: item.text
                .replace(new RegExp(`\\s*${LEGACY_TAG}`, "g"), "")
                .replace(/\s+$/, "")
                .replace(/\s{2,}/g, " "),
            }));
            await saveFocusItems(app.vault, updatedItems);

            // Refresh focus view to show updated items
            await refreshFocusView(app);
          },
          async () => {
            // Keep forever
            settings.legacyFocusTagRemovalDismissed = true;
            await saveSettings();
          }
        );
        tagModal.open();
      }
    },
    async () => {
      // Don't ask again
      settings.legacyFocusMigrationDismissed = true;
      await saveSettings();
    }
  );
  modal.open();
}
