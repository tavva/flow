// ABOUTME: Tests for deleting processed inbox items from their source files.
// ABOUTME: Covers line matching across a processing session and note archiving.
import { InboxScanner, InboxItem } from "../src/inbox-scanner";
import { InboxModalState } from "../src/inbox-modal-state";
import { InboxProcessingController } from "../src/inbox-processing-controller";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";
import { EditableItem } from "../src/inbox-types";
import { generateDeterministicFakeApiKey } from "./test-utils";

jest.mock("obsidian");
import { App, Notice, TFile, TFolder, Vault } from "obsidian";

describe("Inbox deletion handling", () => {
  let app: App;
  let vault: Vault;
  let settings: PluginSettings;
  let scanner: InboxScanner;
  let inboxFile: TFile;
  let fileContents: Record<string, string>;

  const baseSettings: PluginSettings = {
    aiEnabled: false,
    openrouterApiKey: "",
    openrouterBaseUrl: "https://openrouter.ai/api/v1",
    openrouterImageModel: "google/gemini-2.5-flash-image",
    defaultPriority: 2,
    defaultStatus: "live",
    inboxFilesFolderPath: "Flow Inbox Files",
    inboxFolderPath: "Flow Inbox Folder",
    nextActionsFilePath: "Next actions.md",
    somedayFilePath: "Someday.md",
    projectsFolderPath: "Projects",
    spheres: ["personal", "work"],
  };

  beforeAll(() => {
    const createMockElement = () => {
      const element: any = {
        addClass: jest.fn(),
        appendChild: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          toggle: jest.fn(),
        },
        createDiv: jest.fn(() => createMockElement()),
        createEl: jest.fn(() => createMockElement()),
        empty: jest.fn(),
        setAttr: jest.fn(),
        setText: jest.fn(),
        style: {},
      };

      return element;
    };

    (global as any).document = {
      createElement: jest.fn(() => createMockElement()),
    };
  });

  beforeEach(() => {
    app = new App();
    vault = app.vault as unknown as Vault;
    settings = { ...baseSettings };
    scanner = new InboxScanner(app as unknown as App, settings);

    inboxFile = new TFile("Flow Inbox Files/inbox.md", "inbox");
    fileContents = {
      [inboxFile.path]: ["Line one", "Line two", "Line three", "Line four"].join("\n"),
    };

    (vault.read as jest.Mock).mockImplementation((file: TFile) => {
      return Promise.resolve(fileContents[file.path] ?? "");
    });

    (vault.modify as jest.Mock).mockImplementation((file: TFile, newContent: string) => {
      fileContents[file.path] = newContent;
      return Promise.resolve();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("removes multiple lines from the same file when line numbers are adjusted", async () => {
    const firstItem: InboxItem = {
      type: "line",
      content: "Line two",
      sourceFile: inboxFile,
      lineNumber: 2,
    };

    await scanner.deleteInboxItem(firstItem);
    expect(fileContents[inboxFile.path]).toBe(["Line one", "Line three", "Line four"].join("\n"));

    // After first deletion, "Line four" is now on line 3 (not line 4)
    const secondItem: InboxItem = {
      type: "line",
      content: "Line four",
      sourceFile: inboxFile,
      lineNumber: 3, // Adjusted from original lineNumber=4
    };

    await scanner.deleteInboxItem(secondItem);
    expect(fileContents[inboxFile.path]).toBe(["Line one", "Line three"].join("\n"));
  });

  it("deletes the correct line when file has empty lines", async () => {
    // Reproduces the bug: file with empty line at start
    const fileWithEmptyLines = new TFile("Flow Inbox Files/with-empty.md", "with-empty");
    fileContents[fileWithEmptyLines.path] = [
      "", // Line 1 (index 0): empty
      "Think about how Lisa can share learnings", // Line 2 (index 1): first non-empty
      "Flow: discarding inbox items bug", // Line 3 (index 2): second non-empty
      "Flow: Refine all button feedback", // Line 4 (index 3): third non-empty
    ].join("\n");

    // First item should be on line 2 (as assigned by getLineItems)
    const firstItem: InboxItem = {
      type: "line",
      content: "Think about how Lisa can share learnings",
      sourceFile: fileWithEmptyLines,
      lineNumber: 2, // This is line 2 of the file (index 1 + 1)
    };

    await scanner.deleteInboxItem(firstItem);

    // Should delete "Think about..." and leave the empty line plus the other two items
    const expectedContent = [
      "", // Empty line remains
      "Flow: discarding inbox items bug",
      "Flow: Refine all button feedback",
    ].join("\n");

    expect(fileContents[fileWithEmptyLines.path]).toBe(expectedContent);
  });
});

describe("Inbox line deletion during a processing session", () => {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    inboxFilesFolderPath: "Flow Inbox Files",
    inboxFolderPath: "Flow Inbox Folder",
    spheres: ["personal"],
  };

  let app: App;
  let inboxFile: TFile;
  let fileContents: Record<string, string>;
  let persist: jest.Mock;
  let state: InboxModalState;

  const startSession = async (lines: string[]) => {
    fileContents[inboxFile.path] = lines.join("\n");
    await state.loadInboxItems();
  };

  const itemFor = (content: string): EditableItem => {
    const item = state.editableItems.find((candidate) => candidate.original === content);
    if (!item) throw new Error(`No editable item for "${content}"`);
    return item;
  };

  beforeEach(() => {
    app = new App();
    const vault = app.vault as unknown as Vault;
    inboxFile = new TFile("Flow Inbox Files/inbox.md", "inbox");
    fileContents = {};

    (vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) =>
      path === settings.inboxFilesFolderPath ? new TFolder(path, "Flow Inbox Files") : null
    );
    (vault.getMarkdownFiles as jest.Mock).mockReturnValue([inboxFile]);
    (vault.read as jest.Mock).mockImplementation((file: TFile) =>
      Promise.resolve(fileContents[file.path] ?? "")
    );
    (vault.modify as jest.Mock).mockImplementation((file: TFile, newContent: string) => {
      fileContents[file.path] = newContent;
      return Promise.resolve();
    });

    persist = jest.fn().mockResolvedValue(undefined);
    const controller = new InboxProcessingController(app, settings, {
      scanner: { scanProjects: jest.fn().mockResolvedValue([]) } as any,
      personScanner: { scanPersons: jest.fn().mockResolvedValue([]) } as any,
      writer: {} as any,
      persistenceService: { persist } as any,
    });
    state = new InboxModalState(app, controller, settings, jest.fn());
  });

  it("deletes the processed lines when items are processed bottom-up", async () => {
    await startSession(["A", "B", "C", "D"]);

    await state.saveAndRemoveItem(itemFor("C"));
    await state.saveAndRemoveItem(itemFor("B"));

    expect(fileContents[inboxFile.path]).toBe(["A", "D"].join("\n"));
  });

  it("deletes the right lines when saving all after saving some individually", async () => {
    await startSession(["A", "B", "C", "D"]);

    await state.saveAndRemoveItem(itemFor("C"));
    await state.saveAllItems();

    expect(fileContents[inboxFile.path]).toBe("");
    expect(persist).toHaveBeenCalledTimes(4);
  });

  it("deletes the processed line when a line was added above it after scanning", async () => {
    await startSession(["A", "B", "C"]);
    fileContents[inboxFile.path] = ["Captured elsewhere", "A", "B", "C"].join("\n");

    await state.saveAndRemoveItem(itemFor("B"));

    expect(fileContents[inboxFile.path]).toBe(["Captured elsewhere", "A", "C"].join("\n"));
  });

  it("deletes the processed line when a line above it was removed after scanning", async () => {
    await startSession(["A", "B", "C"]);
    fileContents[inboxFile.path] = ["B", "C"].join("\n");

    await state.saveAndRemoveItem(itemFor("B"));

    expect(fileContents[inboxFile.path]).toBe("C");
  });

  it("matches lines that carry surrounding whitespace in the file", async () => {
    await startSession(["A", "  B  ", "C"]);

    await state.saveAndRemoveItem(itemFor("B"));

    expect(fileContents[inboxFile.path]).toBe(["A", "C"].join("\n"));
  });

  it("deletes the duplicate nearest the recorded line", async () => {
    await startSession(["Same", "Other", "Same"]);
    const secondCopy = state.editableItems[2];

    await state.saveAndRemoveItem(secondCopy);

    expect(fileContents[inboxFile.path]).toBe(["Same", "Other"].join("\n"));
  });

  it("leaves the file alone and keeps the item when its line has gone", async () => {
    await startSession(["A", "B", "C"]);
    fileContents[inboxFile.path] = ["A", "C"].join("\n");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const item = itemFor("B");

    await state.saveAndRemoveItem(item);

    expect(fileContents[inboxFile.path]).toBe(["A", "C"].join("\n"));
    expect(persist).not.toHaveBeenCalled();
    expect(state.editableItems).toContain(item);
    expect(Notice.mockConstructor).toHaveBeenCalledWith(
      expect.stringContaining('Could not find "B" in Flow Inbox Files/inbox.md')
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("does not discard anything when the line to discard has gone", async () => {
    await startSession(["A", "B", "C"]);
    fileContents[inboxFile.path] = ["A", "C"].join("\n");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const item = itemFor("B");

    await state.discardItem(item);

    expect(fileContents[inboxFile.path]).toBe(["A", "C"].join("\n"));
    expect(state.editableItems).toContain(item);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
