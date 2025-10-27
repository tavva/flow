// ABOUTME: Right-click context menu for adding/removing actions from focus.
// ABOUTME: Provides menu items when right-clicking checkbox lines in editor.

import { App, Editor, Menu, MarkdownView, TFile } from "obsidian";
import { FocusItem, PluginSettings } from "./types";
import { ActionLineFinder } from "./action-line-finder";
import { FOCUS_VIEW_TYPE } from "./focus-view";

/**
 * Check if a line contains a checkbox (task)
 */
export function isCheckboxLine(line: string): boolean {
  return /^[-*]\s*\[(?: |x|X|w)\]/.test(line);
}

/**
 * Extract the action text from a checkbox line
 */
export function extractActionText(line: string): string {
  const match = line.match(/^[-*]\s*\[(?: |x|X|w)\]\s*(.*)$/);
  if (!match) {
    return "";
  }
  return match[1].trim();
}

/**
 * Determine the sphere for an action based on file context and inline tags
 * Returns null if no sphere can be determined
 */
export async function determineActionSphere(
  app: App,
  filePath: string,
  line: string
): Promise<string | null> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    return null;
  }

  // First check if this is a project file (has project/* tags)
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

  // Check for inline #sphere/X tag in the line
  const sphereTagMatch = line.match(/#sphere\/([^\s]+)/i);
  if (sphereTagMatch) {
    return sphereTagMatch[1];
  }

  return null;
}

/**
 * Check if an action is already on the focus
 */
export function isActionOnFocus(filePath: string, lineNumber: number, focus: FocusItem[]): boolean {
  return focus.some((item) => item.file === filePath && item.lineNumber === lineNumber);
}

/**
 * Register the editor menu handler
 */
export function registerFocusEditorMenu(
  app: App,
  settings: PluginSettings,
  saveSettings: () => Promise<void>,
  refreshFocusView: () => Promise<void>
) {
  return app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Only show menu item if this is a checkbox line
    if (!isCheckboxLine(line)) {
      return;
    }

    const file = view.file;
    if (!file) {
      return;
    }

    const filePath = file.path;
    const lineNumber = cursor.line + 1; // Convert to 1-indexed

    // Determine the sphere synchronously
    const cache = app.metadataCache.getFileCache(file);
    let sphere: string | null = null;

    // Check if this is a project file (has project/* tags)
    if (cache?.frontmatter?.tags) {
      const tags = Array.isArray(cache.frontmatter.tags)
        ? cache.frontmatter.tags
        : [cache.frontmatter.tags];

      for (const tag of tags) {
        const normalizedTag = tag.replace(/^#/, "");
        if (normalizedTag.startsWith("project/")) {
          sphere = normalizedTag.slice("project/".length);
          break;
        }
      }
    }

    // Check for inline #sphere/X tag in the line
    if (!sphere) {
      const sphereTagMatch = line.match(/#sphere\/([^\s]+)/i);
      if (sphereTagMatch) {
        sphere = sphereTagMatch[1];
      }
    }

    if (!sphere) {
      // No sphere found, can't add to focus
      return;
    }

    // Check if already on focus
    const onFocus = isActionOnFocus(filePath, lineNumber, settings.focus);

    // Add menu item
    menu.addItem((item) => {
      item
        .setTitle(onFocus ? "Remove from Focus" : "Add to Focus")
        .setIcon(onFocus ? "x" : "plus")
        .onClick(async () => {
          if (onFocus) {
            await removeFromFocus(
              app,
              filePath,
              lineNumber,
              settings,
              saveSettings,
              refreshFocusView
            );
          } else {
            await addToFocus(
              app,
              filePath,
              lineNumber,
              line,
              sphere,
              settings,
              saveSettings,
              refreshFocusView
            );
          }
        });
    });
  });
}

/**
 * Add an action to the focus
 */
async function addToFocus(
  app: App,
  filePath: string,
  lineNumber: number,
  lineContent: string,
  sphere: string,
  settings: PluginSettings,
  saveSettings: () => Promise<void>,
  refreshFocusView: () => Promise<void>
): Promise<void> {
  const actionText = extractActionText(lineContent);
  if (!actionText) {
    return;
  }

  // Determine if this is a general action (from next actions file)
  const isGeneral = filePath === (settings.nextActionsFilePath?.trim() || "Next actions.md");

  const item: FocusItem = {
    file: filePath,
    lineNumber,
    lineContent,
    text: actionText,
    sphere,
    isGeneral,
    addedAt: Date.now(),
  };

  settings.focus.push(item);
  await saveSettings();
  await activateFocusView(app);
  await refreshFocusView();
}

/**
 * Remove an action from the focus
 */
async function removeFromFocus(
  app: App,
  filePath: string,
  lineNumber: number,
  settings: PluginSettings,
  saveSettings: () => Promise<void>,
  refreshFocusView: () => Promise<void>
): Promise<void> {
  settings.focus = settings.focus.filter(
    (item) => !(item.file === filePath && item.lineNumber === lineNumber)
  );
  await saveSettings();
  await activateFocusView(app);
  await refreshFocusView();
}

/**
 * Activate (open/reveal) the focus view in the right sidebar
 */
async function activateFocusView(app: App): Promise<void> {
  const { workspace } = app;

  let leaf = workspace.getLeavesOfType(FOCUS_VIEW_TYPE)[0];

  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: FOCUS_VIEW_TYPE,
        active: true,
      });
      leaf = rightLeaf;
    }
  }

  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}
