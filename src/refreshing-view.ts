// ABOUTME: Base class for views that auto-refresh when vault files change
// ABOUTME: Provides debounced refresh, metadata cache listening, and cleanup

import { EventRef, ItemView, TFile, WorkspaceLeaf } from "obsidian";

export abstract class RefreshingView extends ItemView {
  private modifyEventRef: EventRef | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  protected isRefreshing = false;
  private defaultDebounceTime: number;

  constructor(leaf: WorkspaceLeaf, debounceTime?: number) {
    super(leaf);
    this.defaultDebounceTime = debounceTime ?? 2000;
  }

  /**
   * Subclasses implement this to perform the actual refresh logic
   */
  protected abstract performRefresh(): Promise<void>;

  /**
   * Returns the debounce time in milliseconds.
   * Subclasses can override for dynamic debounce times.
   */
  protected getDebounceTime(): number {
    return this.defaultDebounceTime;
  }

  /**
   * Trigger an immediate refresh. Use when external code needs to refresh the view.
   */
  public async triggerRefresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    // Cancel any pending debounced refresh
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    this.isRefreshing = true;
    try {
      await this.performRefresh();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Schedule a debounced refresh. Multiple calls within debounceTime
   * will only trigger one refresh.
   */
  protected scheduleRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = setTimeout(async () => {
      this.refreshTimeout = null;

      if (this.isRefreshing) {
        return;
      }

      this.isRefreshing = true;
      try {
        await this.performRefresh();
      } finally {
        this.isRefreshing = false;
      }
    }, this.getDebounceTime());
  }

  /**
   * Register a metadata cache listener that triggers refresh based on predicate
   */
  protected registerMetadataCacheListener(shouldRefresh: (file: TFile) => boolean): void {
    this.modifyEventRef = this.app.metadataCache.on("changed", (file) => {
      if (shouldRefresh(file)) {
        this.scheduleRefresh();
      }
    });
  }

  /**
   * Clean up event listeners and pending timeouts.
   * Call this from onClose() in subclasses.
   */
  protected cleanup(): void {
    if (this.modifyEventRef) {
      this.app.metadataCache.offref(this.modifyEventRef);
      this.modifyEventRef = null;
    }

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }
}
