import {
  validateApiKey,
  validatePriority,
  validateStatus,
  validateProjectTag,
  sanitizeFileName,
  validateInboxItem,
  validateNextAction,
  validateReminderDate,
} from "../src/validation";

describe("Validation", () => {
  describe("validateApiKey", () => {
    it("should accept valid Anthropic API key", () => {
      const result = validateApiKey("sk-ant-api03-1234567890abcdefghijklmnop");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty API key", () => {
      const result = validateApiKey("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject API key with wrong prefix", () => {
      const result = validateApiKey("sk-wrong-1234567890abcdefghijklmnop");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid Anthropic API key format");
    });

    it("should reject too short API key", () => {
      const result = validateApiKey("sk-ant-short");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });
  });

  describe("validatePriority", () => {
    it("should accept valid priority values", () => {
      for (let i = 1; i <= 5; i++) {
        const result = validatePriority(i);
        expect(result.valid).toBe(true);
      }
    });

    it("should reject priority below 1", () => {
      const result = validatePriority(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 1 and 5");
    });

    it("should reject priority above 5", () => {
      const result = validatePriority(6);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 1 and 5");
    });

    it("should reject non-integer priority", () => {
      const result = validatePriority(2.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be an integer");
    });
  });

  describe("validateStatus", () => {
    it("should accept valid status values", () => {
      const validStatuses = ["live", "active", "planning", "paused", "completed"];
      validStatuses.forEach((status) => {
        const result = validateStatus(status);
        expect(result.valid).toBe(true);
      });
    });

    it("should accept case-insensitive status", () => {
      const result = validateStatus("LIVE");
      expect(result.valid).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = validateStatus("invalid-status");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be one of");
    });

    it("should reject empty status", () => {
      const result = validateStatus("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });
  });

  describe("validateProjectTag", () => {
    it("should accept valid project tags", () => {
      const validTags = [
        "project/personal",
        "project/work",
        "project/health",
        "project/personal/fitness",
      ];

      validTags.forEach((tag) => {
        const result = validateProjectTag(tag);
        expect(result.valid).toBe(true);
      });
    });

    it("should reject tags without project/ prefix", () => {
      const result = validateProjectTag("personal");
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with "project/"');
    });

    it("should reject tags with only project/ prefix", () => {
      const result = validateProjectTag("project/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must have a category");
    });

    it("should reject empty tags", () => {
      const result = validateProjectTag("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject tags with invalid characters", () => {
      const result = validateProjectTag("project/per$onal");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid characters");
    });
  });

  describe("sanitizeFileName", () => {
    it("should remove invalid characters", () => {
      const result = sanitizeFileName("My<File>Name:Test");
      expect(result).toBe("MyFileNameTest");
    });

    it("should normalize whitespace", () => {
      const result = sanitizeFileName("My   File   Name");
      expect(result).toBe("My File Name");
    });

    it("should trim whitespace", () => {
      const result = sanitizeFileName("  My File Name  ");
      expect(result).toBe("My File Name");
    });

    it("should limit length to 255 characters", () => {
      const longName = "a".repeat(300);
      const result = sanitizeFileName(longName);
      expect(result.length).toBe(255);
    });

    it("should handle special characters", () => {
      const result = sanitizeFileName("File/With\\Special|Chars?*");
      expect(result).toBe("FileWithSpecialChars");
    });
  });

  describe("validateInboxItem", () => {
    it("should accept valid inbox items", () => {
      const result = validateInboxItem("Call dentist to schedule appointment");
      expect(result.valid).toBe(true);
    });

    it("should reject empty items", () => {
      const result = validateInboxItem("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject whitespace-only items", () => {
      const result = validateInboxItem("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject items that are too long", () => {
      const longItem = "a".repeat(1001);
      const result = validateInboxItem(longItem);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });
  });

  describe("validateNextAction", () => {
    it("should accept well-formed next actions", () => {
      const goodActions = [
        "Call Dr. Smith at 555-0123 to schedule annual checkup",
        "Email John to confirm meeting time for Thursday",
        "Write first draft of project proposal",
        "Review quarterly financial reports before Friday meeting",
      ];

      goodActions.forEach((action) => {
        const result = validateNextAction(action);
        expect(result.valid).toBe(true);
        expect(result.warnings).toBeUndefined();
      });
    });

    it("should warn about short actions", () => {
      const result = validateNextAction("Call Bob");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("too short");
    });

    it("should warn about missing action verb", () => {
      const result = validateNextAction("The project needs to be reviewed");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w) => w.includes("action verb"))).toBe(true);
    });

    it("should warn about vague terms", () => {
      const result = validateNextAction("Do something about the project");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w) => w.includes("vague terms"))).toBe(true);
    });

    it("should accept action starting with capital verb", () => {
      const result = validateNextAction("Call Sarah to discuss the proposal");
      expect(result.valid).toBe(true);
    });

    it("should return no warnings for perfect actions", () => {
      const result = validateNextAction(
        "Email Sarah at sarah@example.com to confirm Thursday meeting at 2pm"
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it("should handle multiple warnings", () => {
      const result = validateNextAction("Do stuff");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(1);
    });
  });

  describe("validateReminderDate", () => {
    it("should accept empty string as valid (optional field)", () => {
      const result = validateReminderDate("");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid date in YYYY-MM-DD format", () => {
      const result = validateReminderDate("2026-01-12");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept leap year dates", () => {
      const result = validateReminderDate("2024-02-29");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid date format", () => {
      const result = validateReminderDate("01/12/2026");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("YYYY-MM-DD format");
    });

    it("should reject date with wrong separators", () => {
      const result = validateReminderDate("2026.01.12");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("YYYY-MM-DD format");
    });

    it("should reject invalid date (February 30th)", () => {
      const result = validateReminderDate("2025-02-30");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date");
    });

    it("should reject invalid date (month 13)", () => {
      const result = validateReminderDate("2025-13-01");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date");
    });

    it("should reject invalid date (day 32)", () => {
      const result = validateReminderDate("2025-01-32");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date");
    });

    it("should reject non-leap year February 29th", () => {
      const result = validateReminderDate("2025-02-29");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date");
    });

    it("should reject date with text", () => {
      const result = validateReminderDate("January 12, 2026");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("YYYY-MM-DD format");
    });

    it("should reject date with extra characters", () => {
      const result = validateReminderDate("2026-01-12 10:30");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("YYYY-MM-DD format");
    });

    it("should accept valid dates at boundaries", () => {
      const validDates = [
        "2025-01-01",
        "2025-12-31",
        "2025-06-30",
        "2025-04-15",
      ];

      validDates.forEach((date) => {
        const result = validateReminderDate(date);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });
});
