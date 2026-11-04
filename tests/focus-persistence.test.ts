// ABOUTME: Tests for focus persistence using JSONL format for sync-friendly storage.
// ABOUTME: Validates loading, saving, and migration from legacy JSON format.

import { Vault, TFile, TFolder } from "obsidian";
import { FocusItem } from "../src/types";
import { loadFocusItems, saveFocusItems, FOCUS_FILE_PATH } from "../src/focus-persistence";

jest.mock("obsidian");

describe("focus-persistence JSONL format", () => {
  let mockVault: jest.Mocked<Vault>;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      modify: jest.fn(),
      create: jest.fn(),
      createFolder: jest.fn(),
      adapter: {
        exists: jest.fn(),
        read: jest.fn(),
        write: jest.fn(),
        stat: jest.fn(),
      },
    } as unknown as jest.Mocked<Vault>;
  });

  describe("loadFocusItems", () => {
    it("reads the configured file from disk when it is not cached", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);
      (mockVault.adapter.read as jest.Mock).mockResolvedValue('{"text":"Custom task"}');
      const items = await loadFocusItems(mockVault, "GTD/Focus.md");
      expect(items[0].text).toBe("Custom task");
      expect(mockVault.adapter.read).toHaveBeenCalledWith("GTD/Focus.md");
    });

    it("reads a configured cached file", async () => {
      const file = new TFile("GTD/Focus.md");
      mockVault.getAbstractFileByPath.mockImplementation((path) =>
        path === file.path ? file : null
      );
      mockVault.read.mockResolvedValue('{"text":"Custom task"}');
      expect(await loadFocusItems(mockVault, file.path)).toEqual([
        { text: "Custom task", contexts: [] },
      ]);
    });

    it("uses the default path for a blank setting", async () => {
      await loadFocusItems(mockVault, "  ");
      expect(mockVault.getAbstractFileByPath).toHaveBeenCalledWith(FOCUS_FILE_PATH);
    });
    it("loads items from JSONL format (one JSON object per line)", async () => {
      const item1: FocusItem = {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Task 1",
        text: "Task 1",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000000000,
      };
      const item2: FocusItem = {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [ ] Task 2 #sphere/personal",
        text: "Task 2",
        sphere: "personal",
        isGeneral: true,
        addedAt: 1700000001000,
      };

      const jsonlContent = `${JSON.stringify(item1)}\n${JSON.stringify(item2)}`;

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(jsonlContent);

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ...item1, contexts: [] });
      expect(result[1]).toEqual({ ...item2, contexts: [] });
    });

    it("handles empty file", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue("");

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(0);
    });

    it("handles file with only whitespace lines", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue("  \n\n  \n");

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(0);
    });

    it("skips invalid JSON lines and logs warning", async () => {
      const validItem: FocusItem = {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Valid task",
        text: "Valid task",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000000000,
      };

      const jsonlContent = `${JSON.stringify(validItem)}\nthis is not valid json\n${JSON.stringify({ ...validItem, text: "Another valid" })}`;

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(jsonlContent);

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping invalid line"),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it("migrates legacy JSON format to JSONL on load", async () => {
      const legacyContent = JSON.stringify({
        version: 1,
        items: [
          {
            file: "Projects/Test.md",
            lineNumber: 10,
            lineContent: "- [ ] Legacy task",
            text: "Legacy task",
            sphere: "work",
            isGeneral: false,
            addedAt: 1700000000000,
          },
        ],
      });

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(legacyContent);

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Legacy task");
    });

    it("defaults contexts to empty array when loading items without contexts field", async () => {
      const itemWithoutContexts = {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Task 1",
        text: "Task 1",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000000000,
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(JSON.stringify(itemWithoutContexts));

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(1);
      expect(result[0].contexts).toEqual([]);
    });

    it("preserves contexts when loading items with contexts field", async () => {
      const itemWithContexts = {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Call dentist #context/phone",
        text: "Call dentist #context/phone",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000000000,
        contexts: ["phone"],
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(JSON.stringify(itemWithContexts));

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(1);
      expect(result[0].contexts).toEqual(["phone"]);
    });

    it("returns empty array when file does not exist", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(false);

      const result = await loadFocusItems(mockVault);

      expect(result).toHaveLength(0);
    });

    it("handles corrupted line gracefully without breaking other items", async () => {
      const item1: FocusItem = {
        file: "Projects/A.md",
        lineNumber: 1,
        lineContent: "- [ ] First",
        text: "First",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000000000,
      };
      const item2: FocusItem = {
        file: "Projects/B.md",
        lineNumber: 2,
        lineContent: "- [ ] Second",
        text: "Second",
        sphere: "work",
        isGeneral: false,
        addedAt: 1700000001000,
      };

      // Simulate sync corruption: two items merged on one line
      const corruptedContent = `${JSON.stringify(item1)}\n{"file":"Projects/Corrupt.md"${JSON.stringify(item2)}`;

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue(corruptedContent);

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = await loadFocusItems(mockVault);

      // Should still get the valid first item
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ ...item1, contexts: [] });

      consoleSpy.mockRestore();
    });
  });

  describe("saveFocusItems", () => {
    it("creates nested parent folders and writes only the configured file", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(false);
      await saveFocusItems(mockVault, [], "GTD/Data/Focus.md");
      expect(mockVault.createFolder.mock.calls).toEqual([["GTD"], ["GTD/Data"]]);
      expect(mockVault.create).toHaveBeenCalledWith("GTD/Data/Focus.md", "");
    });

    it("supports a file in the vault root without creating a folder", async () => {
      await saveFocusItems(mockVault, [], "Focus.md");
      expect(mockVault.createFolder).not.toHaveBeenCalled();
      expect(mockVault.create).toHaveBeenCalledWith("Focus.md", "");
    });

    it("updates a configured file that has not entered the cache", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);
      await saveFocusItems(mockVault, [], "Focus.md");
      expect(mockVault.adapter.write).toHaveBeenCalledWith("Focus.md", "");
      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it("rejects a file occupying a parent folder path", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(new TFile("GTD"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      await expect(saveFocusItems(mockVault, [], "GTD/Focus.md")).rejects.toThrow("not a folder");
      expect(mockVault.modify).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
    it("saves items in JSONL format (one JSON object per line)", async () => {
      const items: FocusItem[] = [
        {
          file: "Projects/Test.md",
          lineNumber: 10,
          lineContent: "- [ ] Task 1",
          text: "Task 1",
          sphere: "work",
          isGeneral: false,
          addedAt: 1700000000000,
        },
        {
          file: "Next actions.md",
          lineNumber: 5,
          lineContent: "- [ ] Task 2",
          text: "Task 2",
          sphere: "personal",
          isGeneral: true,
          addedAt: 1700000001000,
        },
      ];

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);
      (mockVault.adapter.stat as jest.Mock).mockResolvedValue({ type: "folder" });

      await saveFocusItems(mockVault, items);

      expect(mockVault.modify).toHaveBeenCalledWith(
        mockFile,
        `${JSON.stringify(items[0])}\n${JSON.stringify(items[1])}`
      );
    });

    it("creates empty file when saving empty array", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);
      (mockVault.adapter.stat as jest.Mock).mockResolvedValue({ type: "folder" });

      await saveFocusItems(mockVault, []);

      expect(mockVault.modify).toHaveBeenCalledWith(mockFile, "");
    });

    it("creates directory if it does not exist", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      (mockVault.adapter.exists as jest.Mock).mockResolvedValue(false);

      await saveFocusItems(mockVault, []);

      expect(mockVault.createFolder).toHaveBeenCalledWith("flow-focus-data");
    });
  });

  describe("external items", () => {
    const vaultItem: FocusItem = {
      file: "Projects/Test.md",
      lineNumber: 10,
      lineContent: "- [ ] Task 1",
      text: "Task 1",
      sphere: "work",
      isGeneral: false,
      addedAt: 1700000000000,
      contexts: [],
    };
    const externalItem: FocusItem = {
      id: "7c1e",
      text: "Draft section 2 of the evals plan",
      sphere: "work",
      addedAt: 1700000001000,
      isPinned: true,
      external: {
        sourceName: "linear",
        sourceLabel: "Rootcause",
        url: "https://linear.app/rootcause/issue/ROO-123/evals-plan",
        externalId: "ROO-123",
      },
      contexts: [],
    };

    it("saves and loads a mix of vault and external items unchanged", async () => {
      const file = new TFile("flow-focus-data/focus.md");
      let content = "";
      mockVault.getAbstractFileByPath.mockReturnValue(file);
      (mockVault.adapter.stat as jest.Mock).mockResolvedValue({ type: "folder" });
      mockVault.modify.mockImplementation(async (_file, value) => {
        content = value;
      });
      mockVault.read.mockImplementation(async () => content);

      await saveFocusItems(mockVault, [vaultItem, externalItem]);

      expect(content.split("\n")).toEqual([
        JSON.stringify(vaultItem),
        JSON.stringify(externalItem),
      ]);
      expect(await loadFocusItems(mockVault)).toEqual([vaultItem, externalItem]);
    });

    it.each([
      ["a null source", { ...externalItem, external: null }],
      ["no id", { ...externalItem, id: undefined }],
      ["a source missing its url", { ...externalItem, external: { sourceName: "linear" } }],
      [
        "a source with a non-text label",
        { ...externalItem, external: { ...externalItem.external, sourceLabel: 3 } },
      ],
    ])("skips an external line with %s and warns", async (_case, badItem) => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const file = new TFile("flow-focus-data/focus.md");
      mockVault.getAbstractFileByPath.mockReturnValue(file);
      mockVault.read.mockResolvedValue(
        [JSON.stringify(vaultItem), JSON.stringify(badItem), "42"].join("\n")
      );

      expect(await loadFocusItems(mockVault)).toEqual([vaultItem]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith("Skipping invalid line in focus file:", expect.any(String));
      warn.mockRestore();
    });
  });
});
