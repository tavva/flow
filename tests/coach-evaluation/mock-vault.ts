// ABOUTME: Creates mock Obsidian vault for coach evaluation tests
// ABOUTME: Provides mocked app, file system, and vault data for isolated testing

import { App, TFile, Vault, TFolder, MetadataCache } from "obsidian";
import { VaultContext } from "./types";
import { FlowProject } from "../../src/types";

export class MockVault {
  public app: Partial<App>;
  public vault: Partial<Vault>;
  public metadataCache: Partial<MetadataCache>;
  private files: Map<string, TFile>;
  private fileContents: Map<string, string>;

  constructor(context: VaultContext) {
    this.files = new Map();
    this.fileContents = new Map();

    // Create mock vault
    this.vault = {
      getAbstractFileByPath: (path: string) => {
        return this.files.get(path) || null;
      },
      read: async (file: TFile) => {
        return this.fileContents.get(file.path) || "";
      },
      modify: async (file: TFile, data: string) => {
        this.fileContents.set(file.path, data);
      },
      create: async (path: string, data: string) => {
        const file = this.createMockFile(path);
        this.files.set(path, file);
        this.fileContents.set(path, data);
        return file;
      },
    };

    // Create mock metadata cache
    this.metadataCache = {
      getFileCache: (file: TFile) => {
        return {
          frontmatter: this.parseFrontmatter(file),
        };
      },
    };

    // Create mock app
    this.app = {
      vault: this.vault as Vault,
      metadataCache: this.metadataCache as MetadataCache,
    };

    // Initialize vault with context
    this.initializeVault(context);
  }

  private createMockFile(path: string): TFile {
    return {
      path,
      name: path.split("/").pop() || "",
      basename: path.split("/").pop()?.replace(/\.md$/, "") || "",
      extension: "md",
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
      parent: null as any,
      vault: this.vault as Vault,
    } as TFile;
  }

  private parseFrontmatter(file: TFile): any {
    const content = this.fileContents.get(file.path) || "";
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontmatter: any = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        frontmatter[key.trim()] = value.replace(/^"(.*)"$/, "$1");
      }
    }
    return frontmatter;
  }

  private initializeVault(context: VaultContext): void {
    // Create project files
    context.projects.forEach((project) => {
      const path = `Projects/${project.title}.md`;
      const content = this.projectToMarkdown(project);
      const file = this.createMockFile(path);
      this.files.set(path, file);
      this.fileContents.set(path, content);
    });

    // Create Next Actions file
    const nextActionsPath = "Next actions.md";
    const nextActionsContent = this.createNextActionsFile(context.nextActions);
    const nextActionsFile = this.createMockFile(nextActionsPath);
    this.files.set(nextActionsPath, nextActionsFile);
    this.fileContents.set(nextActionsPath, nextActionsContent);

    // Create Someday file
    const somedayPath = "Someday.md";
    const somedayContent = this.createSomedayFile(context.somedayItems);
    const somedayFile = this.createMockFile(somedayPath);
    this.files.set(somedayPath, somedayFile);
    this.fileContents.set(somedayPath, somedayContent);
  }

  private projectToMarkdown(project: FlowProject): string {
    let content = "---\n";
    content += `creation-date: ${project.creationDate || "2025-01-01"}\n`;
    content += `priority: ${project.priority || 2}\n`;
    content += `tags: project/${project.sphere}\n`;
    content += `status: ${project.status}\n`;
    content += "---\n\n";
    content += `# ${project.title}\n\n`;
    content += `${project.description || "Project description"}\n\n`;
    content += "## Next actions\n\n";
    project.nextActions.forEach((action) => {
      content += `- [ ] ${action}\n`;
    });
    return content;
  }

  private createNextActionsFile(actions: string[]): string {
    let content = "# Next Actions\n\n";
    actions.forEach((action) => {
      content += `- [ ] ${action}\n`;
    });
    return content;
  }

  private createSomedayFile(items: string[]): string {
    let content = "# Someday/Maybe\n\n";
    items.forEach((item) => {
      content += `- [ ] ${item}\n`;
    });
    return content;
  }

  public getApp(): App {
    return this.app as App;
  }

  public getFileContent(path: string): string {
    return this.fileContents.get(path) || "";
  }

  public getAllFiles(): TFile[] {
    return Array.from(this.files.values());
  }
}
