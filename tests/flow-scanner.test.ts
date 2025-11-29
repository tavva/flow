import { FlowProjectScanner } from "../src/flow-scanner";
import { FlowProject } from "../src/types";
import { App, TFile, CachedMetadata, MetadataCache, Vault } from "obsidian";

// Mock Obsidian types
class MockTFile implements Partial<TFile> {
  public stat: { mtime: number };

  constructor(
    public path: string,
    public basename: string
  ) {
    this.stat = { mtime: Date.now() };
  }
}

describe("FlowProjectScanner", () => {
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

  describe("scanProjects", () => {
    it("should return empty array when no files exist", async () => {
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

      const result = await scanner.scanProjects();

      expect(result).toEqual([]);
    });

    it("should scan and parse Flow project files", async () => {
      const mockFile = new MockTFile("project1.md", "Project 1") as TFile;
      const mockMetadata: Partial<CachedMetadata> = {
        frontmatter: {
          tags: "project/personal",
          priority: 1,
          status: "live",
          "creation-date": "2025-10-05",
        },
      };
      const mockContent = `---
tags: project/personal
priority: 1
status: live
---

# Project 1

## Next actions
- [ ] Call dentist
- [ ] Buy groceries

## Future next actions
- Plan vacation
`;

      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
      (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

      const result = await scanner.scanProjects();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        file: "project1.md",
        title: "Project 1",
        tags: ["project/personal"],
        priority: 1,
        status: "live",
        nextActions: ["Call dentist", "Buy groceries"],
      });
      expect((result[0] as any).futureNextActions).toBeUndefined();
    });

    it("should filter out non-Flow project files", async () => {
      const projectFile = new MockTFile("project.md", "Project") as TFile;
      const regularFile = new MockTFile("note.md", "Note") as TFile;

      const projectMetadata: Partial<CachedMetadata> = {
        frontmatter: { tags: "project/work" },
      };
      const regularMetadata: Partial<CachedMetadata> = {
        frontmatter: { tags: "note" },
      };

      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([projectFile, regularFile]);
      (mockMetadataCache.getFileCache as jest.Mock)
        .mockReturnValueOnce(projectMetadata)
        .mockReturnValueOnce(regularMetadata);
      (mockVault.read as jest.Mock).mockResolvedValue("## Next actions\n\n## Future next actions");

      const result = await scanner.scanProjects();

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("project.md");
    });

    it("should handle files with array of tags", async () => {
      const mockFile = new MockTFile("project.md", "Project") as TFile;
      const mockMetadata: Partial<CachedMetadata> = {
        frontmatter: {
          tags: ["project/personal", "project/health", "urgent"],
        },
      };

      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
      (mockVault.read as jest.Mock).mockResolvedValue("## Next actions\n\n## Future next actions");

      const result = await scanner.scanProjects();

      expect(result[0].tags).toEqual(["project/personal", "project/health"]);
    });

    describe("parseProjectFile", () => {
      it("should return null for non-Flow project files", async () => {
        const mockFile = new MockTFile("note.md", "Note") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "regular-note" },
        };

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result).toBeNull();
      });

      it("should return null for files with no metadata", async () => {
        const mockFile = new MockTFile("note.md", "Note") as TFile;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(null);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result).toBeNull();
      });

      it("should extract all frontmatter fields correctly", async () => {
        const mockFile = new MockTFile("project.md", "My Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: {
            tags: "project/work",
            priority: 3,
            status: "active",
            "creation-date": "2025-01-15",
          },
        };

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(
          "## Next actions\n\n## Future next actions"
        );

        const result = await scanner.parseProjectFile(mockFile);

        expect(result).toMatchObject({
          file: "project.md",
          title: "My Project",
          priority: 3,
          status: "active",
          creationDate: "2025-01-15",
        });
      });

      it("should extract next actions from markdown content", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/personal" },
        };
        const mockContent = `## Next actions
- [ ] First action
- [ ] Second action with details
  - Sub item (should be ignored)
- [ ] Third action

## Future next actions
- Future action 1
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual([
          "First action",
          "Second action with details",
          "Third action",
        ]);
        expect((result as any)?.futureNextActions).toBeUndefined();
      });

      it("should exclude completed actions with [x] or [X] checkboxes", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `## Next actions
