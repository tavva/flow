import { InboxScanner, InboxItem } from "../src/inbox-scanner";
import { InboxModalState } from "../src/inbox-modal-state";
import { InboxProcessingController } from "../src/inbox-processing-controller";
import { GTDProcessingResult, PluginSettings } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

jest.mock("obsidian");
import { App, TFile, Vault } from "obsidian";

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
    // In production, DeletionOffsetManager handles this adjustment
    const secondItem: InboxItem = {
      type: "line",
      content: "Line four",
      sourceFile: inboxFile,
      lineNumber: 3, // Adjusted from original lineNumber=4
    };

    await scanner.deleteInboxItem(secondItem);
    expect(fileContents[inboxFile.path]).toBe(["Line one", "Line three"].join("\n"));
  });

  it("tracks per-file deletions when saving multiple processed inbox items", async () => {
    const controller = new InboxProcessingController(app as unknown as App, settings);
    const renderCallback = jest.fn();
    const state = new InboxModalState(controller, settings, renderCallback);

    const deleteMock = jest.fn().mockResolvedValue(undefined);

    (state as any).controller.inboxScanner = {
      deleteInboxItem: deleteMock,
    } as Pick<InboxScanner, "deleteInboxItem">;

    (state as any).controller.writer = {};

    const baseResult: GTDProcessingResult = {
      isActionable: true,
      category: "next-action",
      nextAction: "Line content",
      reasoning: "test",
      recommendedAction: "trash",
      recommendedActionReasoning: "test",
    };

    const processedItems = [
      {
        original: "Line two",
        result: baseResult,
        selectedAction: "trash",
        selectedSpheres: [],
        inboxItem: {
          type: "line",
          content: "Line two",
          sourceFile: inboxFile,
          lineNumber: 2,
        },
      },
      {
        original: "Line four",
        result: baseResult,
        selectedAction: "trash",
        selectedSpheres: [],
        inboxItem: {
          type: "line",
          content: "Line four",
          sourceFile: inboxFile,
          lineNumber: 4,
        },
      },
    ] as any;

    // Convert processedItems to editableItems format
    const editableItems = processedItems.map((item: any) => ({
      original: item.original,
      inboxItem: item.inboxItem,
      isAIProcessed: true,
      result: item.result,
      selectedProject: item.selectedProject,
      selectedAction: item.selectedAction,
      selectedSpheres: item.selectedSpheres,
      editedName: item.editedName,
      editedProjectTitle: item.editedProjectTitle,
    }));
    state.editableItems = editableItems;

    await state.saveAllItems();

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ lineNumber: 2 }));
    expect(deleteMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ lineNumber: 3 }));
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
