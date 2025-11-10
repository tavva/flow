// ABOUTME: Appends captured text to inbox file
// ABOUTME: Creates file and parent directories if needed

import * as fs from "fs";
import * as path from "path";

export function capture(vaultPath: string, inboxFile: string, text: string): void {
  // Expand ~ to home directory
  const expandedVaultPath = vaultPath.replace(/^~/, process.env.HOME || "");
  const inboxPath = path.join(expandedVaultPath, inboxFile);
  const dir = path.dirname(inboxPath);

  // Create parent directories if needed
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append text with newline
  fs.appendFileSync(inboxPath, `${text}\n`);
}
