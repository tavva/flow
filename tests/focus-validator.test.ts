// tests/focus-validator.test.ts
import { FocusValidator, ValidationResult } from "../src/focus-validator";
import { FocusItem } from "../src/types";
import { TFile } from "obsidian";

// Mock Obsidian
jest.mock("obsidian");

describe("FocusValidator", () => {
  let validator: FocusValidator;
  let mockApp: any;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
    };
    validator = new FocusValidator(mockApp);
  });

  describe("validateItem", () => {
    it("should validate when line number and content match", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue("# Heading\n- [ ] Test action\n- [ ] Another");

      const result = await validator.validateItem(item);

      expect(result.found).toBe(true);
      expect(result.updatedLineNumber).toBeUndefined();
    });

    it("should return error when file does not exist", async () => {
      const item: FocusItem = {
        file: "nonexistent.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const result = await validator.validateItem(item);

      expect(result.found).toBe(false);
      expect(result.error).toBe("File not found");
    });

    it("should find item when lines inserted above", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      // Line now at position 4 instead of 2
      mockVault.read.mockResolvedValue(
        "# Heading\n# New Section\n# Another Section\n- [ ] Test action\n- [ ] Another"
      );

      const result = await validator.validateItem(item);

      expect(result.found).toBe(true);
      expect(result.updatedLineNumber).toBe(4);
    });

    it("should find item when lines deleted above", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 5,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      // Line now at position 2 instead of 5
      mockVault.read.mockResolvedValue("# Heading\n- [ ] Test action\n- [ ] Another");

      const result = await validator.validateItem(item);

      expect(result.found).toBe(true);
      expect(result.updatedLineNumber).toBe(2);
    });

    it("should handle checkbox status changes", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      // Checkbox changed to [x] but we stored [ ]
      mockVault.read.mockResolvedValue("# Heading\n- [x] Test action\n- [ ] Another");

      const result = await validator.validateItem(item);

      // Should NOT find it because content changed
      expect(result.found).toBe(false);
      expect(result.error).toBe("Line not found");
    });

    it("should return error when content completely changed", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 2,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue("# Heading\n- [ ] Different action\n- [ ] Another");

      const result = await validator.validateItem(item);

      expect(result.found).toBe(false);
      expect(result.error).toBe("Line not found");
    });

    it("should handle multiple identical actions by using first match", async () => {
      const item: FocusItem = {
        file: "test.md",
        lineNumber: 5,
        lineContent: "- [ ] Test action",
        text: "Test action",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      };

      const mockFile = new TFile();
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      // Line 5 had the action but now it's only at lines 2 and 3
      mockVault.read.mockResolvedValue(
        "# Heading\n- [ ] Test action\n- [ ] Test action\n- [ ] Another"
      );

      const result = await validator.validateItem(item);

      expect(result.found).toBe(true);
      // Should find the first occurrence at line 2
      expect(result.updatedLineNumber).toBe(2);
    });
  });
});
