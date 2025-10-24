// Mock Obsidian API for testing

export class TFile {
  path: string;
  basename: string;

  constructor(path?: string, basename?: string) {
    this.path = path || "";
    this.basename = basename || "";
  }
}

export class Vault {
  create = jest.fn();
  modify = jest.fn();
  read = jest.fn();
  getAbstractFileByPath = jest.fn();
}

export class MetadataCache {
  getFileCache = jest.fn();
}

export class FileManager {
  processFrontMatter = jest.fn();
}

export class WorkspaceLeaf {
  openFile = jest.fn();
  view: any = null;
  setViewState = jest.fn();
  detach = jest.fn();
}

export class Workspace {
  getLeaf = jest.fn();
  activeLeaf: WorkspaceLeaf | null = null;
  getLeavesOfType = jest.fn();
  revealLeaf = jest.fn();
  setActiveLeaf = jest.fn();
  getRightLeaf = jest.fn();
  detachLeavesOfType = jest.fn();
  on = jest.fn(() => ({ unload: jest.fn() }));
}

export class App {
  vault = new Vault();
  metadataCache = new MetadataCache();
  fileManager = new FileManager();
  workspace = new Workspace();
}

export class Modal {
  app: App;
  contentEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement("div");
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string) {
    return this;
  }
  setDesc(desc: string) {
    return this;
  }
  addText(cb: (text: any) => void) {
    cb({
      setValue: jest.fn(),
      onChange: jest.fn(),
      setPlaceholder: jest.fn(),
      inputEl: document.createElement("input"),
    });
    return this;
  }
  addButton(cb: (button: any) => void) {
    cb({
      setButtonText: jest.fn().mockReturnThis(),
      setCta: jest.fn().mockReturnThis(),
      onClick: jest.fn(),
      setDisabled: jest.fn().mockReturnThis(),
    });
    return this;
  }
  addSlider(cb: (slider: any) => void) {
    cb({
      setLimits: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
      setDynamicTooltip: jest.fn().mockReturnThis(),
      onChange: jest.fn(),
    });
    return this;
  }
  addDropdown(cb: (dropdown: any) => void) {
    cb({
      addOptions: jest.fn().mockReturnThis(),
      addOption: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn(),
      selectEl: {
        style: {},
      },
    });
    return this;
  }
}

export class Plugin {
  app: App;
  manifest: any;

  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addRibbonIcon(icon: string, title: string, callback: () => void) {}
  addCommand(command: any) {}
  addSettingTab(tab: any) {}
  loadData() {
    return Promise.resolve({});
  }
  saveData(data: any) {
    return Promise.resolve();
  }
  registerEvent(event: any) {}
  registerDomEvent(el: HTMLElement, event: string, callback: () => void) {}
  registerInterval(interval: number) {}
  registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => any) {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  display() {}
  hide() {}
}

export class Notice {
  constructor(message: string, timeout?: number) {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export interface CachedMetadata {
  frontmatter?: any;
  sections?: any[];
  headings?: any[];
  links?: any[];
  embeds?: any[];
  tags?: any[];
}

export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: any;

  constructor(leaf: WorkspaceLeaf) {
    this.app = new App();
    this.leaf = leaf;
    // Create a simple mock container without using DOM
    const childElement = {
      empty: jest.fn(),
      setText: jest.fn(),
      createDiv: jest.fn(() => ({
        setText: jest.fn(),
        createDiv: jest.fn(() => ({ setText: jest.fn(), style: {} })),
        createEl: jest.fn(() => ({
          setText: jest.fn(),
          createEl: jest.fn(() => ({
            setText: jest.fn(),
            addEventListener: jest.fn(),
            style: {},
          })),
          addEventListener: jest.fn(),
          style: {},
        })),
        addClass: jest.fn(),
        remove: jest.fn(),
        addEventListener: jest.fn(),
        style: {},
      })),
      createEl: jest.fn(() => ({
        setText: jest.fn(),
        addEventListener: jest.fn(),
        createEl: jest.fn(() => ({
          setText: jest.fn(),
          addEventListener: jest.fn(),
          style: {},
        })),
        style: {},
      })),
      addClass: jest.fn(),
    };
    this.containerEl = {
      children: [{}, childElement],
      empty: jest.fn(),
      createDiv: jest.fn(() => childElement),
      createEl: jest.fn(() => childElement),
      addClass: jest.fn(),
    };
  }

  getViewType(): string {
    return "";
  }

  getDisplayText(): string {
    return "";
  }

  getIcon(): string {
    return "";
  }

  onOpen(): Promise<void> {
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

export function setIcon(element: HTMLElement, iconId: string): void {
  // Mock implementation - just sets a data attribute for testing
  if (element) {
    (element as any).dataset = { icon: iconId };
  }
}

export class DropdownComponent {
  selectEl: any;

  constructor(containerEl: HTMLElement) {
    this.selectEl = {
      id: "",
      addClass: jest.fn().mockReturnThis(),
      setAttribute: jest.fn(),
      style: {},
    };
  }

  addOption(value: string, label: string) {
    return this;
  }

  setValue(value: string) {
    return this;
  }

  onChange(callback: (value: string) => void) {
    return this;
  }
}

export class MarkdownRenderer {
  static async renderMarkdown(
    markdown: string,
    element: HTMLElement,
    sourcePath: string,
    component: any
  ): Promise<void> {
    // Simple mock: just set the text content for testing
    // In real Obsidian, this would parse markdown and create proper DOM
    element.innerHTML = markdown;
  }
}
