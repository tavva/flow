// ABOUTME: Public API that lets other plugins add, change and watch Focus items with no vault line.
// ABOUTME: Reports changes by comparing snapshots of the focus file, so every writer is covered.

import { Vault } from "obsidian";
import { ExternalFocusItem, FocusItem, PluginSettings } from "./types";
import { ValidationError } from "./errors";
import { loadFocusItems, updateFocusItems } from "./focus-persistence";
import { isExternalFocusItem } from "./focus-item";

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
      item.external.url !== previous.external.url
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
  private snapshot: FocusItem[] | null = null;
  private pendingCheck: Promise<void> = Promise.resolve();

  constructor(
    private vault: Vault,
    private getSettings: () => PluginSettings
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
        sourceLabel: input.sourceLabel,
        url: input.url,
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
    await this.write((items) => {
      const item = findExternalItem(items, id);
      if (text !== undefined) item.text = text;
      if (sphere !== undefined) item.sphere = sphere;
      if (changes.sourceLabel !== undefined) item.external.sourceLabel = changes.sourceLabel;
      if (changes.url !== undefined) item.external.url = changes.url;
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
    const callbacks = this.callbacks.get(sourceName) ?? new Set<FocusChangeCallback>();
    callbacks.add(callback);
    this.callbacks.set(sourceName, callbacks);
    return () => {
      callbacks.delete(callback);
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

  clearCallbacks(): void {
    this.callbacks.clear();
  }

  private async write(update: (items: FocusItem[]) => FocusItem[]): Promise<void> {
    await updateFocusItems(this.vault, update, this.getSettings().focusFilePath);
    await this.checkForChanges();
  }

  private async compareWithSnapshot(): Promise<void> {
    const items = await loadFocusItems(this.vault, this.getSettings().focusFilePath);
    const previous = this.snapshot;
    this.snapshot = items;
    if (previous === null) return;

    for (const change of diffExternalFocusItems(previous, items)) {
      for (const callback of this.callbacks.get(change.item.external.sourceName) ?? []) {
        try {
          callback(change);
        } catch (error) {
          console.error("Focus change callback failed", error);
        }
      }
    }
  }
}
