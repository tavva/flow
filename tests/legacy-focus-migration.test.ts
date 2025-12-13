// ABOUTME: Tests for legacy focus migration from #flow-planned tags to JSON storage.
// ABOUTME: Covers scanning, migration, tag removal, and duplicate handling.

import { App, TFile, Vault } from "obsidian";
import {
  scanForLegacyFocusTags,
  migrateLegacyFocusItems,
  removeLegacyTags,
  LegacyFocusItem,
} from "../src/legacy-focus-migration";
import { FocusItem, PluginSettings, DEFAULT_SETTINGS } from "../src/types";

// Mock obsidian module
jest.mock("obsidian");

// Helper to create properly typed mock TFile
function createMockTFile(path: string): TFile {
  return new TFile(path, path.split("/").pop() || "");
}

describe("scanForLegacyFocusTags", () => {
  let mockVault: jest.Mocked<Vault>;
  let mockApp: jest.Mocked<App>;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
      adapter: {
        read: jest.fn(),
        write: jest.fn(),
      },
    } as unknown as jest.Mocked<Vault>;

    mockApp = {
      vault: mockVault,
      metadataCache: {
        getFileCache: jest.fn(),
      },
    } as unknown as jest.Mocked<App>;
  });

  it("finds checkbox lines with #flow-planned tag", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(
      "# Test Project\n\n- [ ] Call dentist #flow-planned\n- [ ] Something else"
    );

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      file: "Projects/Test.md",
      lineNumber: 3,
      lineContent: "- [ ] Call dentist #flow-planned",
    });
  });

  it("finds tags across multiple files", async () => {
    const mockFile1 = createMockTFile("Projects/A.md");
    const mockFile2 = createMockTFile("Projects/B.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile1, mockFile2]);
    mockVault.read
      .mockResolvedValueOnce("- [ ] Task A #flow-planned")
      .mockResolvedValueOnce("- [ ] Task B #flow-planned");

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("Projects/A.md");
    expect(result[1].file).toBe("Projects/B.md");
  });

  it("finds multiple tagged items in one file", async () => {
    const mockFile = createMockTFile("Next actions.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(
      "- [ ] Task 1 #flow-planned\n- [ ] Task 2 #flow-planned\n- [ ] Task 3"
    );

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(2);
    expect(result[0].lineNumber).toBe(1);
    expect(result[1].lineNumber).toBe(2);
  });

  it("ignores non-checkbox lines with the tag", async () => {
    const mockFile = createMockTFile("Notes.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(
      "Some text with #flow-planned tag\n- [ ] Real task #flow-planned"
    );

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(1);
    expect(result[0].lineNumber).toBe(2);
  });

  it("matches completed and waiting checkboxes", async () => {
    const mockFile = createMockTFile("Tasks.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(
      "- [x] Done task #flow-planned\n- [w] Waiting task #flow-planned\n- [ ] Todo #flow-planned"
    );

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(3);
  });

  it("returns empty array when no tags found", async () => {
    const mockFile = createMockTFile("Clean.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Normal task\n- [ ] Another task");

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(0);
  });

  it("handles empty vault", async () => {
    mockVault.getMarkdownFiles.mockReturnValue([]);

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(0);
  });

  it("matches tag in middle of line", async () => {
    const mockFile = createMockTFile("Tasks.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Call #flow-planned someone tomorrow");

    const result = await scanForLegacyFocusTags(mockVault);

    expect(result).toHaveLength(1);
  });
});

describe("migrateLegacyFocusItems", () => {
  let mockApp: jest.Mocked<App>;

  beforeEach(() => {
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
      },
      metadataCache: {
        getFileCache: jest.fn(),
      },
    } as unknown as jest.Mocked<App>;
  });

  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    nextActionsFilePath: "Next actions.md",
    spheres: ["personal", "work"],
  };

  it("creates FocusItems from legacy items with sphere from frontmatter", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 5,
        lineContent: "- [ ] Call dentist #flow-planned",
      },
    ];

    const mockFile = createMockTFile("Projects/Test.md");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settings);

    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0]).toMatchObject({
      file: "Projects/Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Call dentist #flow-planned",
      text: "Call dentist #flow-planned",
      sphere: "personal",
      isGeneral: false,
    });
    expect(result.migrated[0].addedAt).toBeGreaterThan(0);
    expect(result.skippedNoSphere).toHaveLength(0);
  });

  it("detects sphere from inline tag", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Next actions.md",
        lineNumber: 3,
        lineContent: "- [ ] Buy milk #sphere/personal #flow-planned",
      },
    ];

    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settings);

    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0].sphere).toBe("personal");
    expect(result.migrated[0].isGeneral).toBe(true);
  });

  it("skips items without detectable sphere", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Random.md",
        lineNumber: 1,
        lineContent: "- [ ] Mystery task #flow-planned",
      },
    ];

    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settings);

    expect(result.migrated).toHaveLength(0);
    expect(result.skippedNoSphere).toHaveLength(1);
    expect(result.skippedNoSphere[0]).toEqual(legacyItems[0]);
  });

  it("skips duplicates by file + lineContent", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 5,
        lineContent: "- [ ] Existing task #flow-planned",
      },
    ];

    const existingFocus: FocusItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 5,
        lineContent: "- [ ] Existing task #flow-planned",
        text: "Existing task",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
    ];

    const mockFile = createMockTFile("Projects/Test.md");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/work"] },
    });

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, existingFocus, settings);

    expect(result.migrated).toHaveLength(0);
    expect(result.skippedDuplicate).toHaveLength(1);
  });

  it("sets isGeneral=true for next actions file", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Next actions.md",
        lineNumber: 2,
        lineContent: "- [ ] General task #sphere/work #flow-planned",
      },
    ];

    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settings);

    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0].isGeneral).toBe(true);
  });
});

