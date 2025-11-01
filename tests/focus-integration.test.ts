// ABOUTME: Integration tests for the focus feature, testing interactions between components.
// ABOUTME: Validates the full workflow from finding actions to validating them in files.

import { FocusView } from "../src/focus-view";
import { SphereView } from "../src/sphere-view";
import { FocusValidator } from "../src/focus-validator";
import { ActionLineFinder } from "../src/action-line-finder";
import { PluginSettings, FocusItem, DEFAULT_SETTINGS } from "../src/types";
import { TFile } from "obsidian";

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

describe("Focus Integration", () => {
  let mockApp: any;
  let mockVault: any;
  let mockSettings: PluginSettings;

  beforeEach(() => {
    // Reset mock focus items
    mockFocusItems = [];
    (mockSaveFocusItems as jest.Mock).mockClear();

    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      modify: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
      workspace: {
        getLeaf: jest.fn(),
      },
    };
    mockSettings = { ...DEFAULT_SETTINGS };
  });

  it("should add action to focus and validate it", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );

    // Find the line
    const finder = new ActionLineFinder(mockApp);
    const lineResult = await finder.findActionLine("Projects/Test.md", "Test action");

    expect(lineResult.found).toBe(true);
    expect(lineResult.lineNumber).toBe(9);
    expect(lineResult.lineContent).toBe("- [ ] Test action");

    // Add to focus
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: lineResult.lineNumber!,
      lineContent: lineResult.lineContent!,
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };
    mockFocusItems.push(item);

    // Validate the item
    const validator = new FocusValidator(mockApp);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBeUndefined();
    expect(mockFocusItems).toHaveLength(1);
  });

  it("should handle line number changes after file edits", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // New content with action moved to line 13 (added 4 lines)
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Description\n\nNew section\n\n## Next actions\n\n- [ ] Test action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(13);
  });

  it("should find general actions with sphere tags", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Next Actions\n\n- [ ] General action #sphere/work\n- [ ] Another action #sphere/personal\n"
    );

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Next actions.md", "General action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [ ] General action #sphere/work");
  });

  it("should handle multiple identical actions by finding first match", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Test\n\n- [ ] Duplicate action\n- [ ] Duplicate action\n- [ ] Different action\n"
    );

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Duplicate action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3); // First occurrence
  });

  it("should return error when action text not found in file", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Empty\n\nNo actions here\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Empty.md", "Missing action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("Action not found in file");
  });

  it("should return error when file does not exist", async () => {
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Nonexistent.md", "Test action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("should validate that item still exists after checkbox status changes", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Checkbox changed to [x], so exact match fails
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [x] Test action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    // Should NOT find it because line content changed
    expect(validation.found).toBe(false);
    expect(validation.error).toBe("Line not found");
  });

  it("should handle items removed from source file", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Action has been removed from file
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Different action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(false);
    expect(validation.error).toBe("Line not found");
  });

  it("should find actions with different checkbox statuses (waiting)", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Test\n\n- [w] Waiting action\n- [ ] Normal action\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Waiting action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [w] Waiting action");
  });

  it("should find actions with different checkbox statuses (complete)", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Test\n\n- [x] Completed action\n- [ ] Normal action\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Completed action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [x] Completed action");
  });

  it("should handle lines deleted above focus item", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 10,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Lines deleted, action now at line 7
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n- [ ] Test action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(7);
  });

  it("should handle lines inserted above focus item", async () => {
    const item: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 7,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Lines inserted, action now at line 11
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Description\n\nExtra content\n\n- [ ] Test action\n"
    );

    const validator = new FocusValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(11);
  });
});

describe("Focus Manual Reordering Integration", () => {
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: PluginSettings;
  let saveSettingsMock: jest.Mock;

  beforeEach(() => {
    // Reset mock focus items
    mockFocusItems = [];
    (mockSaveFocusItems as jest.Mock).mockClear();

    mockSettings = { ...DEFAULT_SETTINGS };
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
      getViewState: jest.fn(),
      setViewState: jest.fn(),
      getRoot: jest.fn().mockReturnValue({
        app: mockApp,
      }),
    };
    saveSettingsMock = jest.fn();
  });

  it("should support full pin/reorder/unpin workflow", async () => {
    mockFocusItems = [
      {
        file: "Projects/Project A.md",
        lineNumber: 10,
        lineContent: "- [ ] Action A",
        text: "Action A",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 3000,
        isPinned: false,
      },
      {
        file: "Projects/Project B.md",
        lineNumber: 15,
        lineContent: "- [ ] Action B",
        text: "Action B",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 2000,
        isPinned: false,
      },
      {
        file: "Projects/Project C.md",
        lineNumber: 20,
        lineContent: "- [ ] Action C",
        text: "Action C",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now() - 1000,
        isPinned: false,
      },
    ];

    const view = new FocusView(mockLeaf, mockSettings, saveSettingsMock);
    (view as any).app = mockApp;
    // Re-initialize scanner with mocked app
    (view as any).scanner = {
      scanProjects: jest.fn().mockResolvedValue([]),
    };
    await view.onOpen();

    // Get reference to view's internal focusItems after onOpen loads them
    const focusItems = (view as any).focusItems;

    // Step 1: Pin first item
    await (view as any).pinItem(focusItems[0]);
    expect(mockFocusItems[0].isPinned).toBe(true);

    // Step 2: Pin third item
    await (view as any).pinItem(focusItems[2]);
    expect(mockFocusItems[1].isPinned).toBe(true);
    expect(mockFocusItems[1].text).toBe("Action C");

    // Step 3: Reorder pinned items (swap them)
    (view as any).draggedItem = mockFocusItems[1]; // Action C
    const mockDropEvent = { preventDefault: jest.fn() } as unknown as DragEvent;
    await (view as any).onDrop(mockDropEvent, mockFocusItems[0]); // Drop on Action A

    // Check order: C should now be first
    expect(mockFocusItems[0].text).toBe("Action C");
    expect(mockFocusItems[1].text).toBe("Action A");

    // Step 4: Unpin first item (Action C)
    await (view as any).unpinItem(mockFocusItems[0]);
    expect(mockFocusItems[0].isPinned).toBe(false);

    // Check only Action A is still pinned
    const pinnedItems = mockFocusItems.filter((i) => i.isPinned);
    expect(pinnedItems.length).toBe(1);
    expect(pinnedItems[0].text).toBe("Action A");
  });
});
