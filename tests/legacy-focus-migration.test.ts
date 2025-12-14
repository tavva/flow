// ABOUTME: Tests for legacy focus migration from #flow-planned tags to JSON storage.
// ABOUTME: Covers scanning, migration, tag removal, and duplicate handling.

import { App, TFile, Vault } from "obsidian";
import {
  scanForLegacyFocusTags,
  migrateLegacyFocusItems,
  removeLegacyTags,
  checkAndPromptLegacyMigration,
  LegacyFocusItem,
  LegacyMigrationModal,
  TagRemovalModal,
} from "../src/legacy-focus-migration";
import * as focusPersistence from "../src/focus-persistence";
import { FocusItem, PluginSettings, DEFAULT_SETTINGS } from "../src/types";

// Mock obsidian module
jest.mock("obsidian");

// Mock focus-persistence module
jest.mock("../src/focus-persistence");

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
      workspace: {
        getLeavesOfType: jest.fn().mockReturnValue([]),
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

  it("detects sphere from single-string frontmatter tag (not array)", async () => {
    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Projects/Single.md",
        lineNumber: 3,
        lineContent: "- [ ] Task #flow-planned",
      },
    ];

    const mockFile = createMockTFile("Projects/Single.md");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    // Single string tag instead of array
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: "project/work" },
    });

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settings);

    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0].sphere).toBe("work");
  });

  it("uses default next actions path when setting is empty", async () => {
    const settingsWithEmptyPath: PluginSettings = {
      ...DEFAULT_SETTINGS,
      nextActionsFilePath: "",
      spheres: ["personal", "work"],
    };

    const legacyItems: LegacyFocusItem[] = [
      {
        file: "Next actions.md", // Default path
        lineNumber: 2,
        lineContent: "- [ ] Task #sphere/personal #flow-planned",
      },
    ];

    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

    const result = await migrateLegacyFocusItems(mockApp, legacyItems, [], settingsWithEmptyPath);

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

describe("LegacyMigrationModal", () => {
  let mockApp: jest.Mocked<App>;

  beforeEach(() => {
    mockApp = new App() as jest.Mocked<App>;
  });

  it("renders migration prompt with correct item count", () => {
    const onMigrate = jest.fn();
    const onDismissForever = jest.fn();

    const modal = new LegacyMigrationModal(mockApp, 5, onMigrate, onDismissForever);
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("5 items");
    expect(contentText).toContain("#flow-planned");
  });

  it("uses singular form for single item", () => {
    const modal = new LegacyMigrationModal(mockApp, 1, jest.fn(), jest.fn());
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("1 item");
    expect(contentText).not.toContain("1 items");
  });

  it("calls onMigrate when Migrate button is clicked", async () => {
    const onMigrate = jest.fn().mockResolvedValue(undefined);
    const modal = new LegacyMigrationModal(mockApp, 3, onMigrate, jest.fn());
    modal.close = jest.fn();
    modal.onOpen();

    const migrateBtn = modal.contentEl.querySelector("button.mod-cta");
    expect(migrateBtn).not.toBeNull();

    await (migrateBtn as HTMLButtonElement).click();
    // Give async handler time to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.close).toHaveBeenCalled();
    expect(onMigrate).toHaveBeenCalled();
  });

  it("calls onDismissForever when Don't ask again is clicked", async () => {
    const onDismissForever = jest.fn().mockResolvedValue(undefined);
    const modal = new LegacyMigrationModal(mockApp, 3, jest.fn(), onDismissForever);
    modal.close = jest.fn();
    modal.onOpen();

    const buttons = modal.contentEl.querySelectorAll("button");
    const dismissBtn = Array.from(buttons).find((b) => b.textContent === "Don't ask again");
    expect(dismissBtn).not.toBeNull();

    await (dismissBtn as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.close).toHaveBeenCalled();
    expect(onDismissForever).toHaveBeenCalled();
  });

  it("closes without callback when Not now is clicked", () => {
    const onMigrate = jest.fn();
    const onDismissForever = jest.fn();
    const modal = new LegacyMigrationModal(mockApp, 3, onMigrate, onDismissForever);
    modal.close = jest.fn();
    modal.onOpen();

    const buttons = modal.contentEl.querySelectorAll("button");
    const notNowBtn = Array.from(buttons).find((b) => b.textContent === "Not now");
    expect(notNowBtn).not.toBeNull();

    (notNowBtn as HTMLButtonElement).click();

    expect(modal.close).toHaveBeenCalled();
    expect(onMigrate).not.toHaveBeenCalled();
    expect(onDismissForever).not.toHaveBeenCalled();
  });

  it("clears content on close", () => {
    const modal = new LegacyMigrationModal(mockApp, 3, jest.fn(), jest.fn());
    modal.onOpen();

    expect(modal.contentEl.childNodes.length).toBeGreaterThan(0);

    modal.onClose();

    expect(modal.contentEl.childNodes.length).toBe(0);
  });
});

describe("TagRemovalModal", () => {
  let mockApp: jest.Mocked<App>;

  beforeEach(() => {
    mockApp = new App() as jest.Mocked<App>;
  });

  it("renders migration success message", () => {
    const modal = new TagRemovalModal(mockApp, 5, 0, jest.fn(), jest.fn());
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("5 items migrated");
  });

  it("shows skipped count when items were skipped", () => {
    const modal = new TagRemovalModal(mockApp, 3, 2, jest.fn(), jest.fn());
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("3 items migrated");
    expect(contentText).toContain("2 items skipped");
  });

  it("uses singular form for single migrated item", () => {
    const modal = new TagRemovalModal(mockApp, 1, 0, jest.fn(), jest.fn());
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("1 item migrated");
    expect(contentText).not.toContain("1 items");
  });

  it("uses singular form for single skipped item", () => {
    const modal = new TagRemovalModal(mockApp, 3, 1, jest.fn(), jest.fn());
    modal.onOpen();

    const contentText = modal.contentEl.textContent;
    expect(contentText).toContain("1 item skipped");
    expect(contentText).not.toMatch(/1 items skipped/);
  });

  it("calls onRemove when Remove tags button is clicked", async () => {
    const onRemove = jest.fn().mockResolvedValue(undefined);
    const modal = new TagRemovalModal(mockApp, 3, 0, onRemove, jest.fn());
    modal.close = jest.fn();
    modal.onOpen();

    const removeBtn = modal.contentEl.querySelector("button.mod-cta");
    expect(removeBtn).not.toBeNull();

    await (removeBtn as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.close).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it("calls onKeepForever when Keep forever is clicked", async () => {
    const onKeepForever = jest.fn().mockResolvedValue(undefined);
    const modal = new TagRemovalModal(mockApp, 3, 0, jest.fn(), onKeepForever);
    modal.close = jest.fn();
    modal.onOpen();

    const buttons = modal.contentEl.querySelectorAll("button");
    const keepForeverBtn = Array.from(buttons).find((b) => b.textContent === "Keep forever");
    expect(keepForeverBtn).not.toBeNull();

    await (keepForeverBtn as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.close).toHaveBeenCalled();
    expect(onKeepForever).toHaveBeenCalled();
  });

  it("closes without callback when Keep for now is clicked", () => {
    const onRemove = jest.fn();
    const onKeepForever = jest.fn();
    const modal = new TagRemovalModal(mockApp, 3, 0, onRemove, onKeepForever);
    modal.close = jest.fn();
    modal.onOpen();

    const buttons = modal.contentEl.querySelectorAll("button");
    const keepNowBtn = Array.from(buttons).find((b) => b.textContent === "Keep for now");
    expect(keepNowBtn).not.toBeNull();

    (keepNowBtn as HTMLButtonElement).click();

    expect(modal.close).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onKeepForever).not.toHaveBeenCalled();
  });

  it("clears content on close", () => {
    const modal = new TagRemovalModal(mockApp, 3, 0, jest.fn(), jest.fn());
    modal.onOpen();

    expect(modal.contentEl.childNodes.length).toBeGreaterThan(0);

    modal.onClose();

    expect(modal.contentEl.childNodes.length).toBe(0);
  });
});

describe("checkAndPromptLegacyMigration", () => {
  let mockApp: jest.Mocked<App>;
  let mockVault: jest.Mocked<Vault>;
  let settings: PluginSettings;
  let saveSettings: jest.Mock;
  let capturedMigrationModal: {
    onMigrate: () => Promise<void>;
    onDismissForever: () => Promise<void>;
  } | null;
  let capturedTagRemovalModal: {
    onRemove: () => Promise<void>;
    onKeepForever: () => Promise<void>;
  } | null;

  beforeEach(() => {
    jest.clearAllMocks();

    capturedMigrationModal = null;
    capturedTagRemovalModal = null;

    mockVault = {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read: jest.fn(),
      modify: jest.fn(),
      getAbstractFileByPath: jest.fn(),
    } as unknown as jest.Mocked<Vault>;

    mockApp = {
      vault: mockVault,
      metadataCache: {
        getFileCache: jest.fn(),
      },
      workspace: {
        getLeavesOfType: jest.fn().mockReturnValue([]),
      },
    } as unknown as jest.Mocked<App>;

    settings = {
      ...DEFAULT_SETTINGS,
      legacyFocusMigrationDismissed: false,
      legacyFocusTagRemovalDismissed: false,
      spheres: ["personal", "work"],
    };

    saveSettings = jest.fn().mockResolvedValue(undefined);

    // Mock loadFocusItems to return empty by default
    (focusPersistence.loadFocusItems as jest.Mock).mockResolvedValue([]);
    (focusPersistence.saveFocusItems as jest.Mock).mockResolvedValue(undefined);

    // Mock LegacyMigrationModal to capture callbacks
    jest.spyOn(LegacyMigrationModal.prototype, "open").mockImplementation(function (this: any) {
      capturedMigrationModal = {
        onMigrate: this.onMigrate,
        onDismissForever: this.onDismissForever,
      };
    });

    // Mock TagRemovalModal to capture callbacks
    jest.spyOn(TagRemovalModal.prototype, "open").mockImplementation(function (this: any) {
      capturedTagRemovalModal = {
        onRemove: this.onRemove,
        onKeepForever: this.onKeepForever,
      };
    });
  });

  it("returns early when legacyFocusMigrationDismissed is true", async () => {
    settings.legacyFocusMigrationDismissed = true;

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);

    expect(mockVault.getMarkdownFiles).not.toHaveBeenCalled();
    expect(capturedMigrationModal).toBeNull();
  });

  it("returns early when no legacy tags found", async () => {
    mockVault.getMarkdownFiles.mockReturnValue([createMockTFile("Clean.md")]);
    mockVault.read.mockResolvedValue("- [ ] Normal task without tag");

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);

    expect(capturedMigrationModal).toBeNull();
  });

  it("opens migration modal when legacy tags are found", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);

    expect(capturedMigrationModal).not.toBeNull();
  });

  it("saves settings when user dismisses migration forever", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);

    expect(capturedMigrationModal).not.toBeNull();

    // User clicks "Don't ask again"
    await capturedMigrationModal!.onDismissForever();

    expect(settings.legacyFocusMigrationDismissed).toBe(true);
    expect(saveSettings).toHaveBeenCalled();
  });

  it("migrates items and saves to focus when user confirms", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);

    // User clicks "Migrate"
    await capturedMigrationModal!.onMigrate();

    // Should have loaded existing items
    expect(focusPersistence.loadFocusItems).toHaveBeenCalledWith(mockVault);

    // Should have saved migrated items
    expect(focusPersistence.saveFocusItems).toHaveBeenCalledWith(
      mockVault,
      expect.arrayContaining([
        expect.objectContaining({
          file: "Projects/Test.md",
          text: "Task #flow-planned",
          sphere: "personal",
        }),
      ])
    );
  });

  it("opens tag removal modal after successful migration", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);
    await capturedMigrationModal!.onMigrate();

    expect(capturedTagRemovalModal).not.toBeNull();
  });

  it("skips tag removal modal when legacyFocusTagRemovalDismissed is true", async () => {
    settings.legacyFocusTagRemovalDismissed = true;

    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);
    await capturedMigrationModal!.onMigrate();

    // Tag removal modal should NOT be shown
    expect(capturedTagRemovalModal).toBeNull();
  });

  it("removes legacy tags when user confirms in tag removal modal", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    // Track saved items so loadFocusItems returns them after migration
    let savedItems: FocusItem[] = [];
    (focusPersistence.saveFocusItems as jest.Mock).mockImplementation(
      async (_vault: any, items: FocusItem[]) => {
        savedItems = items;
      }
    );
    (focusPersistence.loadFocusItems as jest.Mock).mockImplementation(async () => savedItems);

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);
    await capturedMigrationModal!.onMigrate();
    await capturedTagRemovalModal!.onRemove();

    // Should have modified the file to remove tags
    expect(mockVault.modify).toHaveBeenCalledWith(mockFile, "- [ ] Task");

    // Should have updated focus items to remove tag from lineContent and text
    expect(savedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lineContent: "- [ ] Task",
          text: "Task",
        }),
      ])
    );
  });

  it("saves settings when user chooses to keep tags forever", async () => {
    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] Task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);
    await capturedMigrationModal!.onMigrate();
    await capturedTagRemovalModal!.onKeepForever();

    expect(settings.legacyFocusTagRemovalDismissed).toBe(true);
    expect(saveSettings).toHaveBeenCalled();
  });

  it("merges migrated items with existing focus items", async () => {
    const existingItem: FocusItem = {
      file: "Existing.md",
      lineNumber: 1,
      lineContent: "- [ ] Existing task",
      text: "Existing task",
      sphere: "work",
      isGeneral: false,
      addedAt: 12345,
    };
    (focusPersistence.loadFocusItems as jest.Mock).mockResolvedValue([existingItem]);

    const mockFile = createMockTFile("Projects/Test.md");
    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue("- [ ] New task #flow-planned");
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/personal"] },
    });

    await checkAndPromptLegacyMigration(mockApp, settings, saveSettings);
    await capturedMigrationModal!.onMigrate();

    // Should save both existing and new items
    expect(focusPersistence.saveFocusItems).toHaveBeenCalledWith(
      mockVault,
      expect.arrayContaining([
        existingItem,
        expect.objectContaining({
          file: "Projects/Test.md",
          text: "New task #flow-planned",
        }),
      ])
    );
  });
});
