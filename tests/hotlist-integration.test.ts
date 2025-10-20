// ABOUTME: Integration tests for the hotlist feature, testing interactions between components.
// ABOUTME: Validates the full workflow from finding actions to validating them in files.

import { HotlistView } from "../src/hotlist-view";
import { SphereView } from "../src/sphere-view";
import { HotlistValidator } from "../src/hotlist-validator";
import { ActionLineFinder } from "../src/action-line-finder";
import { PluginSettings, HotlistItem } from "../src/types";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("Hotlist Integration", () => {
  let mockApp: any;
  let mockVault: any;
  let mockSettings: PluginSettings;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      modify: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
      workspace: {
        getLeaf: jest.fn(),
      },
    };
    mockSettings = {
      anthropicApiKey: "",
      anthropicModel: "claude-sonnet-4-20250514",
      provider: "anthropic",
      openAIApiKey: "",
      openAIBaseURL: "https://openrouter.ai/api/v1",
      openAIModel: "openrouter/anthropic/claude-3.5-sonnet",
      defaultPriority: 2,
      defaultStatus: "live",
      inboxFilesFolder: "Flow Inbox Files",
      inboxFolder: "Flow Inbox Folder",
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      projectsFolder: "Projects",
      spheres: ["work", "personal"],
      hotlist: [],
    };
  });

  it("should add action to hotlist and validate it", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );

    // Find the line
    const finder = new ActionLineFinder(mockApp);
    const lineResult = await finder.findActionLine("Projects/Test.md", "Test action");

    expect(lineResult.found).toBe(true);
    expect(lineResult.lineNumber).toBe(9);
    expect(lineResult.lineContent).toBe("- [ ] Test action");

    // Add to hotlist
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: lineResult.lineNumber!,
      lineContent: lineResult.lineContent!,
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };
    mockSettings.hotlist.push(item);

    // Validate the item
    const validator = new HotlistValidator(mockApp);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Test action\n"
    );
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBeUndefined();
    expect(mockSettings.hotlist).toHaveLength(1);
  });

  it("should handle line number changes after file edits", async () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // New content with action moved to line 13 (added 4 lines)
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Description\n\nNew section\n\n## Next actions\n\n- [ ] Test action\n"
    );

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(13);
  });

  it("should find general actions with sphere tags", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Next Actions\n\n- [ ] General action #sphere/work\n- [ ] Another action #sphere/personal\n"
    );

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Next actions.md", "General action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [ ] General action #sphere/work");
  });

  it("should handle multiple identical actions by finding first match", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Test\n\n- [ ] Duplicate action\n- [ ] Duplicate action\n- [ ] Different action\n"
    );

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Duplicate action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3); // First occurrence
  });

  it("should return error when action text not found in file", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Empty\n\nNo actions here\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Empty.md", "Missing action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("Action not found in file");
  });

  it("should return error when file does not exist", async () => {
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Nonexistent.md", "Test action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("should validate that item still exists after checkbox status changes", async () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Checkbox changed to [x], so exact match fails
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [x] Test action\n"
    );

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    // Should NOT find it because line content changed
    expect(validation.found).toBe(false);
    expect(validation.error).toBe("Line not found");
  });

  it("should handle items removed from source file", async () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 9,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Action has been removed from file
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] Different action\n"
    );

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(false);
    expect(validation.error).toBe("Line not found");
  });

  it("should find actions with different checkbox statuses (waiting)", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Test\n\n- [w] Waiting action\n- [ ] Normal action\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Waiting action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [w] Waiting action");
  });

  it("should find actions with different checkbox statuses (complete)", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Test\n\n- [x] Completed action\n- [ ] Normal action\n");

    const finder = new ActionLineFinder(mockApp);
    const result = await finder.findActionLine("Test.md", "Completed action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [x] Completed action");
  });

  it("should handle lines deleted above hotlist item", async () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 10,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Lines deleted, action now at line 7
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n- [ ] Test action\n"
    );

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(7);
  });

  it("should handle lines inserted above hotlist item", async () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 7,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    // Lines inserted, action now at line 11
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Description\n\nExtra content\n\n- [ ] Test action\n"
    );

    const validator = new HotlistValidator(mockApp);
    const validation = await validator.validateItem(item);

    expect(validation.found).toBe(true);
    expect(validation.updatedLineNumber).toBe(11);
  });
});
