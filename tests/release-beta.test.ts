// tests/release-beta.test.ts
import {
  parseVersion,
  calculateNextVersion,
  checkFormatting,
  checkTests,
} from "../scripts/release-beta";
import { execSync } from "child_process";

jest.mock("child_process");

describe("Version Parsing", () => {
  test("should parse production version", () => {
    const result = parseVersion("0.7.0");
    expect(result).toEqual({
      major: 0,
      minor: 7,
      patch: 0,
      betaNumber: undefined,
      isBeta: false,
    });
  });

  test("should parse beta version", () => {
    const result = parseVersion("0.7.1-beta.2");
    expect(result).toEqual({
      major: 0,
      minor: 7,
      patch: 1,
      betaNumber: 2,
      isBeta: true,
    });
  });

  test("should return null for invalid version", () => {
    const result = parseVersion("invalid");
    expect(result).toBeNull();
  });
});

describe("Next Version Calculation", () => {
  test("should auto-increment beta number", () => {
    const current = parseVersion("0.7.1-beta.2");
    const next = calculateNextVersion(current, "auto");
    expect(next).toBe("0.7.1-beta.3");
  });

  test("should create patch beta from production", () => {
    const current = parseVersion("0.7.0");
    const next = calculateNextVersion(current, "patch");
    expect(next).toBe("0.7.1-beta.1");
  });

  test("should create minor beta from production", () => {
    const current = parseVersion("0.7.0");
    const next = calculateNextVersion(current, "minor");
    expect(next).toBe("0.8.0-beta.1");
  });

  test("should handle custom version when current is null", () => {
    const next = calculateNextVersion(null, "1.0.0-beta.1");
    expect(next).toBe("1.0.0-beta.1");
  });

  test("should throw error when auto-incrementing production version", () => {
    const current = parseVersion("0.7.0");
    expect(() => {
      calculateNextVersion(current, "auto");
    }).toThrow("Cannot auto-increment beta number on production version");
  });

  test("should throw error when custom version is invalid and current is null", () => {
    expect(() => {
      calculateNextVersion(null, "invalid-version");
    }).toThrow("Invalid custom version");
  });

  test("should parse version with multi-digit numbers", () => {
    const result = parseVersion("12.34.56-beta.78");
    expect(result).toEqual({
      major: 12,
      minor: 34,
      patch: 56,
      betaNumber: 78,
      isBeta: true,
    });
  });

  test("should auto-increment beta with multi-digit numbers", () => {
    const current = parseVersion("12.34.56-beta.78");
    const next = calculateNextVersion(current, "auto");
    expect(next).toBe("12.34.56-beta.79");
  });
});

describe("Quality Checks", () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output in tests
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("checkFormatting", () => {
    test("should return true when formatting check passes", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      const result = checkFormatting();

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("npm run format:check", {
        stdio: "pipe",
        encoding: "utf-8",
      });
    });

    test("should return false when formatting check fails", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Formatting check failed");
      });

      const result = checkFormatting();

      expect(result).toBe(false);
    });
  });

  describe("checkTests", () => {
    test("should return true when tests pass", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      const result = checkTests();

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("npm test", {
        stdio: "inherit",
        encoding: "utf-8",
      });
    });

    test("should return false when tests fail", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Tests failed");
      });

      const result = checkTests();

      expect(result).toBe(false);
    });
  });
});
