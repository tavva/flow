import { FlowProjectScanner } from "../src/flow-scanner";
import { App, TFile, CachedMetadata, MetadataCache, Vault } from "obsidian";

// Mock Obsidian types
class MockTFile implements Partial<TFile> {
  public stat: { mtime: number };

  constructor(
    public path: string,
    public basename: string,
    mtime: number = Date.now()
  ) {
    this.stat = { mtime };
  }
}

describe("FlowProjectScanner Caching", () => {
  let scanner: FlowProjectScanner;
  let mockApp: Partial<App>;
  let mockVault: Partial<Vault>;
  let mockMetadataCache: Partial<MetadataCache>;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
    };

    mockMetadataCache = {
      getFileCache: jest.fn(),
    };

    mockApp = {
      vault: mockVault as Vault,
      metadataCache: mockMetadataCache as MetadataCache,
    };

    scanner = new FlowProjectScanner(mockApp as App);
  });

  it("should cache parsed projects and avoid re-reading file content", async () => {
    const mockFile = new MockTFile("project.md", "Project", 1000) as TFile;
    const mockMetadata: Partial<CachedMetadata> = {
      frontmatter: { tags: "project/work" },
    };
    const mockContent = `## Next actions
- [ ] Action 1`;

    (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
    (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

    // First scan
    const result1 = await scanner.parseProjectFile(mockFile);
    expect(result1).not.toBeNull();
    expect(mockVault.read).toHaveBeenCalledTimes(1);

    // Second scan (same mtime)
    const result2 = await scanner.parseProjectFile(mockFile);
    expect(result2).toEqual(result1);
    expect(mockVault.read).toHaveBeenCalledTimes(1); // Should NOT increase
  });

  it("should re-read file content when mtime changes", async () => {
    const mockFile = new MockTFile("project.md", "Project", 1000) as TFile;
    const mockMetadata: Partial<CachedMetadata> = {
      frontmatter: { tags: "project/work" },
    };
    const mockContent1 = `## Next actions
- [ ] Action 1`;
    const mockContent2 = `## Next actions
- [ ] Action 1
- [ ] Action 2`;

    (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
    (mockVault.read as jest.Mock)
      .mockResolvedValueOnce(mockContent1)
      .mockResolvedValueOnce(mockContent2);

    // First scan
    await scanner.parseProjectFile(mockFile);
    expect(mockVault.read).toHaveBeenCalledTimes(1);

    // Update mtime
    mockFile.stat.mtime = 2000;

    // Second scan (new mtime)
    const result2 = await scanner.parseProjectFile(mockFile);
    expect(mockVault.read).toHaveBeenCalledTimes(2); // Should increase
    expect(result2?.nextActions).toHaveLength(2);
  });

  it("should cache null results for non-project files (optional behavior check)", async () => {
    // Note: The current implementation does NOT cache nulls (files that aren't projects).
    // It only caches successful FlowProject parses.
    // This test confirms that behavior.

    const mockFile = new MockTFile("note.md", "Note") as TFile;
    const mockMetadata: Partial<CachedMetadata> = {
      frontmatter: { tags: "note" },
    };

    (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);

    // First scan
    await scanner.parseProjectFile(mockFile);

    // Second scan
    await scanner.parseProjectFile(mockFile);

    // Since we don't cache nulls, we expect getFileCache to be called again
    expect(mockMetadataCache.getFileCache).toHaveBeenCalledTimes(2);
  });
});
