import { DeletionOffsetManager } from "../src/deletion-offset-manager";
import { InboxItem } from "../src/inbox-scanner";
import { TFile } from "obsidian";

describe("DeletionOffsetManager", () => {
  const createLineItem = (lineNumber: number, path: string, offsets?: Map<string, number>): InboxItem => {
    const item: InboxItem = {
      type: "line",
      content: "Example",
      sourceFile: { path } as unknown as TFile,
      lineNumber,
    };
    if (offsets) {
      offsets.set(path, 0);
    }
    return item;
  };

  it("adjusts the line number based on prior deletions", () => {
    const offsets = new Map<string, number>([["inbox/file.md", 2]]);
    const manager = new DeletionOffsetManager(offsets);
    const item = createLineItem(5, "inbox/file.md");

    const adjusted = manager.prepareForDeletion(item);

    expect(adjusted.lineNumber).toBe(3);
    expect(adjusted).not.toBe(item);
  });

  it("never reduces the adjusted line number below 1", () => {
    const offsets = new Map<string, number>([["notes/file.md", 10]]);
    const manager = new DeletionOffsetManager(offsets);
    const item = createLineItem(3, "notes/file.md");

    const adjusted = manager.prepareForDeletion(item);

    expect(adjusted.lineNumber).toBe(1);
  });

  it("records deletions for line items", () => {
    const offsets = new Map<string, number>();
    const manager = new DeletionOffsetManager(offsets);
    const item = createLineItem(4, "workspace/inbox.md");

    manager.recordDeletion(item);
    manager.recordDeletion(item);

    expect(offsets.get("workspace/inbox.md")).toBe(2);
  });

  it("ignores note deletions", () => {
    const offsets = new Map<string, number>();
    const manager = new DeletionOffsetManager(offsets);
    const noteItem: InboxItem = {
      type: "note",
      content: "Note",
      sourceFile: { path: "notes/doc.md" } as unknown as TFile,
    };

    manager.recordDeletion(noteItem);

    expect(offsets.size).toBe(0);
    expect(manager.prepareForDeletion(noteItem)).toBe(noteItem);
  });
});
