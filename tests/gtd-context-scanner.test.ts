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
});
