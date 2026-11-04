// ABOUTME: Public API that lets other plugins add, change and watch Focus items with no vault line.
// ABOUTME: Reports changes by comparing snapshots of the focus file, so every writer is covered.

import { Vault } from "obsidian";
import { ExternalFocusItem, FocusItem, PluginSettings } from "./types";
import { ValidationError } from "./errors";
import { loadFocusItems, updateFocusItems } from "./focus-persistence";
import { isExternalFocusItem, isWebUrl } from "./focus-item";
import { resolveFocusFilePath } from "./focus-file-path";
import { resolveMovedFocusFilePath } from "./focus-file-operations";
import { clearActiveTimeout, setActiveTimeout, TimerHandle } from "./obsidian-platform";

// How long the focus file must stay unchanged after a modify event before Flow compares it,
// so half-synced states (an empty or truncated file) settle first.
export const FOCUS_CHANGE_SETTLE_MS = 1000;

export interface NewExternalFocusItem {
  text: string;
  sphere: string;
  sourceName: string;
  sourceLabel: string;
  url: string;
  externalId: string;
}

export type ExternalFocusItemChanges = Partial<{
  text: string;
  sphere: string;
  sourceLabel: string;
  url: string;
  externalId: string;
}>;

export type FocusChange =
  | { type: "added"; item: ExternalFocusItem }
  | { type: "edited"; item: ExternalFocusItem; previous: ExternalFocusItem }
  | { type: "completed"; item: ExternalFocusItem }
  | { type: "removed"; item: ExternalFocusItem };

export type FocusChangeCallback = (change: FocusChange) => void;

export interface FlowApi {
  apiVersion: 1;

  addFocusItem(input: NewExternalFocusItem): Promise<string>; // Returns the new item's id
  updateFocusItem(id: string, changes: ExternalFocusItemChanges): Promise<void>;
  completeFocusItem(id: string): Promise<void>; // Sets completedAt
  removeFocusItem(id: string): Promise<void>;

  getFocusItems(sourceName: string): Promise<ExternalFocusItem[]>;
  getSpheres(): string[];

  onFocusChange(sourceName: string, callback: FocusChangeCallback): () => void;
}

/**
 * Compare two versions of the focus list and describe what happened to external items.
 * Pinning and reordering are not reported.
 */
export function diffExternalFocusItems(before: FocusItem[], after: FocusItem[]): FocusChange[] {
  const previousById = new Map(before.filter(isExternalFocusItem).map((item) => [item.id, item]));
  const currentItems = after.filter(isExternalFocusItem);
  const currentIds = new Set(currentItems.map((item) => item.id));
  const changes: FocusChange[] = [];

  for (const item of currentItems) {
    const previous = previousById.get(item.id);
    if (!previous) {
      changes.push({ type: "added", item });
      continue;
    }
    if (
      item.text !== previous.text ||
      item.sphere !== previous.sphere ||
      item.external.sourceLabel !== previous.external.sourceLabel ||
      item.external.url !== previous.external.url ||
      item.external.externalId !== previous.external.externalId
    ) {
      changes.push({ type: "edited", item, previous });
    }
    if (item.completedAt && !previous.completedAt) {
      changes.push({ type: "completed", item });
    }
  }

  for (const [id, item] of previousById) {
    if (!currentIds.has(id)) {
      changes.push({ type: "removed", item });
    }
  }

  return changes;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`Focus item ${field} must not be empty`);
  }
  return value;
}

function requireWebUrl(value: unknown): string {
  if (!isWebUrl(value)) {
    throw new ValidationError("Focus item url must be an http or https link");
  }
  return value as string;
}

function findExternalItem(items: FocusItem[], id: string): ExternalFocusItem {
  const item = items.find((entry) => isExternalFocusItem(entry) && entry.id === id);
  if (!item || !isExternalFocusItem(item)) {
    throw new ValidationError(`No Focus item with id ${id}`);
  }
  return item;
}

export class FocusApi implements FlowApi {
  readonly apiVersion = 1;
  private callbacks = new Map<string, Set<FocusChangeCallback>>();
  // The focus list as last compared, and the file it was read from
  private snapshot: { path: string; items: FocusItem[] } | null = null;
  private pendingCheck: Promise<void> = Promise.resolve();
  private settleTimer: TimerHandle | null = null;
  private disposed = false;

  constructor(
    private vault: Vault,
    private getSettings: () => PluginSettings,
    private settleMs = FOCUS_CHANGE_SETTLE_MS
  ) {}

  async addFocusItem(input: NewExternalFocusItem): Promise<string> {
    const text = requireText(input.text, "text").trim();
    const item: ExternalFocusItem = {
      id: crypto.randomUUID(),
      text,
      sphere: requireText(input.sphere, "sphere"),
      addedAt: Date.now(),
      external: {
        sourceName: requireText(input.sourceName, "sourceName"),
        sourceLabel: requireText(input.sourceLabel, "sourceLabel"),
        url: requireWebUrl(input.url),
        externalId: requireText(input.externalId, "externalId"),
      },
      contexts: [],
    };
    await this.write((items) => [...items, item]);
    return item.id;
  }

