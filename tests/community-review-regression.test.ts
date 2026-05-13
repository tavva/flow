// ABOUTME: Regression checks for Obsidian community source review findings.
// ABOUTME: Guards against scanner warnings that are easy to reintroduce.

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..");

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf-8");
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (leftParts[i] ?? 0) - (rightParts[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

describe("community source review regressions", () => {
  const sourceFiles = [
    "main.ts",
    "src/add-to-inbox-modal.ts",
    "src/focus-editor-menu.ts",
    "src/focus-view.ts",
    "src/inbox-item-persistence.ts",
    "src/inbox-modal-state.ts",
    "src/inbox-modal-views.ts",
    "src/inbox-processing-view.ts",
    "src/new-person-modal.ts",
    "src/new-project-modal.ts",
    "src/obsidian-platform.ts",
    "src/settings-tab.ts",
    "src/someday-view.ts",
    "src/sphere-view.ts",
    "src/waiting-for-view.ts",
  ];

  it("does not use unsafe or scanner-flagged DOM APIs in production source", () => {
    for (const file of sourceFiles) {
      const content = readRepoFile(file);

      expect(content).not.toMatch(/\.(?:innerHTML|outerHTML)\b/);
      expect(content).not.toMatch(/\.style\.display\b/);
      expect(content).not.toMatch(/\bconfirm\s*\(/);
    }
  });

  it("does not detach workspace leaves during plugin unload", () => {
    expect(readRepoFile("main.ts")).not.toMatch(/\bdetachLeavesOfType\s*\(/);
  });

  it("uses the current markdown renderer API", () => {
    expect(readRepoFile("src/focus-view.ts")).not.toContain(".renderMarkdown(");
    expect(readRepoFile("src/sphere-view.ts")).not.toContain(".renderMarkdown(");
  });

  it("uses Obsidian active globals without falling back through globalThis", () => {
    expect(readRepoFile("src/obsidian-platform.ts")).not.toContain("globalThis");
  });

  it("advertises the minimum Obsidian version required by used APIs", () => {
    const manifest = JSON.parse(readRepoFile("manifest.json")) as { minAppVersion: string };

    expect(compareSemver(manifest.minAppVersion, "1.7.2")).toBeGreaterThanOrEqual(0);
  });

  it("uses Node builtins instead of the deprecated builtin-modules package", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies).not.toHaveProperty("builtin-modules");
    expect(readRepoFile("esbuild.config.mjs")).not.toContain("builtin-modules");
  });
});
