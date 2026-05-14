// ABOUTME: Regression tests for modal validation error styling.
// ABOUTME: Ensures error labels remain readable against Obsidian theme colors.

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..");

function readStyles(): string {
  return readFileSync(join(repoRoot, "styles.css"), "utf-8");
}

function getCssBlock(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  if (!match) {
    throw new Error(`Missing CSS selector: ${selector}`);
  }

  return match[1];
}

function getDeclaration(block: string, property: string): string | undefined {
  const declaration = block
    .split(";")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${property}:`));

  return declaration?.slice(property.length + 1).trim();
}

describe("modal error styling", () => {
  it("uses readable text on the error background", () => {
    const errorBlock = getCssBlock(readStyles(), ".flow-gtd-modal-error");

    expect(getDeclaration(errorBlock, "background-color")).toBe("var(--background-modifier-error)");
    expect(getDeclaration(errorBlock, "color")).toBe("var(--text-on-accent)");
  });
});
