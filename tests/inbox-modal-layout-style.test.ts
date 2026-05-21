// ABOUTME: Regression tests for inbox processing view layout styling.
// ABOUTME: Ensures the panel sizes to its container, not the viewport, so content stays centred.

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

describe("inbox modal layout styling", () => {
  it("sizes the panel to its container, not the viewport", () => {
    const block = getCssBlock(readStyles(), ".flow-gtd-inbox-modal");

    // Viewport units (vw) follow the window width, not the leaf width, so the
    // panel overflows and content drifts off-centre when sidebars are open.
    const width = getDeclaration(block, "width");
    expect(width).toBe("100%");
    expect(width).not.toMatch(/vw/);
    expect(getDeclaration(block, "max-width")).toBe("1200px");
    expect(getDeclaration(block, "margin")).toBe("0 auto");
  });
});
