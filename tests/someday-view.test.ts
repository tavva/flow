// ABOUTME: Tests for SomedayView component including move-to-next-actions functionality.
// ABOUTME: Verifies items can be moved from Someday file to Next Actions with sphere tags.

import { SomedayView, SOMEDAY_VIEW_TYPE } from "../src/someday-view";
import { WorkspaceLeaf, TFile } from "obsidian";
import { SomedayScanner, SomedayItem } from "../src/someday-scanner";
import { PluginSettings, DEFAULT_SETTINGS } from "../src/types";

jest.mock("../src/someday-scanner");

describe("SomedayView", () => {
  let view: SomedayView;
  let mockLeaf: jest.Mocked<WorkspaceLeaf>;
  let mockScanner: jest.Mocked<SomedayScanner>;
  let mockApp: any;
  let mockSettings: PluginSettings;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockLeaf = {
      view: null,
    } as unknown as jest.Mocked<WorkspaceLeaf>;

    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
        create: jest.fn(),
      },
      workspace: {
        getLeaf: jest.fn(),
      },
      metadataCache: {
        on: jest.fn(),
        offref: jest.fn(),
      },
    };

    mockSettings = {
      ...DEFAULT_SETTINGS,
      spheres: ["personal", "work"],
      somedayFilePath: "Someday.md",
      nextActionsFilePath: "Next actions.md",
    };

    mockSaveSettings = jest.fn();

    view = new SomedayView(mockLeaf as WorkspaceLeaf, mockSettings, mockSaveSettings);
    (view as any).app = mockApp;

    mockScanner = new SomedayScanner(mockApp as any, mockSettings) as jest.Mocked<SomedayScanner>;
    (view as any).scanner = mockScanner;
  });

  test("should return correct view type", () => {
    expect(view.getViewType()).toBe(SOMEDAY_VIEW_TYPE);
  });

  test("should return display text", () => {
    expect(view.getDisplayText()).toBe("Someday");
  });

  test("should return icon", () => {
    expect(view.getIcon()).toBe("calendar-clock");
  });

  describe("moveToNextActions", () => {
    test("should add item to next actions file with sphere tag", async () => {
      const somedayFile = Object.create(TFile.prototype);
      somedayFile.path = "Someday.md";

      const nextActionsFile = Object.create(TFile.prototype);
      nextActionsFile.path = "Next actions.md";

      const somedayContent = [
        "# Someday",
        "",
        "- [ ] Learn Spanish #sphere/personal",
        "- [ ] Build a treehouse #sphere/personal",
      ].join("\n");

      const nextActionsContent = ["# Next Actions", "", "- [ ] Existing action #sphere/work"].join(
        "\n"
      );

      mockApp.vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Someday.md") return somedayFile;
        if (path === "Next actions.md") return nextActionsFile;
        return null;
      });

      mockApp.vault.read.mockImplementation((file: TFile) => {
        if (file.path === "Someday.md") return Promise.resolve(somedayContent);
        if (file.path === "Next actions.md") return Promise.resolve(nextActionsContent);
        return Promise.resolve("");
      });

      const item: SomedayItem = {
        file: "Someday.md",
        fileName: "Someday",
        lineNumber: 3,
        lineContent: "- [ ] Learn Spanish #sphere/personal",
        text: "Learn Spanish",
        sphere: "personal",
      };

      await (view as any).moveToNextActions(item);

      // Verify someday file was modified to remove the line
      const somedayModifyCall = mockApp.vault.modify.mock.calls.find(
        (call: any[]) => call[0].path === "Someday.md"
      );
      expect(somedayModifyCall).toBeDefined();
      const modifiedSomedayContent = somedayModifyCall[1];
      expect(modifiedSomedayContent).not.toContain("Learn Spanish");
      expect(modifiedSomedayContent).toContain("Build a treehouse");

      // Verify next actions file was modified to add the item
      const nextActionsModifyCall = mockApp.vault.modify.mock.calls.find(
        (call: any[]) => call[0].path === "Next actions.md"
      );
      expect(nextActionsModifyCall).toBeDefined();
      const modifiedNextActionsContent = nextActionsModifyCall[1];
      expect(modifiedNextActionsContent).toContain("- [ ] Learn Spanish #sphere/personal");
    });

    test("should add sphere tag if item has no sphere", async () => {
      const somedayFile = Object.create(TFile.prototype);
      somedayFile.path = "Someday.md";

      const nextActionsFile = Object.create(TFile.prototype);
      nextActionsFile.path = "Next actions.md";

      const somedayContent = "- [ ] Learn to juggle";
      const nextActionsContent = "";

      mockApp.vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Someday.md") return somedayFile;
        if (path === "Next actions.md") return nextActionsFile;
        return null;
      });

      mockApp.vault.read.mockImplementation((file: TFile) => {
        if (file.path === "Someday.md") return Promise.resolve(somedayContent);
        if (file.path === "Next actions.md") return Promise.resolve(nextActionsContent);
        return Promise.resolve("");
      });

      // Set up a default sphere selection for items without sphere
      (view as any).selectedSpheres = ["personal"];

      const item: SomedayItem = {
        file: "Someday.md",
        fileName: "Someday",
        lineNumber: 1,
        lineContent: "- [ ] Learn to juggle",
        text: "Learn to juggle",
        sphere: undefined,
      };

      await (view as any).moveToNextActions(item);

      // Verify next actions file contains the item with sphere tag
      const nextActionsModifyCall = mockApp.vault.modify.mock.calls.find(
        (call: any[]) => call[0].path === "Next actions.md"
      );
      expect(nextActionsModifyCall).toBeDefined();
      const modifiedContent = nextActionsModifyCall[1];
      expect(modifiedContent).toContain("- [ ] Learn to juggle #sphere/personal");
    });

    test("should preserve due date when moving item", async () => {
      const somedayFile = Object.create(TFile.prototype);
      somedayFile.path = "Someday.md";

      const nextActionsFile = Object.create(TFile.prototype);
      nextActionsFile.path = "Next actions.md";

      const somedayContent = "- [ ] Learn Spanish 📅 2026-01-15 #sphere/personal";
      const nextActionsContent = "";

      mockApp.vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Someday.md") return somedayFile;
        if (path === "Next actions.md") return nextActionsFile;
        return null;
      });

      mockApp.vault.read.mockImplementation((file: TFile) => {
        if (file.path === "Someday.md") return Promise.resolve(somedayContent);
        if (file.path === "Next actions.md") return Promise.resolve(nextActionsContent);
        return Promise.resolve("");
      });

      const item: SomedayItem = {
        file: "Someday.md",
        fileName: "Someday",
        lineNumber: 1,
        lineContent: "- [ ] Learn Spanish 📅 2026-01-15 #sphere/personal",
        text: "Learn Spanish 📅 2026-01-15",
        sphere: "personal",
      };

      await (view as any).moveToNextActions(item);

      // Verify due date is preserved
      const nextActionsModifyCall = mockApp.vault.modify.mock.calls.find(
        (call: any[]) => call[0].path === "Next actions.md"
      );
      expect(nextActionsModifyCall).toBeDefined();
      const modifiedContent = nextActionsModifyCall[1];
      expect(modifiedContent).toContain("📅 2026-01-15");
    });

    test("should handle waiting-for items correctly", async () => {
      const somedayFile = Object.create(TFile.prototype);
      somedayFile.path = "Someday.md";

      const nextActionsFile = Object.create(TFile.prototype);
      nextActionsFile.path = "Next actions.md";

      const somedayContent = "- [w] Wait for response from John #sphere/work";
      const nextActionsContent = "";

      mockApp.vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Someday.md") return somedayFile;
        if (path === "Next actions.md") return nextActionsFile;
        return null;
      });

      mockApp.vault.read.mockImplementation((file: TFile) => {
        if (file.path === "Someday.md") return Promise.resolve(somedayContent);
        if (file.path === "Next actions.md") return Promise.resolve(nextActionsContent);
        return Promise.resolve("");
      });

      const item: SomedayItem = {
        file: "Someday.md",
        fileName: "Someday",
        lineNumber: 1,
        lineContent: "- [w] Wait for response from John #sphere/work",
        text: "Wait for response from John",
        sphere: "work",
      };

      await (view as any).moveToNextActions(item);

      // Verify waiting-for status is preserved
      const nextActionsModifyCall = mockApp.vault.modify.mock.calls.find(
        (call: any[]) => call[0].path === "Next actions.md"
      );
      expect(nextActionsModifyCall).toBeDefined();
      const modifiedContent = nextActionsModifyCall[1];
      expect(modifiedContent).toContain("- [w] Wait for response from John");
      expect(modifiedContent).toContain("#sphere/work");
    });

    test("should not move item if file not found", async () => {
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const item: SomedayItem = {
        file: "Someday.md",
        fileName: "Someday",
        lineNumber: 1,
        lineContent: "- [ ] Learn Spanish",
        text: "Learn Spanish",
        sphere: "personal",
      };

      await (view as any).moveToNextActions(item);

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });
  });

  describe("sphere filtering", () => {
    test("should show all items when all spheres are selected", () => {
      const items: SomedayItem[] = [
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 1,
          lineContent: "- [ ] Work item",
          text: "Work item",
          sphere: "work",
        },
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 2,
          lineContent: "- [ ] Personal item",
          text: "Personal item",
          sphere: "personal",
        },
      ];

      (view as any).selectedSpheres = ["personal", "work"];
      const filtered = (view as any).filterItemsBySphere(items);

      expect(filtered).toHaveLength(2);
    });

    test("should filter items by selected sphere", () => {
      const items: SomedayItem[] = [
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 1,
          lineContent: "- [ ] Work item",
          text: "Work item",
          sphere: "work",
        },
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 2,
          lineContent: "- [ ] Personal item",
          text: "Personal item",
          sphere: "personal",
        },
      ];

      (view as any).selectedSpheres = ["work"];
      const filtered = (view as any).filterItemsBySphere(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sphere).toBe("work");
    });
  });

  describe("groupItemsByFile", () => {
    test("should group items by their source file", () => {
      const items: SomedayItem[] = [
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 1,
          lineContent: "- [ ] Item 1",
          text: "Item 1",
        },
        {
          file: "Someday.md",
          fileName: "Someday",
          lineNumber: 2,
          lineContent: "- [ ] Item 2",
          text: "Item 2",
        },
        {
          file: "Other.md",
          fileName: "Other",
          lineNumber: 1,
          lineContent: "- [ ] Item 3",
          text: "Item 3",
        },
      ];

      const grouped = (view as any).groupItemsByFile(items);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped["Someday.md"]).toHaveLength(2);
      expect(grouped["Other.md"]).toHaveLength(1);
    });
  });
});
