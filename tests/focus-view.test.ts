// tests/focus-view.test.ts
import { FocusView, FOCUS_VIEW_TYPE } from "../src/focus-view";
import { FocusItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

describe("FocusView", () => {
  let view: FocusView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockSettings = {
      focus: [],
      focusAutoClearTime: "03:00",
      focusArchiveFile: "Focus Archive.md",
      lastFocusClearTimestamp: 0,
      lastFocusArchiveSucceeded: false,
      focusClearedNotificationDismissed: false,
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

    view = new FocusView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).app = mockApp;
    // Re-initialize scanner with mocked app
    (view as any).scanner = {
      scanProjects: jest.fn().mockResolvedValue([]),
    };
  });

  it("should have correct view type", () => {
    expect(view.getViewType()).toBe(FOCUS_VIEW_TYPE);
  });

  it("should have correct display text", () => {
    expect(view.getDisplayText()).toBe("Focus");
  });

  it("should have correct icon", () => {
    expect(view.getIcon()).toBe("list-checks");
  });

  it("should group items by project and general actions", () => {
    const items: FocusItem[] = [
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

  it("should call saveSettings when removing item from focus", async () => {
    const item: FocusItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockSettings.focus = [item];

    await (view as any).removeFromFocus(item);

    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockSettings.focus).toHaveLength(0);
  });

  it("should refresh sphere views when removing item from focus", async () => {
    const item: FocusItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockSettings.focus = [item];

    // Mock sphere view leaves
    const mockSphereView = {
      onOpen: jest.fn(),
    };
    mockApp.workspace.getLeavesOfType = jest.fn().mockReturnValue([
      {
        view: mockSphereView,
      },
    ]);

    await (view as any).removeFromFocus(item);

    expect(mockApp.workspace.getLeavesOfType).toHaveBeenCalledWith("flow-gtd-sphere-view");
    expect(mockSphereView.onOpen).toHaveBeenCalled();
  });

  describe("Waiting-for items", () => {
    it("should keep waiting-for items during refresh (not remove them like completed items)", async () => {
      // This test verifies that [w] items are NOT removed during refresh
      // Currently the code DOES remove them (line 162 in focus-view.ts checks for [w])
      // We want to change this behavior

      const waitingItem: FocusItem = {
        file: "Test.md",
        lineNumber: 5,
        lineContent: "- [w] Waiting for response from client",
        text: "Waiting for response from client",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const regularItem: FocusItem = {
        file: "Test.md",
        lineNumber: 6,
        lineContent: "- [ ] Regular action",
        text: "Regular action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockSettings.focus = [waitingItem, regularItem];

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

      // Create a recursive mock for DOM elements
      const createMockElement = (): any => ({
        setText: jest.fn(),
        addClass: jest.fn(),
        createDiv: jest.fn(createMockElement),
        createEl: jest.fn(createMockElement),
        createSpan: jest.fn(createMockElement),
        addEventListener: jest.fn(),
        style: {},
        empty: jest.fn(),
      });

      // Mock container element for rendering
      (view as any).containerEl = {
        children: [null, createMockElement()],
      };

      await (view as any).refresh();

      // Both items should remain in the focus (waiting-for items should NOT be removed)
      expect(mockSettings.focus).toHaveLength(2);
      const waitingItemStillThere = mockSettings.focus.find((i: FocusItem) =>
        i.lineContent.includes("[w]")
      );
      expect(waitingItemStillThere).toBeDefined();
    });

    it("should keep item in focus when converting to waiting-for", async () => {
      const regularItem: FocusItem = {
        file: "Test.md",
        lineNumber: 5,
        lineContent: "- [ ] Call client about proposal",
        text: "Call client about proposal",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockSettings.focus = [regularItem];

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

      // Item should still be in focus
      expect(mockSettings.focus).toHaveLength(1);
      expect(mockSettings.focus[0].file).toBe("Test.md");
      expect(mockSettings.focus[0].lineNumber).toBe(5);

      // lineContent should be updated to show [w] status
      expect(mockSettings.focus[0].lineContent).toBe("- [w] Call client about proposal");

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
      mockSettings.lastFocusClearTimestamp = now - 1000; // Cleared 1 second ago
      mockSettings.lastFocusArchiveSucceeded = true;
      mockSettings.focusClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(true);
    });

    it("should not show notification when archiving failed", () => {
      const now = Date.now();
      mockSettings.lastFocusClearTimestamp = now - 1000; // Cleared 1 second ago
      mockSettings.lastFocusArchiveSucceeded = false;
      mockSettings.focusClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when dismissed", () => {
      const now = Date.now();
      mockSettings.lastFocusClearTimestamp = now - 1000;
      mockSettings.focusClearedNotificationDismissed = true;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when never cleared", () => {
      mockSettings.lastFocusClearTimestamp = 0;
      mockSettings.focusClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should not show notification when cleared more than 24 hours ago", () => {
      const dayAndAHalfAgo = Date.now() - 36 * 60 * 60 * 1000;
      mockSettings.lastFocusClearTimestamp = dayAndAHalfAgo;
      mockSettings.focusClearedNotificationDismissed = false;

      const shouldShow = (view as any).shouldShowClearNotification();

      expect(shouldShow).toBe(false);
    });

    it("should dismiss notification and save settings", async () => {
      await (view as any).dismissClearNotification();

      expect(mockSettings.focusClearedNotificationDismissed).toBe(true);
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  describe("FocusView - Pinned Items", () => {
    it("should filter pinned items from unpinned items", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] Pinned action",
            text: "Pinned action",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 2000,
            isPinned: true,
          },
          {
            file: "Projects/Project B.md",
            lineNumber: 15,
            lineContent: "- [ ] Unpinned action",
            text: "Unpinned action",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 1000,
            isPinned: false,
          },
        ],
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };
      await testView.onOpen();

      const container = testView.containerEl.children[1] as HTMLElement;
      const sections = container.querySelectorAll(".flow-gtd-focus-section");

      // Should have 2 sections: Pinned and Project Actions
      expect(sections.length).toBe(2);
      expect(sections[0].querySelector("h3")?.textContent).toBe("Pinned");
      expect(sections[1].querySelector("h3")?.textContent).toBe("Project Actions");
    });

    it("should treat items without isPinned as unpinned (backward compatibility)", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] Legacy action",
            text: "Legacy action",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now(),
            // No isPinned property
          } as FocusItem,
        ],
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };
      await testView.onOpen();

      const container = testView.containerEl.children[1] as HTMLElement;
      const sections = container.querySelectorAll(".flow-gtd-focus-section");

      // Should only have Project Actions section (no pinned)
      expect(sections.length).toBe(1);
      expect(sections[0].querySelector("h3")?.textContent).toBe("Project Actions");
    });

    it("should pin an unpinned item and move to end of pinned section", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] Already pinned",
            text: "Already pinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 3000,
            isPinned: true,
          },
          {
            file: "Projects/Project B.md",
            lineNumber: 15,
            lineContent: "- [ ] To be pinned",
            text: "To be pinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 2000,
            isPinned: false,
          },
          {
            file: "Projects/Project C.md",
            lineNumber: 20,
            lineContent: "- [ ] Another unpinned",
            text: "Another unpinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 1000,
            isPinned: false,
          },
        ],
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };

      // Pin the second item
      await (testView as any).pinItem(settings.focus[1]);

      // Check isPinned flag is set
      expect(settings.focus[1].isPinned).toBe(true);

      // Check it moved to end of pinned section (index 1, after existing pinned item)
      const pinnedItems = settings.focus.filter((i) => i.isPinned);
      expect(pinnedItems.length).toBe(2);
      expect(pinnedItems[1].text).toBe("To be pinned");

      // Check saveSettings was called
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it("should unpin a pinned item", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] Pinned action",
            text: "Pinned action",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now(),
            isPinned: true,
          },
        ],
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };

      // Unpin the item
      await (testView as any).unpinItem(settings.focus[0]);

      // Check isPinned flag is cleared
      expect(settings.focus[0].isPinned).toBe(false);

      // Check saveSettings was called
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it("should reorder pinned items on drop", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] First pinned",
            text: "First pinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 3000,
            isPinned: true,
          },
          {
            file: "Projects/Project B.md",
            lineNumber: 15,
            lineContent: "- [ ] Second pinned",
            text: "Second pinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 2000,
            isPinned: true,
          },
          {
            file: "Projects/Project C.md",
            lineNumber: 20,
            lineContent: "- [ ] Third pinned",
            text: "Third pinned",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now() - 1000,
            isPinned: true,
          },
        ],
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };

      // Simulate dragging third item to first position
      const draggedItem = settings.focus[2];
      const dropTarget = settings.focus[0];

      // Set up drag state
      (testView as any).draggedItem = draggedItem;

      // Simulate drop event
      const mockDropEvent = {
        preventDefault: jest.fn(),
      } as unknown as DragEvent;

      await (testView as any).onDrop(mockDropEvent, dropTarget);

      // Check order changed: "Third" should now be at index 0
      expect(settings.focus[0].text).toBe("Third pinned");
      expect(settings.focus[1].text).toBe("First pinned");
      expect(settings.focus[2].text).toBe("Second pinned");

      // Check all are still pinned
      expect(settings.focus[0].isPinned).toBe(true);
      expect(settings.focus[1].isPinned).toBe(true);
      expect(settings.focus[2].isPinned).toBe(true);

      // Check saveSettings was called
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it("should preserve isPinned state when validating and updating line numbers", async () => {
      const settings = {
        ...mockSettings,
        focus: [
          {
            file: "Projects/Project A.md",
            lineNumber: 10,
            lineContent: "- [ ] Pinned action",
            text: "Pinned action",
            sphere: "work",
            isGeneral: false,
            addedAt: Date.now(),
            isPinned: true,
          },
        ],
      };

      // Mock validator to return updated line number
      const mockValidator = {
        validateItem: jest.fn().mockResolvedValue({
          found: true,
          updatedLineNumber: 15, // Line moved
        }),
      };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).validator = mockValidator;

      // Mock file read
      mockApp.vault.read = jest.fn().mockResolvedValue("- [ ] Pinned action");

      await (testView as any).refresh();

      // Check isPinned state is preserved
      expect(settings.focus[0].isPinned).toBe(true);
      expect(settings.focus[0].lineNumber).toBe(15);
    });
  });

  describe("File navigation", () => {
    it("should reuse the same leaf when clicking multiple actions", async () => {
      // Create mock files
      const { TFile } = require("obsidian");
      const mockFile1 = new TFile();
      mockFile1.path = "Projects/Project A.md";
      const mockFile2 = new TFile();
      mockFile2.path = "Projects/Project B.md";

      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(mockFile1)
        .mockReturnValueOnce(mockFile2);

      // Create a mock leaf that will be returned by getLeaf
      const mockOpenedLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        view: {
          editor: {
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
          },
        },
      };

      // Mock getLeaf to return the same leaf each time
      mockApp.workspace.getLeaf.mockReturnValue(mockOpenedLeaf);

      // Open first file
      await (view as any).openFile("Projects/Project A.md", 5);

      // Verify getLeaf was called to create the initial split
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith("split", "vertical");
      expect(mockOpenedLeaf.openFile).toHaveBeenCalledWith(mockFile1);

      // Reset call counts
      mockApp.workspace.getLeaf.mockClear();
      mockOpenedLeaf.openFile.mockClear();

      // Open second file - should reuse the same leaf
      await (view as any).openFile("Projects/Project B.md", 10);

      // Verify getLeaf was NOT called again (leaf was reused)
      expect(mockApp.workspace.getLeaf).not.toHaveBeenCalled();
      expect(mockOpenedLeaf.openFile).toHaveBeenCalledWith(mockFile2);
    });
  });
});
