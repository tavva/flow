// tests/hotlist-validator.test.ts
import { HotlistValidator, ValidationResult } from "../src/hotlist-validator";
import { HotlistItem } from "../src/types";
import { TFile } from "obsidian";

// Mock Obsidian
jest.mock("obsidian");

describe("HotlistValidator", () => {
  let validator: HotlistValidator;
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
    validator = new HotlistValidator(mockApp);
  });

  describe("validateItem", () => {
    it("should validate when line number and content match", async () => {
      const item: HotlistItem = {
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
      const item: HotlistItem = {
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
  });
});
