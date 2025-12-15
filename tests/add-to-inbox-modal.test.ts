// ABOUTME: Tests for AddToInboxModal
// ABOUTME: Verifies quick inbox capture functionality

import { App, TFile } from "obsidian";
import { AddToInboxModal } from "../src/add-to-inbox-modal";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";

describe("AddToInboxModal", () => {
  let mockApp: App;
  let modal: AddToInboxModal;
  let settings: PluginSettings;

  beforeEach(() => {
    mockApp = new App();
    settings = {
      ...DEFAULT_SETTINGS,
      inboxFilesFolderPath: "Flow Inbox Files",
      cliInboxFile: "Flow CLI Inbox.md",
    };
    modal = new AddToInboxModal(mockApp, settings);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("submission", () => {
    it("should append content to inbox file when submitted", async () => {
      const mockInboxFile = new TFile("Flow Inbox Files/Flow CLI Inbox.md", "Flow CLI Inbox.md");
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockInboxFile);

      await modal.onOpen();

      // Set the input value
      (modal as any).inputValue = "Buy milk";

      await (modal as any).submit();

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockInboxFile,
        expect.stringContaining("Buy milk")
      );
    });

    it("should create inbox file if it does not exist", async () => {
      // First call returns null (file doesn't exist), second returns the created file
      const mockInboxFile = new TFile("Flow Inbox Files/Flow CLI Inbox.md", "Flow CLI Inbox.md");
      (mockApp.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(null) // inbox file check
        .mockReturnValueOnce({}) // folder exists check
        .mockReturnValueOnce(mockInboxFile); // after create
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockInboxFile);

      await modal.onOpen();
      (modal as any).inputValue = "New item";

      await (modal as any).submit();

      expect(mockApp.vault.create).toHaveBeenCalledWith("Flow Inbox Files/Flow CLI Inbox.md", "");
    });

    it("should create inbox folder if it does not exist", async () => {
      const mockInboxFile = new TFile("Flow Inbox Files/Flow CLI Inbox.md", "Flow CLI Inbox.md");
      (mockApp.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(null) // inbox file doesn't exist
        .mockReturnValueOnce(null) // folder doesn't exist
        .mockReturnValueOnce(mockInboxFile); // after create
      (mockApp.vault.createFolder as jest.Mock).mockResolvedValue(undefined);
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockInboxFile);

      await modal.onOpen();
      (modal as any).inputValue = "New item";

      await (modal as any).submit();

      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("Flow Inbox Files");
      expect(mockApp.vault.create).toHaveBeenCalledWith("Flow Inbox Files/Flow CLI Inbox.md", "");
    });

    it("should not submit when input is empty", async () => {
      await modal.onOpen();
      (modal as any).inputValue = "";

      await (modal as any).submit();

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
      expect(mockApp.vault.create).not.toHaveBeenCalled();
    });

    it("should not submit when input is only whitespace", async () => {
      await modal.onOpen();
      (modal as any).inputValue = "   ";

      await (modal as any).submit();

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it("should append newline after content", async () => {
      const mockInboxFile = new TFile("Flow Inbox Files/Flow CLI Inbox.md", "Flow CLI Inbox.md");
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockInboxFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("Existing content");

      await modal.onOpen();
      (modal as any).inputValue = "New item";

      await (modal as any).submit();

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockInboxFile,
        "Existing content\nNew item\n"
      );
    });

    it("should handle empty existing file", async () => {
      const mockInboxFile = new TFile("Flow Inbox Files/Flow CLI Inbox.md", "Flow CLI Inbox.md");
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockInboxFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("");

      await modal.onOpen();
      (modal as any).inputValue = "First item";

      await (modal as any).submit();

      expect(mockApp.vault.modify).toHaveBeenCalledWith(mockInboxFile, "First item\n");
    });
  });

  describe("validation", () => {
    it("should show warning when trying to submit empty input", async () => {
      await modal.onOpen();
      (modal as any).inputValue = "";

      await (modal as any).submit();

      const warningEl = (modal as any).warningEl;
      expect(warningEl.textContent).toBeTruthy();
    });
  });
});
