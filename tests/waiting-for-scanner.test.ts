import { WaitingForScanner } from "../src/waiting-for-scanner";
import { App, TFile, Vault } from "obsidian";

describe("WaitingForScanner", () => {
  let mockApp: jest.Mocked<App>;
  let mockVault: jest.Mocked<Vault>;
  let scanner: WaitingForScanner;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
    } as unknown as jest.Mocked<Vault>;

    mockApp = {
      vault: mockVault,
    } as unknown as jest.Mocked<App>;

    scanner = new WaitingForScanner(mockApp);
  });

  test("should scan vault and find waiting-for items", async () => {
    const mockFile = {
      path: "Projects/Project A.md",
      basename: "Project A",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`---
tags: project/work
---

# Project A

## Next actions

- [ ] Regular task
- [w] Call John after he returns from holiday
- [x] Completed task
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      file: "Projects/Project A.md",
      fileName: "Project A",
      lineNumber: 10,
      text: "Call John after he returns from holiday",
      isCompleted: false,
    });
  });

  test("should find multiple waiting-for items in same file", async () => {
    const mockFile = {
      path: "Next actions.md",
      basename: "Next actions",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`# Next actions

- [w] Wait for Sarah's report
- [ ] Regular task
- [w] Wait for server deployment
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe("Wait for Sarah's report");
    expect(items[1].text).toBe("Wait for server deployment");
  });

  test("should track completed waiting-for items", async () => {
    const mockFile = {
      path: "Projects/Project B.md",
      basename: "Project B",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`## Next actions

- [w] Ongoing wait
- [w] Another waiting item
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(2);
    expect(items[0].isCompleted).toBe(false);
    expect(items[1].isCompleted).toBe(false); // Only scan for [w], not [x]
  });

  test("should handle files with no waiting-for items", async () => {
    const mockFile = {
      path: "Reference.md",
      basename: "Reference",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`# Reference

Just regular content here.
`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(0);
  });

  test("should clean up checkbox text", async () => {
    const mockFile = {
      path: "Test.md",
      basename: "Test",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.read.mockResolvedValue(`- [w]   Extra   spaces   everywhere  `);

    const items = await scanner.scanWaitingForItems();

    expect(items[0].text).toBe("Extra spaces everywhere");
  });
});
