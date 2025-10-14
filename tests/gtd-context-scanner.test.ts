import { GTDContextScanner } from "../src/gtd-context-scanner";
import { App, TFile, Vault, MetadataCache } from "obsidian";
import { PluginSettings } from "../src/types";

describe("GTDContextScanner", () => {
  let mockApp: App;
  let mockVault: Vault;
  let scanner: GTDContextScanner;
  let settings: PluginSettings;

  beforeEach(() => {
    mockVault = {
      read: jest.fn(),
      getAbstractFileByPath: jest.fn(),
    } as unknown as Vault;

    mockApp = {
      vault: mockVault,
    } as App;

    settings = {
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      inboxFolderPath: "Flow Inbox Folder",
      inboxFilesFolderPath: "Flow Inbox Files",
    } as PluginSettings;

    scanner = new GTDContextScanner(mockApp, settings);
  });

  describe("scanNextActions", () => {
    it("should extract checkbox items from next actions file", async () => {
      const content = `# Next Actions

- [ ] Call dentist to schedule appointment
- [ ] Review Q4 budget
- [x] Complete project proposal
- Regular text line
- [ ] Send email to team`;

      const mockFile = { path: "Next actions.md" } as TFile;
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanNextActions();

      expect(result).toEqual([
        "Call dentist to schedule appointment",
        "Review Q4 budget",
        "Send email to team",
      ]);
    });

    it("should return empty array if file does not exist", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const result = await scanner.scanNextActions();

      expect(result).toEqual([]);
    });

    it("should return empty array if no checkboxes found", async () => {
      const content = `# Next Actions

Just some regular text
No checkboxes here`;

      const mockFile = { path: "Next actions.md" } as TFile;
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanNextActions();

      expect(result).toEqual([]);
    });
  });

  describe("scanSomedayItems", () => {
    it("should extract list items from someday file", async () => {
      const content = `# Someday/Maybe

- Learn Italian
- Write a book
- Visit Japan
- Remodel kitchen

Some paragraph text.

- Start a podcast`;

      const mockFile = { path: "Someday.md" } as TFile;
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanSomedayItems();

      expect(result).toEqual([
        "Learn Italian",
        "Write a book",
        "Visit Japan",
        "Remodel kitchen",
        "Start a podcast",
      ]);
    });

    it("should return empty array if file does not exist", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const result = await scanner.scanSomedayItems();

      expect(result).toEqual([]);
    });

    it("should handle both checkbox and regular list items", async () => {
      const content = `# Someday/Maybe

- Regular item
- [ ] Checkbox item
- [x] Completed item`;

      const mockFile = { path: "Someday.md" } as TFile;
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(content);

      const result = await scanner.scanSomedayItems();

      expect(result).toEqual(["Regular item", "Checkbox item"]);
    });
  });

  describe("scanInboxItems", () => {
    let mockGetMarkdownFiles: jest.Mock;

    beforeEach(() => {
      mockGetMarkdownFiles = jest.fn();
      mockVault.getMarkdownFiles = mockGetMarkdownFiles;
    });

    it("should list files from both inbox folders", async () => {
      const mockFiles = [
        { path: "Flow Inbox Folder/Meeting notes.md", basename: "Meeting notes" } as TFile,
        { path: "Flow Inbox Files/Project idea.md", basename: "Project idea" } as TFile,
        { path: "Other Folder/Not inbox.md", basename: "Not inbox" } as TFile,
        { path: "Flow Inbox Folder/Quick thought.md", basename: "Quick thought" } as TFile,
      ];

      mockGetMarkdownFiles.mockReturnValue(mockFiles);

      const result = await scanner.scanInboxItems();

      expect(result).toEqual([
        "Meeting notes (Flow Inbox Folder)",
        "Project idea (Flow Inbox Files)",
        "Quick thought (Flow Inbox Folder)",
      ]);
    });

    it("should return empty array if no inbox files found", async () => {
      const mockFiles = [
        { path: "Other Folder/Not inbox.md", basename: "Not inbox" } as TFile,
      ];

      mockGetMarkdownFiles.mockReturnValue(mockFiles);

      const result = await scanner.scanInboxItems();

      expect(result).toEqual([]);
    });

    it("should handle empty vault", async () => {
      mockGetMarkdownFiles.mockReturnValue([]);

      const result = await scanner.scanInboxItems();

      expect(result).toEqual([]);
    });
  });

  describe("scanContext", () => {
    it("should scan all GTD context at once", async () => {
      const nextActionsContent = `- [ ] Action 1\n- [ ] Action 2`;
      const somedayContent = `- Someday 1\n- Someday 2`;

      (mockVault.read as jest.Mock).mockImplementation((file: TFile) => {
        if (file.path === "Next actions.md") {
          return Promise.resolve(nextActionsContent);
        }
        if (file.path === "Someday.md") {
          return Promise.resolve(somedayContent);
        }
        return Promise.reject(new Error("File not found"));
      });

      mockVault.getMarkdownFiles = jest.fn().mockReturnValue([
        { path: "Flow Inbox Folder/Item 1.md", basename: "Item 1" } as TFile,
        { path: "Flow Inbox Files/Item 2.md", basename: "Item 2" } as TFile,
      ]);

      // Need to fix the readFile mock
      const mockGetAbstractFileByPath = jest.fn((path: string) => {
        return { path } as TFile;
      });
      mockVault.getAbstractFileByPath = mockGetAbstractFileByPath;

      const result = await scanner.scanContext();

      expect(result).toEqual({
        nextActions: ["Action 1", "Action 2"],
        somedayItems: ["Someday 1", "Someday 2"],
        inboxItems: ["Item 1 (Flow Inbox Folder)", "Item 2 (Flow Inbox Files)"],
      });
    });

    it("should handle partial failures gracefully", async () => {
      (mockVault.read as jest.Mock).mockRejectedValue(new Error("File not found"));
      mockVault.getMarkdownFiles = jest.fn().mockReturnValue([]);

      const result = await scanner.scanContext();

      expect(result).toEqual({
        nextActions: [],
        somedayItems: [],
        inboxItems: [],
      });
    });
  });
});
