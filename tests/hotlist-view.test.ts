// tests/hotlist-view.test.ts
import { HotlistView, HOTLIST_VIEW_TYPE } from "../src/hotlist-view";
import { HotlistItem } from "../src/types";
import { WorkspaceLeaf } from "obsidian";

jest.mock("obsidian");

describe("HotlistView", () => {
  let view: HotlistView;
  let mockLeaf: any;
  let mockApp: any;
  let mockSettings: any;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockSettings = {
      hotlist: [],
    };
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      workspace: {
        getLeaf: jest.fn(),
      },
      metadataCache: {
        on: jest.fn(),
        offref: jest.fn(),
        getFileCache: jest.fn(),
      },
    };
    mockLeaf = {
      view: null,
    } as any;
    mockSaveSettings = jest.fn();

    view = new HotlistView(mockLeaf, mockSettings, mockSaveSettings);
    (view as any).app = mockApp;
  });

  it("should have correct view type", () => {
    expect(view.getViewType()).toBe(HOTLIST_VIEW_TYPE);
  });

  it("should have correct display text", () => {
    expect(view.getDisplayText()).toBe("Hotlist");
  });

  it("should have correct icon", () => {
    expect(view.getIcon()).toBe("list-checks");
  });

  it("should group items by project and general actions", () => {
    const items: HotlistItem[] = [
      {
        file: "Projects/Project A.md",
        lineNumber: 5,
        lineContent: "- [ ] Project action A",
        text: "Project action A",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Projects/Project A.md",
        lineNumber: 7,
        lineContent: "- [ ] Project action B",
        text: "Project action B",
        sphere: "work",
        isGeneral: false,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 3,
        lineContent: "- [ ] General action #sphere/work",
        text: "General action",
        sphere: "work",
        isGeneral: true,
        addedAt: Date.now(),
      },
      {
        file: "Next actions.md",
        lineNumber: 5,
        lineContent: "- [ ] Personal action #sphere/personal",
        text: "Personal action",
        sphere: "personal",
        isGeneral: true,
        addedAt: Date.now(),
      },
    ];

    const grouped = (view as any).groupItems(items);

    expect(Object.keys(grouped.projectActions)).toHaveLength(1);
    expect(grouped.projectActions["Projects/Project A.md"]).toHaveLength(2);
    expect(Object.keys(grouped.generalActions)).toHaveLength(2);
    expect(grouped.generalActions["work"]).toHaveLength(1);
    expect(grouped.generalActions["personal"]).toHaveLength(1);
  });

  it("should call saveSettings when removing item from hotlist", async () => {
    const item: HotlistItem = {
      file: "Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: 123456,
    };
    mockSettings.hotlist = [item];

    await (view as any).removeFromHotlist(item);

    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockSettings.hotlist).toHaveLength(0);
  });
});
