// ABOUTME: Tests for FileWriter.createPerson method
// ABOUTME: Verifies person note creation with template support and fallback

import { App, TFile } from "obsidian";
import { FileWriter } from "../src/file-writer";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";

describe("FileWriter.createPerson", () => {
  let app: App;
  let settings: PluginSettings;
  let fileWriter: FileWriter;

  beforeEach(() => {
    app = new App();
    settings = { ...DEFAULT_SETTINGS };
    fileWriter = new FileWriter(app, settings);

    // Default: no existing file, no template file
    (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
    (app.vault.create as jest.Mock).mockImplementation((path: string, content: string) => {
      const file = new TFile();
      file.path = path;
      file.basename = path.split("/").pop()?.replace(".md", "") || "";
      return Promise.resolve(file);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create person note in configured folder with fallback template", async () => {
    const person = await fileWriter.createPerson("Alice Smith", "");

    expect(app.vault.createFolder).toHaveBeenCalledWith("People");
    expect(app.vault.create).toHaveBeenCalledWith(
      "People/Alice Smith.md",
      expect.stringContaining("person")
    );
    expect(person.file).toBe("People/Alice Smith.md");
  });

  it("should include creation-date in fallback template", async () => {
    await fileWriter.createPerson("Bob", "");

    const content = (app.vault.create as jest.Mock).mock.calls[0][1];
    expect(content).toMatch(/creation-date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00/);
  });

  it("should include Discuss next section in fallback template", async () => {
    await fileWriter.createPerson("Bob", "");

    const content = (app.vault.create as jest.Mock).mock.calls[0][1];
    expect(content).toContain("## Discuss next");
  });

  it("should use template file when available", async () => {
    const templateFile = new TFile();
    templateFile.path = "Templates/Person.md";

    (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === "Templates/Person.md") return templateFile;
      return null;
    });
    (app.vault.read as jest.Mock).mockResolvedValue(
      "---\ncreation-date: {{ date }}T{{ time }}\ntags: person\n---\n\nHello {{ name }}\n"
    );

    await fileWriter.createPerson("Alice", "");

    const content = (app.vault.create as jest.Mock).mock.calls[0][1];
    expect(content).toContain("Hello Alice");
    expect(content).toMatch(/creation-date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(content).not.toContain("{{ name }}");
    expect(content).not.toContain("{{ date }}");
    expect(content).not.toContain("{{ time }}");
  });

  it("should throw if file already exists", async () => {
    const existingFile = new TFile();
    existingFile.path = "People/Alice.md";

    (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === "People/Alice.md") return existingFile;
      return null;
    });

    await expect(fileWriter.createPerson("Alice", "")).rejects.toThrow("already exists");
  });

  it("should sanitize the filename", async () => {
    await fileWriter.createPerson("Alice / Bob", "");

    expect(app.vault.create).toHaveBeenCalledWith("People/Alice Bob.md", expect.any(String));
  });

  it("should use configured folder path", async () => {
    settings.personsFolderPath = "Contacts";
    fileWriter = new FileWriter(app, settings);

    await fileWriter.createPerson("Alice", "");

    expect(app.vault.createFolder).toHaveBeenCalledWith("Contacts");
    expect(app.vault.create).toHaveBeenCalledWith("Contacts/Alice.md", expect.any(String));
  });
});
