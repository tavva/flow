// ABOUTME: Moves the focus file or explicitly selects an existing destination.
// ABOUTME: Preserves both files on conflicts and restores the source if saving settings fails.

import { App, TFile, TFolder } from "obsidian";
import { ValidationError } from "./errors";
import { ensureFocusDataDirectory } from "./focus-persistence";
import {
  withFocusFileLock,
  recordFocusFileMove,
  selectFocusFilePath,
} from "./focus-file-operations";

export async function moveFocusFile(
  app: App,
  sourcePath: string,
  destinationPath: string,
  confirmExisting: (path: string) => Promise<boolean>,
  savePath: () => Promise<void>
): Promise<boolean> {
  return withFocusFileLock(app.vault, async () => {
    const destination = app.vault.getAbstractFileByPath(destinationPath);
    const destinationStat = await app.vault.adapter.stat(destinationPath);
    if (destination instanceof TFolder || destinationStat?.type === "folder") {
      throw new ValidationError("The focus file path points to a folder. Choose a Markdown file.");
    }
    if (destination instanceof TFile || destinationStat?.type === "file") {
      if (!(await confirmExisting(destinationPath))) return false;
      await savePath();
      selectFocusFilePath(app.vault, destinationPath);
      return true;
    }

    const source = app.vault.getAbstractFileByPath(sourcePath);
    if (!(source instanceof TFile)) {
      if (source || (await app.vault.adapter.exists(sourcePath))) {
        throw new ValidationError(
          "The current focus file is unavailable. Wait for the vault to finish syncing and try again."
        );
      }
      // Nothing to move yet; persistence creates the file on the first write.
      await savePath();
      recordFocusFileMove(app.vault, sourcePath, destinationPath);
      return true;
    }

    await ensureFocusDataDirectory(app.vault, destinationPath);
    // FileManager preserves Obsidian links and rejects an occupied destination.
    await app.fileManager.renameFile(source, destinationPath);
    try {
      await savePath();
    } catch (error) {
      try {
        await app.fileManager.renameFile(source, sourcePath);
      } catch {
        throw new Error(
          `Could not save the setting or restore the original file. Your focus file is at ${destinationPath}.`
        );
      }
      throw error;
    }
    recordFocusFileMove(app.vault, sourcePath, destinationPath);
    return true;
  });
}
