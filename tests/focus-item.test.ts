// ABOUTME: Tests telling vault and external Focus items apart and matching the same item.
// ABOUTME: External items match by id, vault items by file, line and time added.

import { ExternalFocusItem, VaultFocusItem } from "../src/types";
import { isExternalFocusItem, isSameFocusItem, isVaultFocusItem } from "../src/focus-item";

const vaultItem: VaultFocusItem = {
  file: "Projects/Plan.md",
  lineNumber: 5,
  lineContent: "- [ ] Write the plan",
  text: "Write the plan",
  sphere: "work",
  isGeneral: false,
  addedAt: 1,
};

const externalItem: ExternalFocusItem = {
  id: "7c1e",
  text: "Draft section 2",
  sphere: "work",
  addedAt: 1,
  external: {
    sourceName: "linear",
    sourceLabel: "Rootcause",
    url: "https://linear.app/rootcause/issue/ROO-123",
    externalId: "ROO-123",
  },
};

describe("isExternalFocusItem", () => {
  it("tells the two kinds apart", () => {
    expect(isExternalFocusItem(externalItem)).toBe(true);
    expect(isExternalFocusItem(vaultItem)).toBe(false);
    expect(isVaultFocusItem(vaultItem)).toBe(true);
    expect(isVaultFocusItem(externalItem)).toBe(false);
  });
});

describe("isSameFocusItem", () => {
  it("matches external items by id, whatever else changed", () => {
    expect(
      isSameFocusItem(externalItem, { ...externalItem, text: "New wording", addedAt: 2 })
    ).toBe(true);
    expect(isSameFocusItem(externalItem, { ...externalItem, id: "other" })).toBe(false);
  });

  it("matches vault items by file, line number and time added", () => {
    expect(isSameFocusItem(vaultItem, { ...vaultItem, text: "Changed text" })).toBe(true);
    expect(isSameFocusItem(vaultItem, { ...vaultItem, file: "Other.md" })).toBe(false);
    expect(isSameFocusItem(vaultItem, { ...vaultItem, lineNumber: 6 })).toBe(false);
    expect(isSameFocusItem(vaultItem, { ...vaultItem, addedAt: 2 })).toBe(false);
  });

  it("never matches an external item with a vault item", () => {
    expect(isSameFocusItem(vaultItem, externalItem)).toBe(false);
    expect(isSameFocusItem(externalItem, vaultItem)).toBe(false);
  });
});
