import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "../src/waiting-for-view";
import { WorkspaceLeaf, TFile } from "obsidian";
import { WaitingForScanner, WaitingForItem } from "../src/waiting-for-scanner";

jest.mock("../src/waiting-for-scanner");

describe("WaitingForView", () => {
  let view: WaitingForView;
  let mockLeaf: jest.Mocked<WorkspaceLeaf>;
  let mockScanner: jest.Mocked<WaitingForScanner>;

  beforeEach(() => {
    mockLeaf = {
      view: null,
    } as unknown as jest.Mocked<WorkspaceLeaf>;

    const mockApp = {
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
        isCompleted: false,
      },
      {
        file: "Projects/Project A.md",
        fileName: "Project A",
        lineNumber: 7,
        text: "Wait for Sarah",
        isCompleted: false,
      },
      {
        file: "Next actions.md",
        fileName: "Next actions",
        lineNumber: 3,
        text: "Wait for deployment",
        isCompleted: false,
      },
    ];

    const grouped = (view as any).groupItemsByFile(items);

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["Projects/Project A.md"]).toHaveLength(2);
    expect(grouped["Next actions.md"]).toHaveLength(1);
  });
});
