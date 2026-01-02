// ABOUTME: Tests for production release script version parsing and calculation.
// ABOUTME: Validates version bumping logic for patch, minor, and major releases.

import { parseVersion, calculateNextVersion, ParsedVersion } from "../scripts/release";

describe("parseVersion", () => {
  test("parses production version", () => {
    const result = parseVersion("1.0.2");
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 2,
    });
  });

  test("parses version with larger numbers", () => {
    const result = parseVersion("12.34.56");
    expect(result).toEqual({
      major: 12,
      minor: 34,
      patch: 56,
    });
  });

  test("returns null for invalid version", () => {
    expect(parseVersion("invalid")).toBeNull();
    expect(parseVersion("1.0")).toBeNull();
    expect(parseVersion("1.0.0.0")).toBeNull();
    expect(parseVersion("v1.0.0")).toBeNull();
  });

  test("returns null for beta version", () => {
    expect(parseVersion("1.0.0-beta.1")).toBeNull();
  });
});

describe("calculateNextVersion", () => {
  const current: ParsedVersion = { major: 1, minor: 2, patch: 3 };

  test("calculates patch bump", () => {
    expect(calculateNextVersion(current, "patch")).toBe("1.2.4");
  });

  test("calculates minor bump", () => {
    expect(calculateNextVersion(current, "minor")).toBe("1.3.0");
  });

  test("calculates major bump", () => {
    expect(calculateNextVersion(current, "major")).toBe("2.0.0");
  });

  test("accepts valid custom version", () => {
    expect(calculateNextVersion(current, "5.0.0")).toBe("5.0.0");
  });

  test("throws for invalid custom version", () => {
    expect(() => calculateNextVersion(current, "invalid")).toThrow("Invalid version format");
  });

  test("throws for beta custom version", () => {
    expect(() => calculateNextVersion(current, "1.0.0-beta.1")).toThrow("Invalid version format");
  });

  test("throws for unknown string that is not valid version", () => {
    expect(() => calculateNextVersion(current, "auto")).toThrow("Invalid version format");
  });
});
