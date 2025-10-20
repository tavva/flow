// tests/hotlist-view.test.ts
import { HotlistView, HOTLIST_VIEW_TYPE } from "../src/hotlist-view";
import { HotlistItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

describe("HotlistView", () => {
  let view: HotlistView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockSettings = {
      hotlist: [],
      hotlistAutoClearTime: "03:00",
      hotlistArchiveFile: "Hotlist Archive.md",
      lastHotlistClearTimestamp: 0,
      lastHotlistArchiveSucceeded: false,
      hotlistClearedNotificationDismissed: false,
    };
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
        getMarkdownFiles: jest.fn().mockReturnValue([]),
      },
      workspace: {
        getLeaf: jest.fn(),
        getLeavesOfType: jest.fn().mockReturnValue([]),
      },
      metadataCache: {
        on: jest.fn(),
        offref: jest.fn(),
        getFileCache: jest.fn(),
      },
    };
    mockLeaf = {
      view: null,
      getRoot: jest.fn().mockReturnValue({
        app: mockApp,
      }),
    } as any;
    mockSaveSettings = jest.fn();

    view = new HotlistView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).app = mockApp;
    // Re-initialize scanner with mocked app
    (view as any).scanner = {
      scanProjects: jest.fn().mockResolvedValue([]),
    };
  });

  it("should have correct view type", () => {
    expect(view.getViewType()).toBe(HOTLIST_VIEW_TYPE);
  });

  it("should have correct display text", () => {
    expect(view.getDisplayText()).toBe("Hotlist");
  });

  it("should have correct icon", () => {
    expect(view.getIcon()).toBe("list-checks");
  });

  it("should group items by project and general actions", () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Project A.md",
        lineNumber: 5,
        lineContent: "- [ ] Project action A",
        text: "Project action A",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Projects/Project A.md",
        lineNumber: 7,
        lineContent: "- [ ] Project action B",
        text: "Project action B",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 3,
        lineContent: "- [ ] General action #sphere/work",
        text: "General action",
        sphere: "work",
        isGeneral: true,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [ ] Personal action #sphere/personal",
        text: "Personal action",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
    ];

    const grouped = (view as any).groupItems(items);

    expect(Object.keys(grouped.projectActions)).toHaveLength(1);
    expect(grouped.projectActions["Projects/Project A.md"]).toHaveLength(2);
    expect(Object.keys(grouped.generalActions)).toHaveLength(2);
    expect(grouped.generalActions["work"]).toHaveLength(1);
    expect(grouped.generalActions["personal"]).toHaveLength(1);
  });

  it("should call saveSettings when removing item from hotlist", async () => {
    const item: HotlistItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockSettings.hotlist = [item];

    await (view as any).removeFromHotlist(item);

    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockSettings.hotlist).toHaveLength(0);
  });

  it("should refresh sphere views when removing item from hotlist", async () => {
    const item: HotlistItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockSettings.hotlist = [item];

    // Mock sphere view leaves
    const mockSphereView = {
      onOpen: jest.fn(),
    };
    mockApp.workspace.getLeavesOfType = jest.fn().mockReturnValue([
      {
        view: mockSphereView,
      },
    ]);

    await (view as any).removeFromHotlist(item);

    expect(mockApp.workspace.getLeavesOfType).toHaveBeenCalledWith("flow-gtd-sphere-view");
    expect(mockSphereView.onOpen).toHaveBeenCalled();
  });

  describe("Clear notification", () => {
    it("should show notification when items were recently cleared and archiving succeeded", () => {
      const now = Date.now();
      mockSettings.lastHotlistClearTimestamp = now - 1000; // Cleared 1 second ago
      mockSettings.lastHotlistArchiveSucceeded = true;
      mockSettings.hotlistClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(true);
    });

    it("should not show notification when archiving failed", () => {
      const now = Date.now();
      mockSettings.lastHotlistClearTimestamp = now - 1000; // Cleared 1 second ago
      mockSettings.lastHotlistArchiveSucceeded = false;
      mockSettings.hotlistClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when dismissed", () => {
      const now = Date.now();
      mockSettings.lastHotlistClearTimestamp = now - 1000;
      mockSettings.hotlistClearedNotificationDismissed = true;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when never cleared", () => {
      mockSettings.lastHotlistClearTimestamp = 0;
      mockSettings.hotlistClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when cleared more than 24 hours ago", () => {
      const dayAndAHalfAgo = Date.now() - 36 * 60 * 60 * 1000;
      mockSettings.lastHotlistClearTimestamp = dayAndAHalfAgo;
      mockSettings.hotlistClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should dismiss notification and save settings", async () => {
      await (view as any).dismissClearNotification();

      expect(mockSettings.hotlistClearedNotificationDismissed).toBe(true);
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });
});