- [ ] Incomplete action
- [x] Completed action lowercase
- [X] Completed action uppercase
- [ ] Another incomplete action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual(["Incomplete action", "Another incomplete action"]);
      });

      it("should match section headings regardless of case", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/personal" },
        };
        const mockContent = `## Next Actions
- [ ] Mixed Case Action

## FUTURE NEXT ACTIONS
- Uppercase Future Action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual(["Mixed Case Action"]);
        expect((result as any)?.futureNextActions).toBeUndefined();
      });

      it("should handle sections with different heading levels", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `# Main Title

## Next actions
- [ ] Action 1
- [ ] Action 2

### Subsection
This should not be included

## Another Section
This should stop the extraction

## Future next actions
- Future 1
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual(["Action 1", "Action 2"]);
        expect((result as any)?.futureNextActions).toBeUndefined();
      });

      it("should handle empty sections", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/personal" },
        };
        const mockContent = `## Next actions

## Future next actions
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual([]);
        expect((result as any)?.futureNextActions).toBeUndefined();
      });

      it("should handle missing sections gracefully", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/personal" },
        };
        const mockContent = `# Project Title

Some content here.
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.nextActions).toEqual([]);
        expect((result as any)?.futureNextActions).toBeUndefined();
      });

      it("should extract milestones section as raw text", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `---
tags: project/work
---

# Ship AI Feature

## Milestones

- Final launch: March 2026
- Review by James [[James Smith]]: 2025-12-12 - needs architecture and implementation
- Beta testing complete: early Feb 2026

## Next actions
- [ ] Draft architecture doc
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.milestones).toBe(
          `- Final launch: March 2026
- Review by James [[James Smith]]: 2025-12-12 - needs architecture and implementation
- Beta testing complete: early Feb 2026`
        );
      });

      it("should return undefined for milestones when section is missing", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.milestones).toBeUndefined();
      });

      it("should return undefined for milestones when section is empty", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `## Milestones

## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.milestones).toBeUndefined();
      });

      it("should handle freeform milestone text without list formatting", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `## Milestones

Launch in Q1 2026
Get James to review by end of year - he needs to see the architecture first

## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.milestones).toBe(
          `Launch in Q1 2026
Get James to review by end of year - he needs to see the architecture first`
        );
      });

      it("should parse current: true from frontmatter", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work", current: true },
        };
        const mockContent = `## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.current).toBe(true);
      });

      it("should set current to false when not present in frontmatter", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work" },
        };
        const mockContent = `## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.current).toBe(false);
      });

      it("should set current to false for non-boolean values", async () => {
        const mockFile = new MockTFile("project.md", "Project") as TFile;
        const mockMetadata: Partial<CachedMetadata> = {
          frontmatter: { tags: "project/work", current: "yes" },
        };
        const mockContent = `## Next actions
- [ ] Some action
`;

        (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
        (mockVault.read as jest.Mock).mockResolvedValue(mockContent);

        const result = await scanner.parseProjectFile(mockFile);

        expect(result?.current).toBe(false);
      });
    });

    describe("searchProjects", () => {
      const mockProjects: FlowProject[] = [
        {
          file: "health.md",
          title: "Health and Fitness",
          tags: ["project/personal", "project/health"],
          nextActions: ["Book gym membership", "Buy running shoes"],
        },
        {
          file: "work.md",
          title: "Website Redesign",
          tags: ["project/work"],
          nextActions: ["Meet with designer", "Review mockups"],
        },
        {
          file: "home.md",
          title: "Home Renovation",
          tags: ["project/personal", "project/home"],
          nextActions: ["Get contractor quotes"],
        },
      ];

      it("should find projects by title", () => {
        const result = scanner.searchProjects(mockProjects, "health");

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Health and Fitness");
      });

      it("should find projects by tag", () => {
        const result = scanner.searchProjects(mockProjects, "work");

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Website Redesign");
      });

      it("should find projects by next action content", () => {
        const result = scanner.searchProjects(mockProjects, "designer");

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Website Redesign");
      });

      it("should return multiple matches", () => {
        const result = scanner.searchProjects(mockProjects, "personal");

        expect(result).toHaveLength(2);
      });

      it("should be case-insensitive", () => {
        const result = scanner.searchProjects(mockProjects, "HEALTH");

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Health and Fitness");
      });

      it("should return empty array when no matches found", () => {
        const result = scanner.searchProjects(mockProjects, "nonexistent");

        expect(result).toEqual([]);
      });
    });
  });
});