describe("removeLegacyTags", () => {
  let mockVault: jest.Mocked<Vault>;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      modify: jest.fn(),
    } as unknown as jest.Mocked<Vault>;
  });

  it("removes #flow-planned tag from lines", async () => {
    const items: LegacyFocusItem[] = [
      {
        file: "Tasks.md",
        lineNumber: 2,
        lineContent: "- [ ] Call dentist #flow-planned",
      },
    ];

    const mockFile = createMockTFile("Tasks.md");
    (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockVault.read as jest.Mock).mockResolvedValue(
      "# Tasks\n- [ ] Call dentist #flow-planned\n- [ ] Other task"
    );

    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).toHaveBeenCalledWith(
      mockFile,
      "# Tasks\n- [ ] Call dentist\n- [ ] Other task"
    );
  });

  it("removes tag from middle of line", async () => {
    const items: LegacyFocusItem[] = [
      {
        file: "Tasks.md",
        lineNumber: 1,
        lineContent: "- [ ] Call #flow-planned someone",
      },
    ];

    const mockFile = createMockTFile("Tasks.md");
    (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockVault.read as jest.Mock).mockResolvedValue("- [ ] Call #flow-planned someone");

    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).toHaveBeenCalledWith(mockFile, "- [ ] Call someone");
  });

  it("handles multiple items in same file", async () => {
    const items: LegacyFocusItem[] = [
      { file: "Tasks.md", lineNumber: 1, lineContent: "- [ ] Task 1 #flow-planned" },
      { file: "Tasks.md", lineNumber: 3, lineContent: "- [ ] Task 2 #flow-planned" },
    ];

    const mockFile = createMockTFile("Tasks.md");
    (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockVault.read as jest.Mock).mockResolvedValue(
      "- [ ] Task 1 #flow-planned\n- [ ] Normal\n- [ ] Task 2 #flow-planned"
    );

    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).toHaveBeenCalledWith(
      mockFile,
      "- [ ] Task 1\n- [ ] Normal\n- [ ] Task 2"
    );
  });

  it("handles items across multiple files", async () => {
    const items: LegacyFocusItem[] = [
      { file: "A.md", lineNumber: 1, lineContent: "- [ ] Task A #flow-planned" },
      { file: "B.md", lineNumber: 1, lineContent: "- [ ] Task B #flow-planned" },
    ];

    const mockFileA = createMockTFile("A.md");
    const mockFileB = createMockTFile("B.md");
    (mockVault.getAbstractFileByPath as jest.Mock)
      .mockReturnValueOnce(mockFileA)
      .mockReturnValueOnce(mockFileB);
    (mockVault.read as jest.Mock)
      .mockResolvedValueOnce("- [ ] Task A #flow-planned")
      .mockResolvedValueOnce("- [ ] Task B #flow-planned");

    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).toHaveBeenCalledTimes(2);
    expect(mockVault.modify).toHaveBeenCalledWith(mockFileA, "- [ ] Task A");
    expect(mockVault.modify).toHaveBeenCalledWith(mockFileB, "- [ ] Task B");
  });

  it("skips files that no longer exist", async () => {
    const items: LegacyFocusItem[] = [
      { file: "Deleted.md", lineNumber: 1, lineContent: "- [ ] Task #flow-planned" },
    ];

    (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

    // Suppress expected warning about file not found
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Should not throw
    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("Legacy migration: file not found: Deleted.md");
    warnSpy.mockRestore();
  });

  it("cleans up extra whitespace after tag removal", async () => {
    const items: LegacyFocusItem[] = [
      {
        file: "Tasks.md",
        lineNumber: 1,
        lineContent: "- [ ] Task #flow-planned  ",
      },
    ];

    const mockFile = createMockTFile("Tasks.md");
    (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockVault.read as jest.Mock).mockResolvedValue("- [ ] Task #flow-planned  ");

    await removeLegacyTags(mockVault, items);

    expect(mockVault.modify).toHaveBeenCalledWith(mockFile, "- [ ] Task");
  });
});
