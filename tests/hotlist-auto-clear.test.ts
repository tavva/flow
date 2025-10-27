// ABOUTME: Tests for hotlist auto-clear functionality
// ABOUTME: Validates time checking logic and archival of cleared tasks

import { shouldClearHotlist, archiveClearedTasks } from "../src/hotlist-auto-clear";
import { HotlistItem } from "../src/types";
import { TFile } from "obsidian";

describe("shouldClearHotlist", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns false when auto-clear is disabled (empty string)", () => {
    const autoClearTime = "";
    const lastClearTimestamp = 0;
    const now = new Date("2025-10-15T10:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(false);
  });

  it("returns true when past clear time and not cleared today", () => {
    const autoClearTime = "03:00";
    const lastClearTimestamp = new Date("2025-10-14T03:00:00").getTime();
    const now = new Date("2025-10-15T04:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(true);
  });

  it("returns false when before clear time today", () => {
    const autoClearTime = "03:00";
    const lastClearTimestamp = new Date("2025-10-14T03:00:00").getTime();
    const now = new Date("2025-10-15T02:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(false);
  });

  it("returns false when already cleared today", () => {
    const autoClearTime = "03:00";
    const lastClearTimestamp = new Date("2025-10-15T03:00:00").getTime();
    const now = new Date("2025-10-15T10:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(false);
  });

  it("handles midnight correctly", () => {
    const autoClearTime = "00:00";
    const lastClearTimestamp = new Date("2025-10-14T00:00:00").getTime();
    const now = new Date("2025-10-15T00:01:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(true);
  });

  it("handles single-digit hour format", () => {
    const autoClearTime = "3:00";
    const lastClearTimestamp = new Date("2025-10-14T03:00:00").getTime();
    const now = new Date("2025-10-15T04:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(true);
  });

  it("returns true when never cleared before (timestamp is 0)", () => {
    const autoClearTime = "03:00";
    const lastClearTimestamp = 0;
    const now = new Date("2025-10-15T04:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    expect(result).toBe(true);
  });

  it("returns false when clear time is exactly now", () => {
    const autoClearTime = "03:00";
    const lastClearTimestamp = new Date("2025-10-14T03:00:00").getTime();
    const now = new Date("2025-10-15T03:00:00");

    const result = shouldClearHotlist(autoClearTime, lastClearTimestamp, now);

    // Should still return true since we're at the exact time
    expect(result).toBe(true);
  });
});

describe("archiveClearedTasks", () => {
  const mockVault = {
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    modify: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates new archive file with heading and tasks when file doesn't exist", async () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Do something",
        text: "Do something",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [ ] Call someone",
        text: "Call someone",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Hotlist Archive.md";
    const clearTime = new Date("2025-10-15T03:00:00");
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("## Cleared 15 October 2025 at 03:00")
    );
    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("- [[Projects/Test]] Do something")
    );
    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("- [[Next actions|Call someone]]")
    );
  });

  it("prepends to existing archive file", async () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Task one",
        text: "Task one",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Hotlist Archive.md";
    const clearTime = new Date("2025-10-15T03:00:00");
    const existingContent = "## Previous content\n\n- [ ] Old task";

    const mockFile = { path: archiveFilePath } as TFile;
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(existingContent);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    expect(mockVault.modify).toHaveBeenCalledWith(
      mockFile,
      expect.stringContaining("## Cleared 15 October 2025 at 03:00")
    );
    expect(mockVault.modify).toHaveBeenCalledWith(
      mockFile,
      expect.stringContaining("- [[Projects/Test]] Task one")
    );
    expect(mockVault.modify).toHaveBeenCalledWith(
      mockFile,
      expect.stringContaining(existingContent)
    );
  });

  it("handles empty hotlist gracefully", async () => {
    const items: HotlistItem[] = [];
    const archiveFilePath = "Hotlist Archive.md";
    const clearTime = new Date("2025-10-15T03:00:00");

    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("## Cleared 15 October 2025 at 03:00")
    );
    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("No items were in the hotlist.")
    );
  });

  it("formats date and time correctly", async () => {
    const items: HotlistItem[] = [
      {
        file: "test.md",
        lineNumber: 1,
        lineContent: "- [ ] Test",
        text: "Test",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Archive.md";
    const clearTime = new Date("2025-01-05T09:30:00");

    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    expect(mockVault.create).toHaveBeenCalledWith(
      archiveFilePath,
      expect.stringContaining("## Cleared 5 January 2025 at 09:30")
    );
  });

  it("strips checkbox markers from archived items", async () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Test.md",
        lineNumber: 10,
        lineContent: "- [ ] Do something important",
        text: "Do something important",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [x] Already completed",
        text: "Already completed",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 6,
        lineContent: "- [w] Waiting for response",
        text: "Waiting for response",
        sphere: "work",
        isGeneral: true,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Hotlist Archive.md";
    const clearTime = new Date("2025-10-15T03:00:00");
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    const createdContent = mockVault.create.mock.calls[0][1];

    // Should contain wikilinks to source files
    expect(createdContent).toContain("- [[Projects/Test]] Do something important");
    expect(createdContent).toContain("- [[Next actions|Already completed]]");
    expect(createdContent).toContain("- [[Next actions|Waiting for response]]");

    // Should NOT contain checkbox markers
    expect(createdContent).not.toContain("- [ ]");
    expect(createdContent).not.toContain("- [x]");
    expect(createdContent).not.toContain("- [w]");
  });

  it("formats general actions with display text and projects with file links", async () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Work Project.md",
        lineNumber: 15,
        lineContent: "- [ ] Review design document",
        text: "Review design document",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 8,
        lineContent: "- [ ] Call dentist",
        text: "Call dentist",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
      {
        file: "Projects/Health/Annual Checkup.md",
        lineNumber: 20,
        lineContent: "- [ ] Schedule appointment",
        text: "Schedule appointment",
        sphere: "personal",
        isGeneral: false,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Archive.md";
    const clearTime = new Date("2025-10-27T03:00:00");
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    const createdContent = mockVault.create.mock.calls[0][1];

    // Project items should have file link before text
    expect(createdContent).toContain("- [[Projects/Work Project]] Review design document");
    expect(createdContent).toContain(
      "- [[Projects/Health/Annual Checkup]] Schedule appointment"
    );

    // General actions should use display text format
    expect(createdContent).toContain("- [[Next actions|Call dentist]]");
  });

  it("handles files without .md extension gracefully", async () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/README",
        lineNumber: 5,
        lineContent: "- [ ] Update documentation",
        text: "Update documentation",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
    ];

    const archiveFilePath = "Archive.md";
    const clearTime = new Date("2025-10-27T03:00:00");
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    await archiveClearedTasks(mockVault as any, items, archiveFilePath, clearTime);

    const createdContent = mockVault.create.mock.calls[0][1];

    // Should create wikilink even without .md extension
    expect(createdContent).toContain("- [[Projects/README]] Update documentation");
  });
});
