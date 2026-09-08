// ABOUTME: Exercises focus updates against an in-memory vault with real persistence code.
// ABOUTME: Guards against lost concurrent edits and destructive saves after failed reads.

import { App, TFile, Vault } from "obsidian";
import { FocusItem } from "../src/types";
import * as persistence from "../src/focus-persistence";

import { moveFocusFile } from "../src/focus-file-move";

jest.mock("obsidian");

const item = (text: string): FocusItem => ({
  file: "Actions.md",
  lineNumber: 1,
  lineContent: `- [ ] ${text}`,
  text,
  sphere: "work",
  isGeneral: true,
  addedAt: 1,
  contexts: [],
});
const update = persistence.updateFocusItems;

function createVault(cached = false) {
  let content = JSON.stringify(item("Existing"));
  const file = new TFile("Focus.md");
  const write = jest.fn(async (_file: unknown, value: string) => {
    content = value;
  });
  const read = jest.fn(async () => content);
  const exists = jest.fn(async () => true);
  const vault = {
    getAbstractFileByPath: jest.fn(() => (cached ? file : null)),
    read,
    modify: write,
    create: write,
    adapter: { exists, read, write },
  } as unknown as Vault;
  return {
    vault,
    read,
    write,
    exists,
    items: () =>
      content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as FocusItem),
  };
}

describe("focus transactions", () => {
  it("preserves both overlapping additions", async () => {
    const { vault, items } = createVault();
    await Promise.all(
      ["A", "B"].map((text) => update(vault, (current) => [...current, item(text)], "Focus.md"))
    );
    expect(items().map((entry) => entry.text)).toEqual(["Existing", "A", "B"]);
  });

  it("waits through an asynchronous update before moving, then redirects queued updates", async () => {
    let content = JSON.stringify(item("Existing"));
    const file = new TFile("A.md");
    const vault = {
      getAbstractFileByPath: jest.fn((path: string) => (path === file.path ? file : null)),
      read: jest.fn(async () => content),
      modify: jest.fn(async (_file: TFile, value: string) => {
        content = value;
      }),
      adapter: { stat: jest.fn(async () => null) },
    } as unknown as Vault;
    const renameFile = jest.fn(async (_file: TFile, path: string) => {
      file.path = path;
    });
    const app = { vault, fileManager: { renameFile } } as unknown as App;
    let resume!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const first = update(
      vault,
      async (items) => {
        started();
        await paused;
        return [...items, item("A")];
      },
      "A.md"
    );
    await entered;
    const move = moveFocusFile(
      app,
      "A.md",
      "B.md",
      async () => true,
      async () => {}
    );
    const second = update(vault, (items) => [...items, item("B")], "A.md");
    await new Promise(setImmediate);
    expect(renameFile).not.toHaveBeenCalled();
    expect(vault.modify).not.toHaveBeenCalled();
    resume();
    await Promise.all([first, move, second]);
    expect(file.path).toBe("B.md");
    expect(content.split("\n").map((line) => JSON.parse(line).text)).toEqual([
      "Existing",
      "A",
      "B",
    ]);
  });

  it("does not write a partially mutated list when its callback fails", async () => {
    const { vault, write, items } = createVault();
    await expect(
      update(
        vault,
        (current) => {
          current.push(item("Aborted"));
          throw new Error("Update failed");
        },
        "Focus.md"
      )
    ).rejects.toThrow("Update failed");
    expect(write).not.toHaveBeenCalled();
    expect(items().map((entry) => entry.text)).toEqual(["Existing"]);
    await update(vault, (current) => [...current, item("Retry")], "Focus.md");
    expect(items().map((entry) => entry.text)).toEqual(["Existing", "Retry"]);
  });

  it("creates a list after confirmed absence", async () => {
    const { vault, exists, write } = createVault();
    exists.mockResolvedValue(false);
    await update(vault, (current) => [...current, item("First")], "Focus.md");
    expect(vault.create).toHaveBeenCalledWith("Focus.md", JSON.stringify(item("First")));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "does not mutate or save after a failed read (cached: %s)",
    async (cached) => {
      const { vault, read, write, items } = createVault(cached);
      read.mockRejectedValueOnce(new Error("Read failed"));
      const change = jest.fn((current: FocusItem[]) => [...current, item("New")]);
      await expect(update(vault, change, "Focus.md")).rejects.toThrow("Read failed");
      expect(change).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(items().map((entry) => entry.text)).toEqual(["Existing"]);
      await update(vault, (current) => [...current, item("Retry")], "Focus.md");
      expect(items().map((entry) => entry.text)).toEqual(["Existing", "Retry"]);
    }
  );

  it("propagates an existence-check failure without writing", async () => {
    const { vault, exists, write } = createVault();
    exists.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(update(vault, () => [], "Focus.md")).rejects.toThrow("Unavailable");
    expect(write).not.toHaveBeenCalled();
  });
});