  async updateFocusItem(id: string, changes: ExternalFocusItemChanges): Promise<void> {
    const text = changes.text === undefined ? undefined : requireText(changes.text, "text").trim();
    const sphere = changes.sphere === undefined ? undefined : requireText(changes.sphere, "sphere");
    const sourceLabel =
      changes.sourceLabel === undefined
        ? undefined
        : requireText(changes.sourceLabel, "sourceLabel");
    const url = changes.url === undefined ? undefined : requireWebUrl(changes.url);
    const externalId =
      changes.externalId === undefined ? undefined : requireText(changes.externalId, "externalId");
    await this.write((items) => {
      const item = findExternalItem(items, id);
      if (text !== undefined) item.text = text;
      if (sphere !== undefined) item.sphere = sphere;
      if (sourceLabel !== undefined) item.external.sourceLabel = sourceLabel;
      if (url !== undefined) item.external.url = url;
      if (externalId !== undefined) item.external.externalId = externalId;
      return items;
    });
  }

  async completeFocusItem(id: string): Promise<void> {
    await this.write((items) => {
      const item = findExternalItem(items, id);
      // Completing twice keeps the first completion time
      item.completedAt ??= Date.now();
      return items;
    });
  }

  async removeFocusItem(id: string): Promise<void> {
    await this.write((items) => {
      const item = findExternalItem(items, id);
      return items.filter((entry) => entry !== item);
    });
  }

  // Items are parsed fresh from the file on every call, so callers get their own objects
  async getFocusItems(sourceName: string): Promise<ExternalFocusItem[]> {
    const items = await loadFocusItems(this.vault, this.getSettings().focusFilePath);
    return items.filter(
      (item): item is ExternalFocusItem =>
        isExternalFocusItem(item) && item.external.sourceName === sourceName
    );
  }

  getSpheres(): string[] {
    return [...this.getSettings().spheres];
  }

  onFocusChange(sourceName: string, callback: FocusChangeCallback): () => void {
    if (this.disposed) return () => {};
    const callbacks = this.callbacks.get(sourceName) ?? new Set<FocusChangeCallback>();
    callbacks.add(callback);
    this.callbacks.set(sourceName, callbacks);
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0 && this.callbacks.get(sourceName) === callbacks) {
        this.callbacks.delete(sourceName);
      }
    };
  }

  /**
   * Read the focus file and report how external items changed since the last check.
   * The first check only records the file's state. Checks run one at a time, in order.
   */
  checkForChanges(): Promise<void> {
    const check = this.pendingCheck.then(() => this.compareWithSnapshot());
    this.pendingCheck = check.catch(() => undefined);
    return check;
  }

  /**
   * Check for changes once the focus file has stayed unchanged for a moment.
   * Used for vault events, which arrive in bursts while a sync is writing the file.
   */
  checkForChangesWhenSettled(): void {
    if (this.disposed) return;
    if (this.settleTimer !== null) clearActiveTimeout(this.settleTimer);
    this.settleTimer = setActiveTimeout(() => {
      this.settleTimer = null;
      this.checkForChanges().catch((error) => {
        console.error("Failed to check focus file for changes", error);
      });
    }, this.settleMs);
  }

  /** Stop all callbacks and refuse further writes. Called when Flow unloads. */
  dispose(): void {
    this.disposed = true;
    this.callbacks.clear();
    if (this.settleTimer !== null) {
      clearActiveTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private focusFilePath(): string {
    return resolveMovedFocusFilePath(
      this.vault,
      resolveFocusFilePath(this.getSettings().focusFilePath)
    );
  }

  private async write(update: (items: FocusItem[]) => FocusItem[]): Promise<void> {
    if (this.disposed) {
      throw new Error("Flow has been unloaded; get the API again once Flow is ready");
    }
    await updateFocusItems(this.vault, update, this.getSettings().focusFilePath);
    // The write has succeeded; a failed check must not make the caller retry it
    try {
      await this.checkForChanges();
    } catch (error) {
      console.error("Failed to check focus file for changes", error);
    }
  }

  private async compareWithSnapshot(): Promise<void> {
    const path = this.focusFilePath();
    const items = await loadFocusItems(this.vault, path);
    const previous = this.snapshot;
    this.snapshot = { path, items };
    // A first read, or a different focus file, only records the starting state
    if (previous === null || previous.path !== path) return;

    for (const change of diffExternalFocusItems(previous.items, items)) {
      for (const callback of this.callbacks.get(change.item.external.sourceName) ?? []) {
        try {
          // Each callback gets its own copy, so changing it can't affect Flow or other callbacks
          callback(structuredClone(change));
        } catch (error) {
          console.error("Focus change callback failed", error);
        }
      }
    }
  }
}
