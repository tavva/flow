# Create Person Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Create person" command that scaffolds person notes with template support, mirroring the existing "Create new project" pattern.

**Architecture:** New settings (`personsFolderPath`, `personTemplateFilePath`) feed a `NewPersonModal` that reads a template, replaces variables, creates the file, and opens it. `FileWriter` gains a `createPerson` method for the file creation logic (template reading, variable substitution, fallback).

**Tech Stack:** Obsidian API (Modal, Setting, TFile, normalizePath), existing FileWriter patterns, Jest for testing.

---

### Task 1: Add settings fields

**Files:**
- Modify: `src/types/settings.ts`

**Step 1: Add the two new fields to `PluginSettings` interface**

Add after `projectTemplateFilePath` (line 23):

```typescript
  personsFolderPath: string;
  personTemplateFilePath: string;
```

**Step 2: Add defaults to `DEFAULT_SETTINGS`**

Add after `projectTemplateFilePath: "Templates/Project.md"` (line 56):

```typescript
  personsFolderPath: "People",
  personTemplateFilePath: "Templates/Person.md",
```

**Step 3: Run build to verify types**

Run: `npm run build`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/types/settings.ts
git commit -m "Add personsFolderPath and personTemplateFilePath settings"
```

---

### Task 2: Add settings UI

**Files:**
- Modify: `src/settings-tab.ts`

**Step 1: Add "People Folder" setting**

Add after the "Project Template File" setting block (after line 372), following the same pattern as "Projects Folder" (lines 342-355):

```typescript
    // People Folder
    new Setting(containerEl)
      .setName("People Folder")
      .setDesc("Folder where new person notes will be created.")
      .addText((text) => {
        text
          .setPlaceholder("People")
          .setValue(this.plugin.settings.personsFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.personsFolderPath = value;
            await this.plugin.saveSettings();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Person Template File
    new Setting(containerEl)
      .setName("Person Template File")
      .setDesc(
        "Template file used when creating new person notes. Supports {{date}}, {{time}}, and {{name}} variables."
      )
      .addText((text) => {
        text
          .setPlaceholder("Templates/Person.md")
          .setValue(this.plugin.settings.personTemplateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.personTemplateFilePath = value;
            await this.plugin.saveSettings();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/settings-tab.ts
git commit -m "Add People Folder and Person Template settings to settings tab"
```

---

### Task 3: Add `createPerson` to FileWriter (TDD)

**Files:**
- Create: `tests/file-writer-create-person.test.ts`
- Modify: `src/file-writer.ts`

**Step 1: Write failing tests**

Create `tests/file-writer-create-person.test.ts`:

```typescript
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
    const file = await fileWriter.createPerson("Alice Smith");

    expect(app.vault.createFolder).toHaveBeenCalledWith("People");
    expect(app.vault.create).toHaveBeenCalledWith(
      "People/Alice Smith.md",
      expect.stringContaining("tags: person")
    );
    expect(file.path).toBe("People/Alice Smith.md");
  });

  it("should include creation-date in fallback template", async () => {
    await fileWriter.createPerson("Bob");

    const content = (app.vault.create as jest.Mock).mock.calls[0][1];
    expect(content).toMatch(/creation-date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00/);
  });

  it("should include Discuss next section in fallback template", async () => {
    await fileWriter.createPerson("Bob");

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

    await fileWriter.createPerson("Alice");

    const content = (app.vault.create as jest.Mock).mock.calls[0][1];
    expect(content).toContain("Hello Alice");
    expect(content).toMatch(/creation-date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00/);
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

    await expect(fileWriter.createPerson("Alice")).rejects.toThrow("already exists");
  });

  it("should sanitize the filename", async () => {
    await fileWriter.createPerson("Alice / Bob");

    expect(app.vault.create).toHaveBeenCalledWith(
      "People/Alice  Bob.md",
      expect.any(String)
    );
  });

  it("should use configured folder path", async () => {
    settings.personsFolderPath = "Contacts";
    fileWriter = new FileWriter(app, settings);

    await fileWriter.createPerson("Alice");

    expect(app.vault.createFolder).toHaveBeenCalledWith("Contacts");
    expect(app.vault.create).toHaveBeenCalledWith(
      "Contacts/Alice.md",
      expect.any(String)
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- file-writer-create-person`
Expected: FAIL — `createPerson` does not exist on `FileWriter`

**Step 3: Implement `createPerson` in `FileWriter`**

Add to `src/file-writer.ts`, after the `createProject` method (after line 62):

```typescript
  /**
   * Create a new person note file
   */
  async createPerson(name: string): Promise<TFile> {
    const fileName = this.generateFileName(name);
    const folderPath = normalizePath(this.settings.personsFolderPath);
    await this.ensureFolderExists(folderPath);
    const filePath = normalizePath(`${folderPath}/${fileName}.md`);

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      throw new ValidationError(`File ${filePath} already exists`);
    }

    const content = await this.buildPersonContent(name);
    const file = await this.app.vault.create(filePath, content);

    return file;
  }
```

Add the template/fallback methods near the other `build*Content` methods (after `buildProjectContentFallback`, around line 590):

```typescript
  /**
   * Build person note content from template or fallback
   */
  private async buildPersonContent(name: string): Promise<string> {
    const templateFile = this.app.vault.getAbstractFileByPath(
      this.settings.personTemplateFilePath
    );

    if (!templateFile || !(templateFile instanceof TFile)) {
      return this.buildPersonContentFallback(name);
    }

    let templateContent = await this.app.vault.read(templateFile);

    const now = new Date();
    const date = this.formatDate(now);
    const time = this.formatTime(now);

    templateContent = templateContent
      .replace(/{{\s*date\s*}}/g, date)
      .replace(/{{\s*time\s*}}/g, time)
      .replace(/{{\s*name\s*}}/g, name);

    return templateContent;
  }

  /**
   * Fallback content when person template file is not available
   */
  private buildPersonContentFallback(name: string): string {
    const now = new Date();
    const dateTime = this.formatDateTime(now);

    return `---\ncreation-date: ${dateTime}\ntags: person\n---\n\n## Discuss next\n`;
  }
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- file-writer-create-person`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/file-writer-create-person.test.ts src/file-writer.ts
git commit -m "Add FileWriter.createPerson with template support"
```

---

### Task 4: Create NewPersonModal (TDD)

**Files:**
- Create: `tests/new-person-modal.test.ts`
- Create: `src/new-person-modal.ts`

**Step 1: Write failing tests**

Create `tests/new-person-modal.test.ts`:

```typescript
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

      const leaf = (mockApp.workspace.getLeaf as jest.Mock).mock.results[0].value;
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
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- new-person-modal`
Expected: FAIL — module `../src/new-person-modal` not found

**Step 3: Implement `NewPersonModal`**

Create `src/new-person-modal.ts`:

```typescript
// ABOUTME: Modal for creating a new person note with name input.
// ABOUTME: Uses configurable template file with fallback for person note scaffolding.

import { App, Modal, Setting } from "obsidian";
import { PluginSettings } from "./types";
import { FileWriter } from "./file-writer";
import { sanitizeFileName } from "./validation";

interface NewPersonData {
  name: string;
}

export class NewPersonModal extends Modal {
  private settings: PluginSettings;
  private fileWriter: FileWriter;
  private data: NewPersonData;

  constructor(app: App, settings: PluginSettings) {
    super(app);
    this.settings = settings;
    this.fileWriter = new FileWriter(app, settings);
    this.data = {
      name: "",
    };
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flow-gtd-new-person-modal");
    this.render();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Create Person" });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("The person's name")
      .addText((text) =>
        text
          .setPlaceholder("Enter name...")
          .setValue(this.data.name)
          .onChange((value) => {
            this.data.name = value;
          })
      );

    const buttonContainer = contentEl.createDiv({ cls: "flow-gtd-modal-buttons" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "16px";

    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => this.close());

    const createButton = buttonContainer.createEl("button", {
      text: "Create Person",
      cls: "mod-cta",
    });
    createButton.addEventListener("click", () => this.createPerson());
  }

  private async createPerson() {
    if (!this.data.name.trim()) {
      this.showError("Person name is required");
      return;
    }

    const sanitizedName = sanitizeFileName(this.data.name.trim());
    if (sanitizedName.length === 0) {
      this.showError(
        "Name contains only invalid characters. Please use letters, numbers, or spaces."
      );
      return;
    }

    try {
      const file = await this.fileWriter.createPerson(this.data.name.trim());
      this.close();

      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    } catch (error) {
      console.error("Failed to create person:", error);
      this.showError(
        `Failed to create person: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private showError(message: string) {
    const { contentEl } = this;
    const existingError = contentEl.querySelector(".flow-gtd-modal-error");
    if (existingError) {
      existingError.remove();
    }

    const errorEl = contentEl.createDiv({ cls: "flow-gtd-modal-error" });
    errorEl.style.color = "var(--text-error)";
    errorEl.style.marginTop = "8px";
    errorEl.style.padding = "8px";
    errorEl.style.backgroundColor = "var(--background-modifier-error)";
    errorEl.style.borderRadius = "4px";
    errorEl.setText(message);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- new-person-modal`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/new-person-modal.test.ts src/new-person-modal.ts
git commit -m "Add NewPersonModal for creating person notes"
```

---

### Task 5: Register command in main.ts

**Files:**
- Modify: `main.ts`

**Step 1: Add import**

Add after the `NewProjectModal` import (line 6):

```typescript
import { NewPersonModal } from "./src/new-person-modal";
```

**Step 2: Add command registration**

Add after the "create-project" command block (after line 120):

```typescript
    // Add create person command
    this.addCommand({
      id: "create-person",
      name: "Create person",
      callback: () => {
        this.openNewPersonModal();
      },
    });
```

**Step 3: Add the private method**

Add after `openNewProjectModal` (after line 414):

```typescript
  private openNewPersonModal() {
    const modal = new NewPersonModal(this.app, this.settings);
    modal.open();
  }
```

**Step 4: Run build and all tests**

Run: `npm run build && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add main.ts
git commit -m "Register create-person command in plugin"
```

---

### Task 6: Format, build, and verify

**Step 1: Run formatter**

Run: `npm run format`

**Step 2: Run build**

Run: `npm run build`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: PASS, all existing tests still green

**Step 4: Commit any formatting changes**

```bash
git add -A && git commit -m "Format code"
```
(Only if there are changes from formatting.)
