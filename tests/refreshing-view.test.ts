// ABOUTME: Tests for RefreshingView base class
// ABOUTME: Verifies debounced refresh and cleanup behavior

import { WorkspaceLeaf } from "obsidian";
import { RefreshingView } from "../src/refreshing-view";

// Concrete implementation for testing
class TestRefreshingView extends RefreshingView {
  public refreshCount = 0;
  public lastRefreshTime = 0;

  constructor(leaf: WorkspaceLeaf, debounceTime: number) {
    super(leaf, debounceTime);
  }

  getViewType(): string {
    return "test-view";
  }

  getDisplayText(): string {
    return "Test View";
  }

  protected async performRefresh(): Promise<void> {
    this.refreshCount++;
    this.lastRefreshTime = Date.now();
  }

  // Expose protected methods for testing
  public testScheduleRefresh(): void {
    this.scheduleRefresh();
  }

  public testCleanup(): void {
    this.cleanup();
  }

  public isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }
}

describe("RefreshingView", () => {
  let mockLeaf: WorkspaceLeaf;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLeaf = new WorkspaceLeaf();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("scheduleRefresh", () => {
    it("calls performRefresh after debounce time", async () => {
      const view = new TestRefreshingView(mockLeaf, 100);

      view.testScheduleRefresh();
      expect(view.refreshCount).toBe(0);

      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Allow async refresh to complete

      expect(view.refreshCount).toBe(1);
    });

    it("debounces multiple calls within debounce period", async () => {
      const view = new TestRefreshingView(mockLeaf, 100);

      view.testScheduleRefresh();
      jest.advanceTimersByTime(50);
      view.testScheduleRefresh();
      jest.advanceTimersByTime(50);
      view.testScheduleRefresh();
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(view.refreshCount).toBe(1);
    });

    it("prevents concurrent refreshes", async () => {
      let resolveRefresh: () => void;
      const refreshPromise = new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      });

      class SlowRefreshView extends RefreshingView {
        public refreshCount = 0;

        constructor(leaf: WorkspaceLeaf) {
          super(leaf, 100);
        }

        getViewType(): string {
          return "slow-test";
        }

        getDisplayText(): string {
          return "Slow Test";
        }

        protected async performRefresh(): Promise<void> {
          this.refreshCount++;
          await refreshPromise;
        }

        public testScheduleRefresh(): void {
          this.scheduleRefresh();
        }
      }

      const view = new SlowRefreshView(mockLeaf);

      // First refresh starts
      view.testScheduleRefresh();
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      expect(view.refreshCount).toBe(1);

      // Second refresh scheduled while first still running
      view.testScheduleRefresh();
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Should not increment because first refresh still in progress
      expect(view.refreshCount).toBe(1);

      // Complete first refresh
      resolveRefresh!();
      await Promise.resolve();
    });
  });

  describe("cleanup", () => {
    it("clears pending refresh timeout", async () => {
      const view = new TestRefreshingView(mockLeaf, 100);

      view.testScheduleRefresh();
      view.testCleanup();
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(view.refreshCount).toBe(0);
    });
  });

  describe("registerMetadataCacheListener", () => {
    it("registers listener that triggers scheduleRefresh", async () => {
      const view = new TestRefreshingView(mockLeaf, 100);
      const metadataCacheOn = view.app.metadataCache.on as jest.Mock;

      // Not registered yet
      expect(metadataCacheOn).not.toHaveBeenCalled();

      // Call the protected method to register
      (view as any).registerMetadataCacheListener(() => true);

      expect(metadataCacheOn).toHaveBeenCalledWith("changed", expect.any(Function));
      const registeredCallback = metadataCacheOn.mock.calls[0][1];

      // Trigger the callback
      registeredCallback({ path: "test.md" });
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(view.refreshCount).toBe(1);
    });

    it("respects shouldRefresh predicate", async () => {
      const view = new TestRefreshingView(mockLeaf, 100);
      const metadataCacheOn = view.app.metadataCache.on as jest.Mock;

      (view as any).registerMetadataCacheListener(() => false);

      const registeredCallback = metadataCacheOn.mock.calls[0][1];
      registeredCallback({ path: "test.md" });
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(view.refreshCount).toBe(0);
    });

    it("cleanup unregisters the listener", () => {
      const view = new TestRefreshingView(mockLeaf, 100);

      (view as any).registerMetadataCacheListener(() => true);
      view.testCleanup();

      expect(view.app.metadataCache.offref).toHaveBeenCalled();
    });
  });

  describe("dynamic debounce time", () => {
    it("uses getDebounceTime() for scheduling", async () => {
      class DynamicDebounceView extends RefreshingView {
        public refreshCount = 0;
        private dynamicDebounce = 200;

        constructor(leaf: WorkspaceLeaf) {
          super(leaf);
        }

        getViewType(): string {
          return "dynamic-test";
        }

        getDisplayText(): string {
          return "Dynamic Test";
        }

        protected getDebounceTime(): number {
          return this.dynamicDebounce;
        }

        protected async performRefresh(): Promise<void> {
          this.refreshCount++;
        }

        public setDebounceTime(time: number): void {
          this.dynamicDebounce = time;
        }

        public testScheduleRefresh(): void {
          this.scheduleRefresh();
        }
      }

      const view = new DynamicDebounceView(mockLeaf);

      // First refresh with 200ms debounce
      view.testScheduleRefresh();
      jest.advanceTimersByTime(200);
      await Promise.resolve();
      expect(view.refreshCount).toBe(1);

      // Change debounce time
      view.setDebounceTime(50);
      view.testScheduleRefresh();
      jest.advanceTimersByTime(50);
      await Promise.resolve();
      expect(view.refreshCount).toBe(2);
    });
  });
});
