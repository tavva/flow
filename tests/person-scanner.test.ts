import { PersonScanner } from "../src/person-scanner";
import { PersonNote } from "../src/types";
import { App, TFile, CachedMetadata, MetadataCache, Vault } from "obsidian";

// Mock Obsidian types
class MockTFile extends TFile {
  constructor(
    public path: string,
    public basename: string
  ) {
    super();
  }
}

describe("PersonScanner", () => {
  let scanner: PersonScanner;
  let mockApp: Partial<App>;
  let mockVault: Partial<Vault>;
  let mockMetadataCache: Partial<MetadataCache>;

  beforeEach(() => {
    mockVault = {
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
      getAbstractFileByPath: jest.fn(),
    };

    mockMetadataCache = {
      getFileCache: jest.fn(),
    };

    mockApp = {
      vault: mockVault as Vault,
      metadataCache: mockMetadataCache as MetadataCache,
    };

    scanner = new PersonScanner(mockApp as App);
  });

  describe("scanPersons", () => {
    it("should return empty array when no files exist", async () => {
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

      const result = await scanner.scanPersons();

      expect(result).toEqual([]);
    });

    it("should identify person notes by person tag", async () => {
      const mockFile = new MockTFile("people/John Doe.md", "John Doe");
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);

      const mockMetadata: CachedMetadata = {
        frontmatter: {
          tags: ["person"],
          status: "live",
          "creation-date": "2025-01-01 10:00",
        },
      };

      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);

      const result = await scanner.scanPersons();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        file: "people/John Doe.md",
        title: "John Doe",
        tags: ["person"],
        status: "live",
        creationDate: "2025-01-01 10:00",
      });
    });

    it("should handle array of tags including person tag", async () => {
      const mockFile = new MockTFile("people/Jane Smith.md", "Jane Smith");
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);

      const mockMetadata: CachedMetadata = {
        frontmatter: {
          tags: ["person", "colleague", "manager"],
          status: "active",
        },
      };

      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);

      const result = await scanner.scanPersons();

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(["person", "colleague", "manager"]);
    });

    it("should ignore files without person tag", async () => {
      const mockFile = new MockTFile("projects/Work Project.md", "Work Project");
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);

      const mockMetadata: CachedMetadata = {
        frontmatter: {
          tags: ["project/work"],
          priority: 2,
        },
      };

      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);

      const result = await scanner.scanPersons();

      expect(result).toHaveLength(0);
    });

    it("should ignore files without frontmatter", async () => {
      const mockFile = new MockTFile("notes/Random Note.md", "Random Note");
      (mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);

      (mockMetadataCache.getFileCache as jest.Mock).mockReturnValue(null);

      const result = await scanner.scanPersons();

      expect(result).toHaveLength(0);
    });
  });

  describe("searchPersons", () => {
    const mockPersons: PersonNote[] = [
      {
        file: "people/John Doe.md",
        title: "John Doe",
        tags: ["person", "colleague"],
        status: "active",
      },
      {
        file: "people/Jane Smith.md",
        title: "Jane Smith",
        tags: ["person", "manager"],
        status: "active",
      },
      {
        file: "people/Dr. Brown.md",
        title: "Dr. Brown",
        tags: ["person", "doctor"],
        status: "active",
      },
    ];

    it("should find persons by title match", () => {
      const result = scanner.searchPersons(mockPersons, "john");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("John Doe");
    });

    it("should find persons by tag match", () => {
      const result = scanner.searchPersons(mockPersons, "manager");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Jane Smith");
    });

    it("should be case insensitive", () => {
      const result = scanner.searchPersons(mockPersons, "DR");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Dr. Brown");
    });

    it("should return empty array when no matches found", () => {
      const result = scanner.searchPersons(mockPersons, "xyz");

      expect(result).toHaveLength(0);
    });
  });

  describe("hasDiscussNextSection", () => {
    it('should return true when file contains "## Discuss next" section', async () => {
      const person: PersonNote = {
        file: "people/John Doe.md",
        title: "John Doe",
        tags: ["person"],
      };

      const mockFile = new MockTFile("people/John Doe.md", "John Doe");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(`---
tags:
  - person
---

# John Doe

Some content here.

## Discuss next
- Topic 1
- Topic 2
`);

      const result = await scanner.hasDiscussNextSection(person);

      expect(result).toBe(true);
    });

    it('should return false when file does not contain "## Discuss next" section', async () => {
      const person: PersonNote = {
        file: "people/Jane Smith.md",
        title: "Jane Smith",
        tags: ["person"],
      };

      const mockFile = new MockTFile("people/Jane Smith.md", "Jane Smith");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(`---
tags:
  - person
---

# Jane Smith

Some content here.

## Notes
- Note 1
- Note 2
`);

      const result = await scanner.hasDiscussNextSection(person);

      expect(result).toBe(false);
    });

    it("should return false when file does not exist", async () => {
      const person: PersonNote = {
        file: "people/Missing Person.md",
        title: "Missing Person",
        tags: ["person"],
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const result = await scanner.hasDiscussNextSection(person);

      expect(result).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const person: PersonNote = {
        file: "people/Error Person.md",
        title: "Error Person",
        tags: ["person"],
      };

      const mockFile = new MockTFile("people/Error Person.md", "Error Person");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockRejectedValue(new Error("Read error"));

      // Suppress console.warn during this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = await scanner.hasDiscussNextSection(person);

      expect(result).toBe(false);

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
