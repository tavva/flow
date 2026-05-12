// ABOUTME: Tests for SomedayScanner context tag extraction.
// ABOUTME: Validates that context tags are populated on someday items.

import { SomedayScanner } from "../src/someday-scanner";
import { App, TFile, Vault } from "obsidian";

// Mock the flow scanner
jest.mock("../src/flow-scanner", () => ({
  FlowProjectScanner: jest.fn().mockImplementation(() => ({
    scanProjects: jest.fn().mockResolvedValue([]),
  })),
}));

describe("SomedayScanner", () => {
  let mockApp: App;
  let mockVault: jest.Mocked<Vault>;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    } as unknown as jest.Mocked<Vault>;

    mockApp = {
      vault: mockVault,
    } as unknown as App;
  });

  it("should extract context tags from someday items", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Someday.md";
    mockFile.basename = "Someday";

    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(
      "- [ ] Learn pottery #context/errands\n- [ ] Take skydiving lessons #context/phone #context/computer\n"
    );

    const scanner = new SomedayScanner(mockApp, {
      somedayFilePath: "Someday.md",
    } as any);

    const data = await scanner.scanSomedayData();

    expect(data.items).toHaveLength(2);
    expect(data.items[0].contexts).toEqual(["errands"]);
    expect(data.items[1].contexts).toEqual(["phone", "computer"]);
  });

  it("should return empty contexts array when no context tags", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Someday.md";
    mockFile.basename = "Someday";

    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue("- [ ] Plain someday item\n");

    const scanner = new SomedayScanner(mockApp, {
      somedayFilePath: "Someday.md",
    } as any);

    const data = await scanner.scanSomedayData();

    expect(data.items).toHaveLength(1);
    expect(data.items[0].contexts).toEqual([]);
  });
});
