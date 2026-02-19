import { WaitingForScanner } from "../src/waiting-for-scanner";
import { App, TFile, Vault, MetadataCache, CachedMetadata } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/types";

describe("WaitingForScanner", () => {
  let mockApp: jest.Mocked<App>;
  let mockVault: jest.Mocked<Vault>;
  let mockMetadataCache: jest.Mocked<MetadataCache>;
  let scanner: WaitingForScanner;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
      getAbstractFileByPath: jest.fn(),
    } as unknown as jest.Mocked<Vault>;

    mockMetadataCache = {
      getFileCache: jest.fn(),
    } as unknown as jest.Mocked<MetadataCache>;

    mockApp = {
      vault: mockVault,
      metadataCache: mockMetadataCache,
    } as unknown as jest.Mocked<App>;

    scanner = new WaitingForScanner(mockApp, DEFAULT_SETTINGS);
  });

  test("should scan vault and find waiting-for items", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Projects/Project A.md";
    mockFile.basename = "Project A";

    const mockCache = {
      frontmatter: {
        tags: ["project/work"],
      },
      listItems: [{ position: { start: { line: 9 } } }],
    } as CachedMetadata;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockImplementation((path) => {
      if (path === "Projects/Project A.md") {
        return mockFile;
      }
      return null;
    });
    mockVault.read.mockResolvedValue(`---
tags: project/work
---

# Project A

## Next actions

- [ ] Regular task
- [w] Call John after he returns from holiday
- [x] Completed task
`);

    mockMetadataCache.getFileCache.mockImplementation((file) => {
      if (file === mockFile) {
        return mockCache;
      }
      return null;
    });

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      file: "Projects/Project A.md",
      fileName: "Project A",
      lineNumber: 10,
      lineContent: "- [w] Call John after he returns from holiday",
      text: "Call John after he returns from holiday",
      sphere: "work",
      contexts: [],
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

  test("should find multiple waiting-for items in a file", async () => {
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
    expect(items[0].text).toBe("Ongoing wait");
    expect(items[1].text).toBe("Another waiting item");
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

  test("should extract sphere from inline tag", async () => {
    const mockFile = {
      path: "Next actions.md",
      basename: "Next actions",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(`- [w] Wait for client feedback #sphere/work`);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].sphere).toBe("work");
  });

  test("should extract sphere from project frontmatter tags", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Projects/My Project.md";
    mockFile.basename = "My Project";

    const mockCache = {
      frontmatter: {
        tags: ["project/personal"],
      },
      listItems: [{ position: { start: { line: 5 } } }],
    } as CachedMetadata;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockImplementation((path) => {
      if (path === "Projects/My Project.md") {
        return mockFile;
      }
      return null;
    });
    mockVault.read.mockResolvedValue(`---
tags:
  - project/personal
---

- [w] Wait for parts delivery`);

    mockMetadataCache.getFileCache.mockImplementation((file) => {
      if (file === mockFile) {
        return mockCache;
      }
      return null;
    });

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].sphere).toBe("personal");
  });

  test("should prefer inline sphere tag over project tag", async () => {
    const mockFile = {
      path: "Projects/My Project.md",
      basename: "My Project",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(`---
tags:
  - project/work
---

- [w] Wait for approval #sphere/personal`);

    mockMetadataCache.getFileCache.mockReturnValue({
      frontmatter: {
        tags: ["project/work"],
      },
      listItems: [{ position: { start: { line: 5 } } }],
    } as CachedMetadata);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].sphere).toBe("personal");
  });

  test("should handle items without sphere", async () => {
    const mockFile = {
      path: "Notes.md",
      basename: "Notes",
    } as TFile;

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
    mockVault.read.mockResolvedValue(`- [w] Wait for something`);

    mockMetadataCache.getFileCache.mockReturnValue(null);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].sphere).toBeUndefined();
  });

  test("should extract context tags from waiting-for items", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Projects/Project A.md";
    mockFile.basename = "Project A";

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockImplementation((path) => {
      if (path === "Projects/Project A.md") return mockFile;
      return null;
    });
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n## Next actions\n\n- [w] Chase invoice from supplier #context/phone\n"
    );

    mockMetadataCache.getFileCache.mockReturnValue({
      frontmatter: { tags: ["project/work"] },
      listItems: [{ position: { start: { line: 6 } } }],
    } as any);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].contexts).toEqual(["phone"]);
  });

  test("should return empty contexts array when no context tags", async () => {
    const mockFile = Object.create(TFile.prototype);
    mockFile.path = "Projects/Project A.md";
    mockFile.basename = "Project A";

    mockVault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockVault.getAbstractFileByPath.mockImplementation((path) => {
      if (path === "Projects/Project A.md") return mockFile;
      return null;
    });
    mockVault.read.mockResolvedValue(
      "---\ntags: project/work\n---\n\n## Next actions\n\n- [w] Plain waiting item\n"
    );

    mockMetadataCache.getFileCache.mockReturnValue({
      frontmatter: { tags: ["project/work"] },
      listItems: [{ position: { start: { line: 6 } } }],
    } as any);

    const items = await scanner.scanWaitingForItems();

    expect(items).toHaveLength(1);
    expect(items[0].contexts).toEqual([]);
  });
});
