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

  describe("Waiting-for items", () => {
    it("should keep waiting-for items during refresh (not remove them like completed items)", async () => {
      // This test verifies that [w] items are NOT removed during refresh
      // Currently the code DOES remove them (line 162 in hotlist-view.ts checks for [w])
      // We want to change this behavior

      const waitingItem: HotlistItem = {
        file: "Test.md",
        lineNumber: 5,
        lineContent: "- [w] Waiting for response from client",
        text: "Waiting for response from client",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const regularItem: HotlistItem = {
        file: "Test.md",
        lineNumber: 6,
        lineContent: "- [ ] Regular action",
        text: "Regular action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockSettings.hotlist = [waitingItem, regularItem];

      // Create a proper TFile mock
      const { TFile } = require("obsidian");
      const mockFile = new TFile();
      mockFile.path = "Test.md";

      const fileContent = [
        "# Test Project",
        "",
        "## Next actions",
        "",
        "- [w] Waiting for response from client",
        "- [ ] Regular action",
      ].join("\n");

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(fileContent);

      // Mock validator to return found for both items
      (view as any).validator = {
        validateItem: jest
          .fn()
          .mockResolvedValueOnce({ found: true, updatedLineNumber: 5 })
          .mockResolvedValueOnce({ found: true, updatedLineNumber: 6 }),
      };

      // Mock container element for rendering
      (view as any).containerEl = {
        children: [
          null,
          {
            empty: jest.fn(),
            addClass: jest.fn(),
            createDiv: jest.fn().mockReturnValue({
              setText: jest.fn(),
              createEl: jest.fn(),
            }),
            createEl: jest.fn().mockReturnValue({
              setText: jest.fn(),
            }),
          },
        ],
      };

      await (view as any).refresh();

      // Both items should remain in the hotlist (waiting-for items should NOT be removed)
      expect(mockSettings.hotlist).toHaveLength(2);
      const waitingItemStillThere = mockSettings.hotlist.find((i: HotlistItem) =>
        i.lineContent.includes("[w]")
      );
      expect(waitingItemStillThere).toBeDefined();
    });

    it("should keep item in hotlist when converting to waiting-for", async () => {
      const regularItem: HotlistItem = {
        file: "Test.md",
        lineNumber: 5,
        lineContent: "- [ ] Call client about proposal",
        text: "Call client about proposal",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockSettings.hotlist = [regularItem];

      // Create a proper TFile mock
      const { TFile } = require("obsidian");
      const mockFile = new TFile();
      mockFile.path = "Test.md";

      const fileContent = [
        "# Test Project",
        "",
        "## Next actions",
        "",
        "- [ ] Call client about proposal",
      ].join("\n");

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(fileContent);

      // Mock validator to return found
      (view as any).validator = {
        validateItem: jest.fn().mockResolvedValue({ found: true, updatedLineNumber: 5 }),
      };

      // Mock the methods that would be called after conversion (onOpen, refreshSphereViews)
      // to avoid rendering issues in tests
      const originalOnOpen = (view as any).onOpen;
      const originalRefreshSphereViews = (view as any).refreshSphereViews;
      (view as any).onOpen = jest.fn();
      (view as any).refreshSphereViews = jest.fn();

      await (view as any).convertToWaitingFor(regularItem);

      // Item should still be in hotlist
      expect(mockSettings.hotlist).toHaveLength(1);
      expect(mockSettings.hotlist[0].file).toBe("Test.md");
      expect(mockSettings.hotlist[0].lineNumber).toBe(5);

      // lineContent should be updated to show [w] status
      expect(mockSettings.hotlist[0].lineContent).toBe("- [w] Call client about proposal");

      // File should have been modified with [w] checkbox
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining("- [w] Call client about proposal")
      );

      // Settings should be saved
      expect(mockSaveSettings).toHaveBeenCalled();

      // Restore original methods
      (view as any).onOpen = originalOnOpen;
      (view as any).refreshSphereViews = originalRefreshSphereViews;
    });

    it("should extract checkbox status from line content", () => {
      const extractCheckboxStatus = (view as any).extractCheckboxStatus;

      expect(extractCheckboxStatus("- [ ] Regular action")).toBe(" ");
      expect(extractCheckboxStatus("- [w] Waiting action")).toBe("w");
      expect(extractCheckboxStatus("- [x] Completed action")).toBe("x");
      expect(extractCheckboxStatus("* [X] Completed with asterisk")).toBe("X");
    });
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
