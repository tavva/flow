// ABOUTME: Tests for the NewPersonModal class
// ABOUTME: Verifies person creation flow and validation logic

import { App } from "obsidian";
import { NewPersonModal } from "../src/new-person-modal";
import { DEFAULT_SETTINGS } from "../src/types";

jest.mock("../src/file-writer", () => ({
  FileWriter: jest.fn().mockImplementation(() => ({
    createPerson: jest.fn().mockImplementation((name: string) => {
      return Promise.resolve({
        path: `People/${name}.md`,
        name: `${name}.md`,
      });
    }),
  })),
}));

describe("NewPersonModal", () => {
  let mockApp: App;
  let modal: NewPersonModal;

  beforeEach(() => {
    mockApp = new App();
    (mockApp.workspace.getLeaf as jest.Mock).mockReturnValue({
      openFile: jest.fn().mockResolvedValue(undefined),
    });

    const settings = { ...DEFAULT_SETTINGS };
    modal = new NewPersonModal(mockApp, settings);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validation", () => {
    it("should require person name", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.name = "";

      await (modal as any).createPerson();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createPerson).not.toHaveBeenCalled();
    });

    it("should reject names with only invalid characters", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.name = "///";

      await (modal as any).createPerson();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createPerson).not.toHaveBeenCalled();
    });
  });

  describe("person creation", () => {
    it("should create person with trimmed name", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.name = "  Alice Smith  ";

      await (modal as any).createPerson();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createPerson).toHaveBeenCalledWith("Alice Smith");
    });

    it("should open the created file", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.name = "Alice";

      await (modal as any).createPerson();

      const leaf = (mockApp.workspace.getLeaf as jest.Mock).mock.results[0]
        .value;
      expect(leaf.openFile).toHaveBeenCalled();
    });

    it("should close the modal after creation", async () => {
      await modal.onOpen();
      const closeSpy = jest.spyOn(modal, "close");

      const data = (modal as any).data;
      data.name = "Alice";

      await (modal as any).createPerson();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
