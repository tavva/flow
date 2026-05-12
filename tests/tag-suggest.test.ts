// ABOUTME: Tests for tag fragment detection used by inline tag autocomplete.
// ABOUTME: Validates finding and replacing #tag fragments at cursor positions.

import { findTagAtCursor, replaceTagFragment } from "../src/tag-suggest";

describe("findTagAtCursor", () => {
  it("finds a tag fragment at end of text", () => {
    const result = findTagAtCursor("Call dentist #con", 17);
    expect(result).toEqual({ start: 13, end: 17, fragment: "#con" });
  });

  it("finds a tag fragment in middle of text", () => {
    const result = findTagAtCursor("Buy #context/phone milk", 18);
    expect(result).toEqual({ start: 4, end: 18, fragment: "#context/phone" });
  });

  it("finds a bare # with no characters after it", () => {
    const result = findTagAtCursor("Task #", 6);
    expect(result).toEqual({ start: 5, end: 6, fragment: "#" });
  });

  it("returns null when cursor is not in a tag", () => {
    const result = findTagAtCursor("Call dentist", 12);
    expect(result).toBeNull();
  });

  it("returns null for empty text", () => {
    const result = findTagAtCursor("", 0);
    expect(result).toBeNull();
  });

  it("finds the correct tag when multiple tags exist", () => {
    const result = findTagAtCursor("Task #context/phone #con", 24);
    expect(result).toEqual({ start: 20, end: 24, fragment: "#con" });
  });

  it("finds tag when cursor is right after #", () => {
    const result = findTagAtCursor("Task #", 6);
    expect(result).toEqual({ start: 5, end: 6, fragment: "#" });
  });

  it("returns null when # is preceded by non-space (not a tag start)", () => {
    const result = findTagAtCursor("email@#foo", 10);
    expect(result).toBeNull();
  });

  it("finds tag at start of text", () => {
    const result = findTagAtCursor("#context/pho", 12);
    expect(result).toEqual({ start: 0, end: 12, fragment: "#context/pho" });
  });
});

describe("replaceTagFragment", () => {
  it("replaces fragment at end of text", () => {
    const result = replaceTagFragment("Call dentist #con", 13, 17, "#context/phone");
    expect(result).toBe("Call dentist #context/phone");
  });

  it("replaces fragment in middle of text", () => {
    const result = replaceTagFragment("Buy #con milk", 4, 8, "#context/errands");
    expect(result).toBe("Buy #context/errands milk");
  });

  it("replaces bare # with full tag", () => {
    const result = replaceTagFragment("Task #", 5, 6, "#context/phone");
    expect(result).toBe("Task #context/phone");
  });

  it("replaces fragment at start of text", () => {
    const result = replaceTagFragment("#con rest of text", 0, 4, "#context/phone");
    expect(result).toBe("#context/phone rest of text");
  });
});
