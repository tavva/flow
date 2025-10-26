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
    // Use real DOM elements if available (JSDOM in tests)
    if (typeof document !== "undefined") {
      const container = document.createElement("div");
      const childElement = document.createElement("div");
      container.appendChild(document.createElement("div")); // Placeholder for children[0]
      container.appendChild(childElement);

      // Add Obsidian-specific methods to DOM elements
      (container as any).createDiv = function (opts?: any) {
        const div = document.createElement("div");
        if (opts?.cls) div.className = opts.cls;
        if (opts?.text) div.textContent = opts.text;
        this.appendChild(div);
        (div as any).createDiv = container.createDiv;
        (div as any).createEl = container.createEl;
        (div as any).createSpan = container.createSpan;
        (div as any).empty = function () {
          this.innerHTML = "";
        };
        (div as any).setText = function (text: string) {
          this.textContent = text;
        };
        (div as any).addClass = function (cls: string) {
          this.classList.add(cls);
        };
        (div as any).removeClass = function (cls: string) {
          this.classList.remove(cls);
        };
        return div;
      };
      (container as any).createEl = function (tag: string, opts?: any) {
        const el = document.createElement(tag);
        if (opts?.cls) el.className = opts.cls;
        if (opts?.text) el.textContent = opts.text;
        if (opts?.attr) {
          for (const [key, value] of Object.entries(opts.attr)) {
            el.setAttribute(key, value as string);
          }
        }
        this.appendChild(el);
        (el as any).createDiv = container.createDiv;
        (el as any).createEl = container.createEl;
        (el as any).createSpan = container.createSpan;
        (el as any).empty = function () {
          this.innerHTML = "";
        };
        (el as any).setText = function (text: string) {
          this.textContent = text;
        };
        (el as any).addClass = function (cls: string) {
          this.classList.add(cls);
        };
        (el as any).removeClass = function (cls: string) {
          this.classList.remove(cls);
        };
        return el;
      };
      (container as any).createSpan = function (opts?: any) {
        const span = document.createElement("span");
        if (opts?.cls) span.className = opts.cls;
        if (opts?.text) span.textContent = opts.text;
        this.appendChild(span);
        (span as any).createDiv = container.createDiv;
        (span as any).createEl = container.createEl;
        (span as any).createSpan = container.createSpan;
        (span as any).setText = function (text: string) {
          this.textContent = text;
        };
        (span as any).addClass = function (cls: string) {
          this.classList.add(cls);
        };
        return span;
      };
      (container as any).empty = function () {
        this.innerHTML = "";
      };
      (container as any).addClass = function (cls: string) {
        this.classList.add(cls);
      };

      // Apply same methods to childElement
      (childElement as any).createDiv = container.createDiv;
      (childElement as any).createEl = container.createEl;
      (childElement as any).createSpan = container.createSpan;
      (childElement as any).empty = function () {
        this.innerHTML = "";
      };
      (childElement as any).addClass = function (cls: string) {
        this.classList.add(cls);
      };

      this.containerEl = container;
    } else {
      // Fallback for non-DOM environments
      const childElement = {
        empty: jest.fn(),
        setText: jest.fn(),
        createDiv: jest.fn(() => ({ setText: jest.fn(), style: {} })),
        createEl: jest.fn(() => ({ setText: jest.fn(), style: {} })),
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
    element.setAttribute("data-icon", iconId);
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
