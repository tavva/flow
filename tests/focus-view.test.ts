// tests/focus-view.test.ts
import { FocusView, FOCUS_VIEW_TYPE } from "../src/focus-view";
import { FocusItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

// Mock focus persistence
let mockFocusItems: FocusItem[] = [];
jest.mock("../src/focus-persistence", () => ({
  loadFocusItems: jest.fn(() => Promise.resolve(mockFocusItems)),
  saveFocusItems: jest.fn((vault, items) => {
    mockFocusItems = items;
    return Promise.resolve();
  }),
}));

import { saveFocusItems as mockSaveFocusItems } from "../src/focus-persistence";

describe("FocusView", () => {
  let view: FocusView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    // Reset mock focus items
    mockFocusItems = [];
    (mockSaveFocusItems as jest.Mock).mockClear();

    mockSettings = {
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

  it("should save focus when removing item from focus", async () => {
    const item: FocusItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockFocusItems = [item];
    (view as any).focusItems = [...mockFocusItems];

    await (view as any).removeFromFocus(item);

    expect(mockSaveFocusItems).toHaveBeenCalled();
    expect(mockFocusItems).toHaveLength(0);
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
    mockFocusItems = [item];

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

      mockFocusItems = [waitingItem, regularItem];

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
      expect(mockFocusItems).toHaveLength(2);
      const waitingItemStillThere = mockFocusItems.find((i: FocusItem) =>
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

      mockFocusItems = [regularItem];
      // Initialize the view's internal focusItems array
      (view as any).focusItems = [...mockFocusItems];

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

      await (view as any).convertToWaitingFor((view as any).focusItems[0]);

      // Item should still be in focus
      expect(mockFocusItems).toHaveLength(1);
      expect(mockFocusItems[0].file).toBe("Test.md");
      expect(mockFocusItems[0].lineNumber).toBe(5);

      // lineContent should be updated to show [w] status
      expect(mockFocusItems[0].lineContent).toBe("- [w] Call client about proposal");

      // File should have been modified with [w] checkbox
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining("- [w] Call client about proposal")
      );

      // Focus should be saved
      expect(mockSaveFocusItems).toHaveBeenCalled();

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
    it("should show project name above pinned project actions", () => {
      const mockItem: FocusItem = {
        file: "Projects/Important Project.md",
        lineNumber: 10,
        lineContent: "- [ ] Critical task",
        text: "Critical task",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
        isPinned: true,
      };

      // Mock allProjects to include our project
      const mockProjects = [
        {
          file: "Projects/Important Project.md",
          title: "Important Project",
          priority: 1,
          status: "live",
          sphere: "work",
          actions: [],
        },
      ];
      (view as any).allProjects = mockProjects;

      const container = document.createElement("ul");

      // Track all created spans to verify project name was created
      const allSpans: any[] = [];

      // Create comprehensive mocks for DOM elements
      const mockLi = document.createElement("li");
      (mockLi as any).createSpan = jest.fn().mockImplementation((opts?: any) => {
        const span: any = {
          className: opts?.cls || "",
          textContent: opts?.text || "",
          style: {},
          setAttribute: jest.fn(),
          setText: jest.fn(function (this: any, text: string) {
            this.textContent = text;
          }),
          addEventListener: jest.fn(),
          createEl: jest.fn().mockReturnValue({
            addEventListener: jest.fn(),
          }),
          createSpan: jest.fn().mockReturnValue({
            createEl: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
            }),
          }),
        };
        allSpans.push(span);
        return span;
      });

      (mockLi as any).addEventListener = jest.fn();
      (container as any).createEl = jest.fn().mockReturnValue(mockLi);

      (view as any).renderPinnedItem(container, mockItem);

      // Find the project name span by class
      const projectNameSpan = allSpans.find((span) =>
        span.className.includes("flow-gtd-focus-project-name")
      );

      // Check that project name span exists
      expect(projectNameSpan).toBeDefined();

      // Check that project name contains the project title
      expect(projectNameSpan.textContent).toBe("Important Project");

      // Check that project name has correct styling (smaller font, dimmed, takes full width)
      expect(projectNameSpan.style.fontSize).toBe("0.85em");
      expect(projectNameSpan.style.opacity).toBe("0.7");
      expect(projectNameSpan.style.flexBasis).toBe("100%");
      expect(projectNameSpan.style.marginBottom).toBe("4px");
    });

    it("should not show project name for pinned general actions", () => {
      const mockItem: FocusItem = {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [ ] General task #sphere/work",
        text: "General task",
        sphere: "work",
        isGeneral: true,
        addedAt: Date.now(),
        isPinned: true,
      };

      const container = document.createElement("ul");

      // Track all created spans to verify no project name was created
      const allSpans: any[] = [];

      // Create mocks for DOM elements
      const mockLi = document.createElement("li");
      (mockLi as any).createSpan = jest.fn().mockImplementation((opts?: any) => {
        const span: any = {
          className: opts?.cls || "",
          textContent: opts?.text || "",
          style: {},
          setAttribute: jest.fn(),
          setText: jest.fn(function (this: any, text: string) {
            this.textContent = text;
          }),
          addEventListener: jest.fn(),
          createEl: jest.fn().mockReturnValue({
            addEventListener: jest.fn(),
          }),
          createSpan: jest.fn().mockReturnValue({
            createEl: jest.fn().mockReturnValue({
              addEventListener: jest.fn(),
            }),
          }),
        };
        allSpans.push(span);
        return span;
      });

      (mockLi as any).addEventListener = jest.fn();
      (container as any).createEl = jest.fn().mockReturnValue(mockLi);

      (view as any).renderPinnedItem(container, mockItem);

      // Check that no project name span was created for general actions
      const projectNameSpan = allSpans.find((span) =>
        span.className.includes("flow-gtd-focus-project-name")
      );
      expect(projectNameSpan).toBeUndefined();
    });

    it("should filter pinned items from unpinned items", async () => {
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };

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
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };

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
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };
      // Initialize the view's internal focusItems array
      (testView as any).focusItems = [...mockFocusItems];

      // Pin the second item
      await (testView as any).pinItem((testView as any).focusItems[1]);

      // Check isPinned flag is set
      expect(mockFocusItems[1].isPinned).toBe(true);

      // Check it moved to end of pinned section (index 1, after existing pinned item)
      const pinnedItems = mockFocusItems.filter((i) => i.isPinned);
      expect(pinnedItems.length).toBe(2);
      expect(pinnedItems[1].text).toBe("To be pinned");

      // Check saveFocusItems was called
      expect(mockSaveFocusItems).toHaveBeenCalled();
    });

    it("should unpin a pinned item", async () => {
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };
      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };
      // Initialize the view's internal focusItems array
      (testView as any).focusItems = [...mockFocusItems];

      // Unpin the item
      await (testView as any).unpinItem((testView as any).focusItems[0]);

      // Check isPinned flag is cleared
      expect(mockFocusItems[0].isPinned).toBe(false);

      // Check saveFocusItems was called
      expect(mockSaveFocusItems).toHaveBeenCalled();
    });

    it("should reorder pinned items on drop", async () => {
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };

      const testView = new FocusView(mockLeaf, settings, mockSaveSettings);
      (testView as any).app = mockApp;
      (testView as any).scanner = {
        scanProjects: jest.fn().mockResolvedValue([]),
      };
      // Initialize the view's internal focusItems array
      (testView as any).focusItems = [...mockFocusItems];

      // Simulate dragging third item to first position
      const draggedItem = (testView as any).focusItems[2];
      const dropTarget = (testView as any).focusItems[0];

      // Set up drag state
      (testView as any).draggedItem = draggedItem;

      // Simulate drop event
      const mockDropEvent = {
        preventDefault: jest.fn(),
      } as unknown as DragEvent;

      await (testView as any).onDrop(mockDropEvent, dropTarget);

      // Check order changed: "Third" should now be at index 0
      expect(mockFocusItems[0].text).toBe("Third pinned");
      expect(mockFocusItems[1].text).toBe("First pinned");
      expect(mockFocusItems[2].text).toBe("Second pinned");

      // Check all are still pinned
      expect(mockFocusItems[0].isPinned).toBe(true);
      expect(mockFocusItems[1].isPinned).toBe(true);
      expect(mockFocusItems[2].isPinned).toBe(true);

      // Check saveFocusItems was called
      expect(mockSaveFocusItems).toHaveBeenCalled();
    });

    it("should preserve isPinned state when validating and updating line numbers", async () => {
      mockFocusItems = [
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
      ];

      const settings = { ...mockSettings };

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
      // Initialize the view's internal focusItems array
      (testView as any).focusItems = [...mockFocusItems];

      // Mock file read
      mockApp.vault.read = jest.fn().mockResolvedValue("- [ ] Pinned action");

      await (testView as any).refresh();

      // Check isPinned state is preserved
      expect(mockFocusItems[0].isPinned).toBe(true);
      expect(mockFocusItems[0].lineNumber).toBe(15);
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

      // Create a mock root split for the workspace
      const mockRootSplit = { type: "split" };
      mockApp.workspace.rootSplit = mockRootSplit;

      // Create a mock leaf that will be returned by getLeaf
      const mockOpenedLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        getRoot: jest.fn().mockReturnValue(mockRootSplit), // Same root = attached
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

    it("should create new leaf when cached leaf is detached from workspace", async () => {
      // Create mock files
      const { TFile } = require("obsidian");
      const mockFile1 = new TFile();
      mockFile1.path = "Projects/Project A.md";
      const mockFile2 = new TFile();
      mockFile2.path = "Projects/Project B.md";

      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(mockFile1)
        .mockReturnValueOnce(mockFile2);

      // Create a mock root split for the workspace
      const mockRootSplit = { type: "split" };
      mockApp.workspace.rootSplit = mockRootSplit;

      // Create first mock leaf (will become detached)
      const mockDetachedLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        getRoot: jest.fn().mockReturnValue({ type: "split" }), // Different root = detached
        view: {
          editor: {
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
          },
        },
      };

      // Create second mock leaf (fresh, attached)
      const mockFreshLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        getRoot: jest.fn().mockReturnValue(mockRootSplit), // Same root = attached
        view: {
          editor: {
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
          },
        },
      };

      // First call returns detached leaf, second call returns fresh leaf
      mockApp.workspace.getLeaf
        .mockReturnValueOnce(mockDetachedLeaf)
        .mockReturnValueOnce(mockFreshLeaf);

      // Open first file
      await (view as any).openFile("Projects/Project A.md", 5);

      // Verify first leaf was used
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(mockDetachedLeaf.openFile).toHaveBeenCalledWith(mockFile1);

      // Reset call counts
      mockApp.workspace.getLeaf.mockClear();
      mockDetachedLeaf.openFile.mockClear();

      // Open second file - should detect detached leaf and create new one
      await (view as any).openFile("Projects/Project B.md", 10);

      // Verify getLeaf was called again to create fresh leaf (because cached one was detached)
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith("split", "vertical");
      expect(mockFreshLeaf.openFile).toHaveBeenCalledWith(mockFile2);
    });

    it("should create new leaf when getRoot() throws an exception", async () => {
      // Create mock files
      const { TFile } = require("obsidian");
      const mockFile1 = new TFile();
      mockFile1.path = "Projects/Project A.md";
      const mockFile2 = new TFile();
      mockFile2.path = "Projects/Project B.md";

      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(mockFile1)
        .mockReturnValueOnce(mockFile2);

      // Create a mock root split for the workspace
      const mockRootSplit = { type: "split" };
      mockApp.workspace.rootSplit = mockRootSplit;

      // Create first mock leaf with getRoot() that throws
      const mockBrokenLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        getRoot: jest.fn().mockImplementation(() => {
          throw new Error("Leaf is in invalid state");
        }),
        view: {
          editor: {
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
          },
        },
      };

      // Create second mock leaf (fresh, attached)
      const mockFreshLeaf = {
        openFile: jest.fn().mockResolvedValue(undefined),
        getRoot: jest.fn().mockReturnValue(mockRootSplit),
        view: {
          editor: {
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
          },
        },
      };

      // First call returns broken leaf, second call returns fresh leaf
      mockApp.workspace.getLeaf.mockReturnValueOnce(mockBrokenLeaf).mockReturnValueOnce(mockFreshLeaf);

      // Open first file
      await (view as any).openFile("Projects/Project A.md", 5);

      // Verify first leaf was used
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(mockBrokenLeaf.openFile).toHaveBeenCalledWith(mockFile1);

      // Reset call counts
      mockApp.workspace.getLeaf.mockClear();
      mockBrokenLeaf.openFile.mockClear();

      // Open second file - should catch the exception from getRoot() and create new leaf
      await (view as any).openFile("Projects/Project B.md", 10);

      // Verify getLeaf was called again to create fresh leaf (because getRoot() threw)
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledTimes(1);
      expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith("split", "vertical");
      expect(mockFreshLeaf.openFile).toHaveBeenCalledWith(mockFile2);
    });
  });

  describe("markItemComplete", () => {
    it("should add completion date when marking item complete", async () => {
      const mockFile = {
        path: "Projects/Test.md",
      };
      const TFile = require("obsidian").TFile;
      const mockTFile = Object.create(TFile.prototype);
      mockTFile.path = mockFile.path;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockTFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test action");

      const item: FocusItem = {
        file: mockFile.path,
        lineNumber: 1,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      // Mock validator
      (view as any).validator = {
        validateItem: jest.fn().mockResolvedValue({ found: true }),
      };

      await (view as any).markItemComplete(item);

      expect(mockApp.vault.modify).toHaveBeenCalled();
      const modifiedContent = mockApp.vault.modify.mock.calls[0][1];

      // Verify completion date format YYYY-MM-DD
      expect(modifiedContent).toMatch(/^- \[x\] Test action ✅ \d{4}-\d{2}-\d{2}$/);

      // Verify it's today's date
      const today = new Date().toISOString().split("T")[0];
      expect(modifiedContent).toContain(`✅ ${today}`);
    });

    it("should add completion date when marking waiting-for item complete", async () => {
      const mockFile = {
        path: "Projects/Test.md",
      };
      const TFile = require("obsidian").TFile;
      const mockTFile = Object.create(TFile.prototype);
      mockTFile.path = mockFile.path;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockTFile);
      mockApp.vault.read.mockResolvedValue("- [w] Waiting action");

      const item: FocusItem = {
        file: mockFile.path,
        lineNumber: 1,
        lineContent: "- [w] Waiting action",
        text: "Waiting action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      // Mock validator
      (view as any).validator = {
        validateItem: jest.fn().mockResolvedValue({ found: true }),
      };

      await (view as any).markItemComplete(item);

      expect(mockApp.vault.modify).toHaveBeenCalled();
      const modifiedContent = mockApp.vault.modify.mock.calls[0][1];

      // Verify completion date format YYYY-MM-DD
      expect(modifiedContent).toMatch(/^- \[x\] Waiting action ✅ \d{4}-\d{2}-\d{2}$/);

      // Verify it's today's date
      const today = new Date().toISOString().split("T")[0];
      expect(modifiedContent).toContain(`✅ ${today}`);
    });

    it("should set completedAt timestamp instead of removing from focus", async () => {
      const mockItem: FocusItem = {
        file: "test.md",
        lineNumber: 5,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = {
        path: "test.md",
      };
      const TFile = require("obsidian").TFile;
      const mockTFile = Object.create(TFile.prototype);
      mockTFile.path = mockFile.path;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockTFile);
      mockApp.vault.read.mockResolvedValue("line1\nline2\nline3\nline4\n- [ ] Test action\nline6");

      (view as any).focusItems = [mockItem];

      // Mock validator
      (view as any).validator = {
        validateItem: jest.fn().mockResolvedValue({ found: true }),
      };

      await (view as any).markItemComplete(mockItem);

      const items = (view as any).focusItems;
      expect(items.length).toBe(1);
      expect(items[0].completedAt).toBeDefined();
      expect(items[0].completedAt).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe("getMidnightTimestamp", () => {
    it("should return today's midnight timestamp", () => {
      const midnight = (view as any).getMidnightTimestamp();

      const expected = new Date();
      expected.setHours(0, 0, 0, 0);

      expect(midnight).toBe(expected.getTime());
    });
  });

  describe("getCompletedTodayItems", () => {
    const createMockFocusItem = (): FocusItem => ({
      file: "test.md",
      lineNumber: 1,
      lineContent: "- [ ] test",
      text: "test",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    });

    it("should return items completed since midnight", () => {
      const now = Date.now();
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const midnightTimestamp = midnight.getTime();

      const items: FocusItem[] = [
        { ...createMockFocusItem(), completedAt: now }, // Today
        { ...createMockFocusItem(), completedAt: midnightTimestamp + 1000 }, // Today
        { ...createMockFocusItem(), completedAt: midnightTimestamp - 1000 }, // Yesterday
        { ...createMockFocusItem() }, // Not completed
      ];

      (view as any).focusItems = items;

      const completed = (view as any).getCompletedTodayItems();

      expect(completed.length).toBe(2);
      expect(completed[0].completedAt).toBeGreaterThanOrEqual(midnightTimestamp);
      expect(completed[1].completedAt).toBeGreaterThanOrEqual(midnightTimestamp);
    });
  });

  describe("refresh with old completed items", () => {
    it("should remove items completed before midnight", async () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const midnightTimestamp = midnight.getTime();

      const items: FocusItem[] = [
        {
          file: "active.md",
          lineNumber: 1,
          lineContent: "- [ ] active",
          text: "active",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
        },
        {
          file: "today.md",
          lineNumber: 1,
          lineContent: "- [x] today ✅ 2025-11-04",
          text: "today",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
          completedAt: midnightTimestamp + 1000,
        },
        {
          file: "yesterday.md",
          lineNumber: 1,
          lineContent: "- [x] yesterday ✅ 2025-11-03",
          text: "yesterday",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
          completedAt: midnightTimestamp - 1000,
        },
      ];

      mockApp.vault.read.mockResolvedValue("- [ ] active");

      // Set up mock focus items in the mocked storage
      mockFocusItems = items;

      // Mock validator to return found for active item
      (view as any).validator = {
        validateItem: jest.fn().mockResolvedValue({ found: true }),
      };

      await (view as any).refresh();

      const remaining = (view as any).focusItems;
      expect(remaining.length).toBe(2);
      expect(remaining.find((i: FocusItem) => i.file === "yesterday.md")).toBeUndefined();
    });
  });

  describe("onOpen with old completed items", () => {
    it("should remove items completed before midnight on view open", async () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const midnightTimestamp = midnight.getTime();

      const items: FocusItem[] = [
        {
          file: "active.md",
          lineNumber: 1,
          lineContent: "- [ ] active",
          text: "active",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
        },
        {
          file: "today.md",
          lineNumber: 1,
          lineContent: "- [x] today ✅ 2025-11-04",
          text: "today",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
          completedAt: midnightTimestamp + 1000,
        },
        {
          file: "yesterday.md",
          lineNumber: 1,
          lineContent: "- [x] yesterday ✅ 2025-11-03",
          text: "yesterday",
          sphere: "work",
          isGeneral: false,
          addedAt: Date.now(),
          completedAt: midnightTimestamp - 1000,
        },
      ];

      // Set up mock focus items in the mocked storage
      mockFocusItems = items;

      await view.onOpen();

      const remaining = (view as any).focusItems;
      expect(remaining.length).toBe(2);
      expect(remaining.find((i: FocusItem) => i.file === "yesterday.md")).toBeUndefined();
    });
  });

  // Helper function for creating mock focus items
  const createMockFocusItem = (): FocusItem => ({
    file: "test.md",
    lineNumber: 1,
    lineContent: "- [ ] test",
    text: "test",
    sphere: "work",
    isGeneral: false,
    addedAt: Date.now(),
  });

  describe("renderCompletedItem", () => {
    it("should render completed item with strikethrough and no actions", () => {
      const mockItem: FocusItem = {
        file: "test.md",
        lineNumber: 5,
        lineContent: "- [x] Test action ✅ 2025-11-04",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
        completedAt: Date.now(),
      };

      const container = document.createElement("ul");

      // Mock createEl and createSpan methods
      const mockLi = document.createElement("li");
      mockLi.className = "flow-gtd-focus-item flow-gtd-focus-completed";
      (container as any).createEl = jest.fn().mockImplementation((tag: string, opts?: any) => {
        if (opts?.cls) mockLi.className = opts.cls;
        container.appendChild(mockLi);
        return mockLi;
      });

      const mockIndicatorSpan = document.createElement("span");
      mockIndicatorSpan.className = "flow-gtd-focus-completed-indicator";
      mockIndicatorSpan.textContent = "✅ ";

      const mockTextSpan = document.createElement("span");
      mockTextSpan.className = "flow-gtd-focus-item-text";
      (mockTextSpan as any).setText = jest.fn((text: string) => {
        mockTextSpan.textContent = text;
      });

      let spanCallCount = 0;
      (mockLi as any).createSpan = jest.fn().mockImplementation((opts?: any) => {
        spanCallCount++;
        if (spanCallCount === 1) {
          // First call: indicator span
          if (opts?.text) mockIndicatorSpan.textContent = opts.text;
          mockLi.appendChild(mockIndicatorSpan);
          return mockIndicatorSpan;
        } else {
          // Second call: text span
          mockLi.appendChild(mockTextSpan);
          return mockTextSpan;
        }
      });

      (view as any).renderCompletedItem(container, mockItem);

      const itemEl = container.querySelector(".flow-gtd-focus-completed");
      expect(itemEl).toBeTruthy();

      const textEl = itemEl?.querySelector(".flow-gtd-focus-item-text") as HTMLElement;
      expect(textEl?.style.textDecoration).toBe("line-through");
      expect(textEl?.style.opacity).toBe("0.6");

      // Should have checkmark indicator
      const indicator = itemEl?.querySelector(".flow-gtd-focus-completed-indicator");
      expect(indicator?.textContent).toBe("✅ ");

      // Should NOT have action buttons
      const actions = itemEl?.querySelector(".flow-gtd-focus-item-actions");
      expect(actions).toBeFalsy();
    });
  });

  describe("renderCompletedTodaySection", () => {
    it("should call getCompletedTodayItems", () => {
      (view as any).focusItems = [];

      // Spy on getCompletedTodayItems
      const spy = jest.spyOn(view as any, "getCompletedTodayItems");

      const container = document.createElement("div");

      (view as any).renderCompletedTodaySection(container);

      expect(spy).toHaveBeenCalled();
    });

    it("should not render when no completed items", () => {
      (view as any).focusItems = [];

      const container = document.createElement("div");
      const createDivSpy = jest.fn();
      (container as any).createDiv = createDivSpy;

      (view as any).renderCompletedTodaySection(container);

      // Should not create any divs if no completed items
      expect(createDivSpy).not.toHaveBeenCalled();
    });
  });
});
