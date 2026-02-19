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

describe("extractContexts with custom prefix", () => {
  it("extracts tags with a custom prefix", () => {
    expect(extractContexts("Call dentist #at/phone", "at")).toEqual(["phone"]);
  });

  it("extracts multiple tags with a custom prefix", () => {
    expect(extractContexts("Task #ctx/home #ctx/errand", "ctx")).toEqual(["home", "errand"]);
  });

  it("ignores default context tags when using custom prefix", () => {
    expect(extractContexts("Task #context/phone #at/home", "at")).toEqual(["home"]);
  });

  it("is case-insensitive with custom prefix", () => {
    expect(extractContexts("Task #At/Phone", "at")).toEqual(["phone"]);
  });
});
