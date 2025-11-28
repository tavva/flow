// ABOUTME: Tests for checkbox line parsing utilities.
// ABOUTME: Verifies extraction of status characters and action text from task lines.

import {
  isCheckboxLine,
  extractActionText,
  extractCheckboxStatus,
  isUncheckedCheckbox,
  isWaitingForCheckbox,
  isCompletedCheckbox,
  CheckboxStatus,
} from "../src/checkbox-utils";

describe("checkbox-utils", () => {
  describe("isCheckboxLine", () => {
    it("should return true for unchecked checkbox with dash", () => {
      expect(isCheckboxLine("- [ ] Do something")).toBe(true);
    });

    it("should return true for unchecked checkbox with asterisk", () => {
      expect(isCheckboxLine("* [ ] Do something")).toBe(true);
    });

    it("should return true for waiting-for checkbox", () => {
      expect(isCheckboxLine("- [w] Wait for response")).toBe(true);
    });

    it("should return true for uppercase waiting-for checkbox", () => {
      expect(isCheckboxLine("- [W] Wait for response")).toBe(true);
    });

    it("should return true for completed checkbox", () => {
      expect(isCheckboxLine("- [x] Done task")).toBe(true);
    });

    it("should return true for uppercase completed checkbox", () => {
      expect(isCheckboxLine("- [X] Done task")).toBe(true);
    });

    it("should return false for regular list item", () => {
      expect(isCheckboxLine("- Regular list item")).toBe(false);
    });

    it("should return false for plain text", () => {
      expect(isCheckboxLine("Just some text")).toBe(false);
    });

    it("should return false for heading", () => {
      expect(isCheckboxLine("## Heading")).toBe(false);
    });

    it("should return false for empty line", () => {
      expect(isCheckboxLine("")).toBe(false);
    });

    it("should handle leading whitespace (indented checkboxes)", () => {
      expect(isCheckboxLine("  - [ ] Indented item")).toBe(true);
    });
  });

  describe("extractCheckboxStatus", () => {
    it("should return 'todo' for unchecked checkbox", () => {
      expect(extractCheckboxStatus("- [ ] Do something")).toBe("todo");
    });

    it("should return 'waiting' for [w] checkbox", () => {
      expect(extractCheckboxStatus("- [w] Wait for response")).toBe("waiting");
    });

    it("should return 'waiting' for [W] checkbox", () => {
      expect(extractCheckboxStatus("- [W] Wait for response")).toBe("waiting");
    });

    it("should return 'done' for [x] checkbox", () => {
      expect(extractCheckboxStatus("- [x] Done task")).toBe("done");
    });

    it("should return 'done' for [X] checkbox", () => {
      expect(extractCheckboxStatus("- [X] Done task")).toBe("done");
    });

    it("should return null for non-checkbox line", () => {
      expect(extractCheckboxStatus("- Regular list item")).toBeNull();
    });

    it("should return null for plain text", () => {
      expect(extractCheckboxStatus("Just some text")).toBeNull();
    });

    it("should handle asterisk bullet points", () => {
      expect(extractCheckboxStatus("* [ ] Asterisk item")).toBe("todo");
    });
  });

  describe("extractActionText", () => {
    it("should extract text from unchecked checkbox", () => {
      expect(extractActionText("- [ ] Do something")).toBe("Do something");
    });

    it("should extract text from waiting-for checkbox", () => {
      expect(extractActionText("- [w] Wait for response")).toBe("Wait for response");
    });

    it("should extract text from completed checkbox", () => {
      expect(extractActionText("- [x] Done task")).toBe("Done task");
    });

    it("should return empty string for non-checkbox line", () => {
      expect(extractActionText("- Regular list item")).toBe("");
    });

    it("should return empty string for plain text", () => {
      expect(extractActionText("Just some text")).toBe("");
    });

    it("should trim whitespace from extracted text", () => {
      expect(extractActionText("- [ ]   Extra spaces  ")).toBe("Extra spaces");
    });

    it("should preserve inline tags", () => {
      expect(extractActionText("- [ ] Call dentist #sphere/personal")).toBe(
        "Call dentist #sphere/personal"
      );
    });

    it("should preserve dates", () => {
      expect(extractActionText("- [ ] Submit report 📅 2025-01-15")).toBe(
        "Submit report 📅 2025-01-15"
      );
    });

    it("should handle asterisk bullet points", () => {
      expect(extractActionText("* [ ] Asterisk item")).toBe("Asterisk item");
    });

    it("should handle indented checkboxes", () => {
      expect(extractActionText("  - [ ] Indented item")).toBe("Indented item");
    });
  });

  describe("isUncheckedCheckbox", () => {
    it("should return true for [ ] checkbox", () => {
      expect(isUncheckedCheckbox("- [ ] Todo item")).toBe(true);
    });

    it("should return false for [w] checkbox", () => {
      expect(isUncheckedCheckbox("- [w] Waiting item")).toBe(false);
    });

    it("should return false for [x] checkbox", () => {
      expect(isUncheckedCheckbox("- [x] Done item")).toBe(false);
    });

    it("should return false for non-checkbox", () => {
      expect(isUncheckedCheckbox("- Regular item")).toBe(false);
    });
  });

  describe("isWaitingForCheckbox", () => {
    it("should return true for [w] checkbox", () => {
      expect(isWaitingForCheckbox("- [w] Waiting item")).toBe(true);
    });

    it("should return true for [W] checkbox", () => {
      expect(isWaitingForCheckbox("- [W] Waiting item")).toBe(true);
    });

    it("should return false for [ ] checkbox", () => {
      expect(isWaitingForCheckbox("- [ ] Todo item")).toBe(false);
    });

    it("should return false for [x] checkbox", () => {
      expect(isWaitingForCheckbox("- [x] Done item")).toBe(false);
    });

    it("should return false for non-checkbox", () => {
      expect(isWaitingForCheckbox("- Regular item")).toBe(false);
    });
  });

  describe("isCompletedCheckbox", () => {
    it("should return true for [x] checkbox", () => {
      expect(isCompletedCheckbox("- [x] Done item")).toBe(true);
    });

    it("should return true for [X] checkbox", () => {
      expect(isCompletedCheckbox("- [X] Done item")).toBe(true);
    });

    it("should return false for [ ] checkbox", () => {
      expect(isCompletedCheckbox("- [ ] Todo item")).toBe(false);
    });

    it("should return false for [w] checkbox", () => {
      expect(isCompletedCheckbox("- [w] Waiting item")).toBe(false);
    });

    it("should return false for non-checkbox", () => {
      expect(isCompletedCheckbox("- Regular item")).toBe(false);
    });
  });

  describe("CheckboxStatus type", () => {
    it("should support assignment of valid status values", () => {
      const statuses: CheckboxStatus[] = ["todo", "waiting", "done"];
      expect(statuses).toHaveLength(3);
    });
  });
});
