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

/** True for http and https links, the only kinds an external item may open. */
export function isWebUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Checks that a parsed line marked as external has the fields Flow relies on. */
export function hasValidExternalSource(item: object): boolean {
  const { id, external } = item as { id?: unknown; external?: unknown };
  if (typeof id !== "string" || typeof external !== "object" || external === null) return false;
  const source = external as Record<string, unknown>;
  return ["sourceName", "sourceLabel", "url", "externalId"].every(
    (field) => typeof source[field] === "string"
  );
}
