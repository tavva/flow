// ABOUTME: Regression tests for settings path suggesters.
// ABOUTME: Verifies selected suggestions notify Obsidian text components.

import { App, TFile, TFolder } from "obsidian";
import { FilePathSuggest, FolderPathSuggest } from "../src/suggesters";

describe("settings path suggesters", () => {
  function createInput() {
    return document.createElement("input") as HTMLInputElement & {
      trigger?: jest.Mock<void, [string]>;
    };
  }

  function createKeyboardEvent(): KeyboardEvent {
    return new window.KeyboardEvent("keydown");
  }

  it("notifies text component listeners when selecting a folder suggestion", () => {
    const input = createInput();
    input.trigger = jest.fn();
    const suggest = new FolderPathSuggest(new App(), input);

    suggest.selectSuggestion(new TFolder("GTD/Inbox", "Inbox"), createKeyboardEvent());

    expect(input.value).toBe("GTD/Inbox");
    expect(input.trigger).toHaveBeenCalledWith("input");
    expect(input.trigger).toHaveBeenCalledWith("change");
  });

  it("notifies standard DOM listeners when Obsidian trigger is unavailable", () => {
    const input = createInput();
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    const file = Object.assign(new TFile("GTD/Next actions.md", "Next actions"), {
      extension: "md",
    });
    const suggest = new FilePathSuggest(new App(), input, ["md"]);

    suggest.selectSuggestion(file, createKeyboardEvent());

    expect(input.value).toBe("GTD/Next actions.md");
    expect(events).toEqual(["input", "change"]);
  });
});
