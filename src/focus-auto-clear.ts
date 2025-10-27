// ABOUTME: Handles automatic clearing and archiving of focus items
// ABOUTME: Checks if it's time to clear based on user-configured time

import { TFile, Vault } from "obsidian";
import { FocusItem } from "./types";

/**
 * Determines if the focus should be cleared based on the configured time and last clear timestamp
 */
export function shouldClearFocus(
  autoClearTime: string,
  lastClearTimestamp: number,
  now: Date = new Date()
): boolean {
  // Auto-clear is disabled
  if (!autoClearTime || autoClearTime.trim() === "") {
    return false;
  }

  // Parse the clear time (e.g., "03:00" or "3:00")
  const [hoursStr, minutesStr] = autoClearTime.split(":");
  const clearHours = parseInt(hoursStr, 10);
  const clearMinutes = parseInt(minutesStr, 10);

  if (isNaN(clearHours) || isNaN(clearMinutes)) {
    return false;
  }

  // Get today's clear time
  const todayClearTime = new Date(now);
  todayClearTime.setHours(clearHours, clearMinutes, 0, 0);

  // If we haven't passed the clear time today, don't clear yet
  if (now < todayClearTime) {
    return false;
  }

  // If never cleared before, clear now
  if (lastClearTimestamp === 0) {
    return true;
  }

  // Check if we already cleared today
  const lastClearDate = new Date(lastClearTimestamp);
  const lastClearDay = lastClearDate.toDateString();
  const todayDay = now.toDateString();

  // If last clear was today, don't clear again
  if (lastClearDay === todayDay) {
    return false;
  }

  // We're past the clear time and haven't cleared today
  return true;
}

/**
 * Archives cleared focus items to a file with a date/time heading
 */
export async function archiveClearedTasks(
  vault: Vault,
  items: FocusItem[],
  archiveFilePath: string,
  clearTime: Date
): Promise<void> {
  // Format the date and time for the heading
  const dateStr = clearTime.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = clearTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const heading = `## Cleared ${dateStr} at ${timeStr}\n\n`;

  let tasksContent = "";
  if (items.length === 0) {
    tasksContent = "No items were in the focus.\n\n";
  } else {
    tasksContent =
      items
        .map((item) => {
          const wikilinkPath = item.file.replace(/\.md$/, "");

          if (item.isGeneral) {
            return `- [[Next actions|${item.text}]]`;
          } else {
            return `- [[${wikilinkPath}]] ${item.text}`;
          }
        })
        .join("\n") + "\n\n";
  }

  const newContent = heading + tasksContent;

  // Check if archive file exists
  const existingFile = vault.getAbstractFileByPath(archiveFilePath);

  if (existingFile && existingFile instanceof TFile) {
    // File exists, prepend to it
    const existingContent = await vault.read(existingFile);
    const updatedContent = newContent + existingContent;
    await vault.modify(existingFile, updatedContent);
  } else if (existingFile) {
    // File exists but we need to handle as TFile (for testing)
    const existingContent = await vault.read(existingFile as TFile);
    const updatedContent = newContent + existingContent;
    await vault.modify(existingFile as TFile, updatedContent);
  } else {
    // File doesn't exist, create it
    await vault.create(archiveFilePath, newContent);
  }
}
