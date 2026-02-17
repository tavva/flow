// ABOUTME: Tests for context tag extraction from action line text.
// ABOUTME: Validates parsing of #context/X tags from various line formats.

import { extractContexts } from "../src/context-tags";

describe("extractContexts", () => {
  it("extracts a single context tag", () => {
    expect(extractContexts("Call dentist #context/phone")).toEqual(["phone"]);
  });

  it("extracts multiple context tags", () => {
    expect(extractContexts("Check email #context/computer #context/office")).toEqual([
      "computer",
      "office",
    ]);
  });

  it("returns empty array when no context tags", () => {
    expect(extractContexts("Buy milk and eggs")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(extractContexts("Task #Context/Phone")).toEqual(["phone"]);
  });

  it("ignores sphere tags", () => {
    expect(extractContexts("Task #sphere/work #context/phone")).toEqual(["phone"]);
  });

  it("handles context tag at start of text", () => {
    expect(extractContexts("#context/home clean kitchen")).toEqual(["home"]);
  });

  it("handles hyphenated context names", () => {
    expect(extractContexts("Task #context/at-computer")).toEqual(["at-computer"]);
  });

  it("deduplicates repeated contexts", () => {
    expect(extractContexts("Task #context/phone #context/phone")).toEqual(["phone"]);
  });
});
