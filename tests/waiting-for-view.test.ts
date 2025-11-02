import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { WorkspaceLeaf, TFile } from "obsidian";
import { WaitingForScanner, WaitingForItem } from "../src/waiting-for-scanner";
import { WaitingForValidator } from "../src/waiting-for-validator";

jest.mock("../src/waiting-for-scanner");

describe("WaitingForView", () => {
  let view: WaitingForView;
  let mockLeaf: jest.Mocked<WorkspaceLeaf>;
  let mockScanner: jest.Mocked<WaitingForScanner>;
  let mockApp: any;

  beforeEach(() => {
    mockLeaf = {
      view: null,
    } as unknown as jest.Mocked<WorkspaceLeaf>;

    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      workspace: {
        getLeaf: jest.fn(),
      },
    };

    view = new WaitingForView(mockLeaf as WorkspaceLeaf);
    (view as any).app = mockApp;

    mockScanner = new WaitingForScanner(mockApp as any) as jest.Mocked<WaitingForScanner>;
    (view as any).scanner = mockScanner;

    // Also replace the validator with one that uses the mock app
    (view as any).validator = new WaitingForValidator(mockApp as any);
  });

  test("should return correct view type", () => {
    expect(view.getViewType()).toBe(WAITING_FOR_VIEW_TYPE);
  });

  test("should return display text", () => {
    expect(view.getDisplayText()).toBe("Waiting For");
  });

  test("should return icon", () => {
    expect(view.getIcon()).toBe("clock");
  });

  test("should group items by file", () => {
    const items: WaitingForItem[] = [
      {
        file: "Projects/Project A.md",
        fileName: "Project A",
        lineNumber: 5,
        text: "Wait for John",
      },
      {
        file: "Projects/Project A.md",
        fileName: "Project A",
        lineNumber: 7,
        text: "Wait for Sarah",
      },
      {
        file: "Next actions.md",
        fileName: "Next actions",
        lineNumber: 3,
        text: "Wait for deployment",
      },
    ];

    const grouped = (view as any).groupItemsByFile(items);

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["Projects/Project A.md"]).toHaveLength(2);
    expect(grouped["Next actions.md"]).toHaveLength(1);
  });

  test("should complete item even when line number is stale", async () => {
    // Simulate a file where a line was added above the waiting-for item
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Projects/Project.md";

    // Original file had the waiting-for item at line 3
    // But a new line was added at the top, so it's now at line 4
    const fileContent = [
      "# New line added at top",
      "",
      "## Next actions",
      "- [w] Wait for review #sphere/work",
      "",
    ].join("\n");

    mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockApp.vault.read.mockResolvedValue(fileContent);

    const item: WaitingForItem = {
      file: "Projects/Project.md",
      fileName: "Project",
      lineNumber: 3, // Stale - it's actually at line 4 now
      lineContent: "- [w] Wait for review #sphere/work", // Full line for validation
      text: "Wait for review",
    };

    await (view as any).toggleItemComplete(item);

    // Verify file was modified with the correct line changed and completion date added
    expect(mockApp.vault.modify).toHaveBeenCalled();
    const modifyCall = mockApp.vault.modify.mock.calls[0];
    expect(modifyCall[0]).toBe(mockFile);

    const modifiedContent = modifyCall[1];
    const modifiedLines = modifiedContent.split("\n");

    // Check the task was marked complete
    expect(modifiedLines[3]).toMatch(
      /^- \[x\] Wait for review #sphere\/work ✅ \d{4}-\d{2}-\d{2}$/
    );
  });

  test("should add completion date when marking item complete", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Test.md";

    const fileContent = "- [w] Test waiting item #sphere/work";

    mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockApp.vault.read.mockResolvedValue(fileContent);

    const item: WaitingForItem = {
      file: "Test.md",
      fileName: "Test",
      lineNumber: 1,
      lineContent: "- [w] Test waiting item #sphere/work",
      text: "Test waiting item",
    };

    await (view as any).toggleItemComplete(item);

    expect(mockApp.vault.modify).toHaveBeenCalled();
    const modifiedContent = mockApp.vault.modify.mock.calls[0][1];

    // Verify completion date format YYYY-MM-DD
    expect(modifiedContent).toMatch(
      /^- \[x\] Test waiting item #sphere\/work ✅ \d{4}-\d{2}-\d{2}$/
    );

    // Verify it's today's date
    const today = new Date().toISOString().split("T")[0];
    expect(modifiedContent).toContain(`✅ ${today}`);
  });
});
