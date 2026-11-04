// ABOUTME: Tells vault and external Focus items apart and decides when two items are the same.
// ABOUTME: External items match by id; vault items by file, line number and time added.

import { ExternalFocusItem, FocusItem, VaultFocusItem } from "./types";

export function isExternalFocusItem(item: FocusItem): item is ExternalFocusItem {
  return "external" in item;
}

export function isVaultFocusItem(item: FocusItem): item is VaultFocusItem {
  return !isExternalFocusItem(item);
}

export function isSameFocusItem(a: FocusItem, b: FocusItem): boolean {
  if (isExternalFocusItem(a) || isExternalFocusItem(b)) {
    return isExternalFocusItem(a) && isExternalFocusItem(b) && a.id === b.id;
  }
  return a.file === b.file && a.lineNumber === b.lineNumber && a.addedAt === b.addedAt;
}
