// ABOUTME: Tests for ActionLineFinder which finds exact line numbers for actions in files.
// ABOUTME: Verifies accurate line detection for project and general actions.

import { ActionLineFinder } from "../src/action-line-finder";
import { TFile } from "obsidian";

jest.mock("obsidian");

describe("ActionLineFinder", () => {
  let finder: ActionLineFinder;
  let mockApp: any;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    };
    mockApp = {
      vault: mockVault,
    };
    finder = new ActionLineFinder(mockApp);
  });

  it("should find line number for project action", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n# Test Project\n\n## Next actions\n\n- [ ] First action\n- [ ] Second action\n"
    );

    const result = await finder.findActionLine("Projects/Test.md", "First action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(9);
    expect(result.lineContent).toBe("- [ ] First action");
  });

  it("should find line number for general action with sphere tag", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "# Next Actions\n\n- [ ] General action #sphere/work\n- [ ] Another action #sphere/personal\n"
    );

    const result = await finder.findActionLine("Next actions.md", "General action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(3);
    expect(result.lineContent).toBe("- [ ] General action #sphere/work");
  });

  it("should return error when action not found", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("# Empty\n\nNo actions here\n");

    const result = await finder.findActionLine("Empty.md", "Missing action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("Action not found in file");
  });

  it("should return error when file does not exist", async () => {
    mockVault.getAbstractFileByPath.mockReturnValue(null);

    const result = await finder.findActionLine("nonexistent.md", "Some action");

    expect(result.found).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("should match actions with different checkbox statuses", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "- [x] Completed action\n- [w] Waiting action\n- [ ] Open action\n"
    );

    const result1 = await finder.findActionLine("Test.md", "Completed action");
    expect(result1.found).toBe(true);
    expect(result1.lineNumber).toBe(1);

    const result2 = await finder.findActionLine("Test.md", "Waiting action");
    expect(result2.found).toBe(true);
    expect(result2.lineNumber).toBe(2);

    const result3 = await finder.findActionLine("Test.md", "Open action");
    expect(result3.found).toBe(true);
    expect(result3.lineNumber).toBe(3);
  });

  it("should match actions with asterisk bullets", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "* [ ] First action\n* [ ] Second action\n- [ ] Third action\n"
    );

    const result1 = await finder.findActionLine("Test.md", "First action");
    expect(result1.found).toBe(true);
    expect(result1.lineNumber).toBe(1);

    const result2 = await finder.findActionLine("Test.md", "Third action");
    expect(result2.found).toBe(true);
    expect(result2.lineNumber).toBe(3);
  });

  it("should return first match when action appears multiple times", async () => {
    const mockFile = new TFile();
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "- [ ] Duplicate action\n- [ ] Different action\n- [ ] Duplicate action\n"
    );

    const result = await finder.findActionLine("Test.md", "Duplicate action");

    expect(result.found).toBe(true);
    expect(result.lineNumber).toBe(1);
  });
});
