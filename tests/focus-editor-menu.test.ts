// ABOUTME: Tests for focus editor menu functionality - right-click context menu for adding/removing from focus.
// ABOUTME: Verifies checkbox detection, action text extraction, sphere detection, and focus state checks.

import {
  isCheckboxLine,
  extractActionText,
  determineActionSphere,
  isActionOnFocus,
} from "../src/focus-editor-menu";
import { FlowProject, FocusItem } from "../src/types";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("focus-editor-menu", () => {
  describe("isCheckboxLine", () => {
    it("should return true for unchecked task", () => {
      expect(isCheckboxLine("- [ ] Some action")).toBe(true);
    });

    it("should return true for completed task", () => {
      expect(isCheckboxLine("- [x] Completed action")).toBe(true);
      expect(isCheckboxLine("- [X] Completed action")).toBe(true);
    });

    it("should return true for waiting task", () => {
      expect(isCheckboxLine("- [w] Waiting action")).toBe(true);
    });

    it("should return true for asterisk bullet", () => {
      expect(isCheckboxLine("* [ ] Action with asterisk")).toBe(true);
    });

    it("should return false for non-checkbox lines", () => {
      expect(isCheckboxLine("Regular text")).toBe(false);
      expect(isCheckboxLine("- Regular list item")).toBe(false);
      expect(isCheckboxLine("# Heading")).toBe(false);
    });

    it("should return false for empty or whitespace lines", () => {
      expect(isCheckboxLine("")).toBe(false);
      expect(isCheckboxLine("   ")).toBe(false);
    });
  });

  describe("extractActionText", () => {
    it("should extract action text from unchecked task", () => {
      expect(extractActionText("- [ ] Call dentist")).toBe("Call dentist");
    });

    it("should extract action text from completed task", () => {
      expect(extractActionText("- [x] Done task")).toBe("Done task");
    });

    it("should extract action text from waiting task", () => {
      expect(extractActionText("- [w] Waiting for feedback")).toBe("Waiting for feedback");
    });

    it("should extract action text with sphere tag", () => {
      expect(extractActionText("- [ ] Action #sphere/work")).toBe("Action #sphere/work");
    });

    it("should handle asterisk bullets", () => {
      expect(extractActionText("* [ ] Action with asterisk")).toBe("Action with asterisk");
    });

    it("should trim whitespace", () => {
      expect(extractActionText("- [ ]   Extra spaces   ")).toBe("Extra spaces");
    });

    it("should return empty string for non-checkbox lines", () => {
      expect(extractActionText("Not a checkbox")).toBe("");
    });
  });

  describe("determineActionSphere", () => {
    let mockApp: any;
    let mockVault: any;
    let mockMetadataCache: any;

    beforeEach(() => {
      mockVault = {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
      };
      mockMetadataCache = {
        getFileCache: jest.fn(),
      };
      mockApp = {
        vault: mockVault,
        metadataCache: mockMetadataCache,
      };
    });

    it("should extract sphere from project tags", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockMetadataCache.getFileCache.mockReturnValue({
        frontmatter: {
          tags: ["project/work"],
        },
      });

      const sphere = await determineActionSphere(mockApp, "Projects/Test.md", "- [ ] Some action");

      expect(sphere).toBe("work");
    });

    it("should extract sphere from inline tag in action text", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockMetadataCache.getFileCache.mockReturnValue({});

      const sphere = await determineActionSphere(
        mockApp,
        "Next actions.md",
        "- [ ] Action #sphere/personal"
      );

      expect(sphere).toBe("personal");
    });

    it("should prioritize project tags over inline tags", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockMetadataCache.getFileCache.mockReturnValue({
        frontmatter: {
          tags: ["project/work"],
        },
      });

      const sphere = await determineActionSphere(
        mockApp,
        "Projects/Test.md",
        "- [ ] Action #sphere/personal"
      );

      expect(sphere).toBe("work");
    });

    it("should return null when no sphere found", async () => {
      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockMetadataCache.getFileCache.mockReturnValue({});

      const sphere = await determineActionSphere(
        mockApp,
        "Random.md",
        "- [ ] Action without sphere"
      );

      expect(sphere).toBeNull();
    });

    it("should return null when file not found", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const sphere = await determineActionSphere(mockApp, "Missing.md", "- [ ] Action");

      expect(sphere).toBeNull();
    });
  });

  describe("isActionOnFocus", () => {
    const focus: FocusItem[] = [
      {
        file: "Projects/Project1.md",
        lineNumber: 5,
        lineContent: "- [ ] First action",
        text: "First action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 10,
        lineContent: "- [ ] General action #sphere/personal",
        text: "General action",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
    ];

    it("should return true when action is on focus", () => {
      expect(isActionOnFocus("Projects/Project1.md", 5, focus)).toBe(true);
    });

    it("should return false when file matches but line number doesn't", () => {
      expect(isActionOnFocus("Projects/Project1.md", 99, focus)).toBe(false);
    });

    it("should return false when line matches but file doesn't", () => {
      expect(isActionOnFocus("Projects/Different.md", 5, focus)).toBe(false);
    });

    it("should return false when action not on focus", () => {
      expect(isActionOnFocus("Projects/Other.md", 20, focus)).toBe(false);
    });

    it("should return false for empty focus", () => {
      expect(isActionOnFocus("Projects/Project1.md", 5, [])).toBe(false);
    });
  });
});
