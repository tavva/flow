// Mock Obsidian API for testing

export class TFile {
  path: string;
  basename: string;

  constructor(path?: string, basename?: string) {
    this.path = path || "";
    this.basename = basename || "";
  }
}

export class TFolder {
  path: string;
  name: string;

  constructor(path?: string, name?: string) {
    this.path = path || "";
    this.name = name || "";
  }
}

export class Vault {
  create = jest.fn();
  modify = jest.fn();
  read = jest.fn();
  getAbstractFileByPath = jest.fn();
  createFolder = jest.fn();
  getMarkdownFiles = jest.fn().mockReturnValue([]);
  adapter = {
    exists: jest.fn().mockResolvedValue(false),
    read: jest.fn().mockResolvedValue(""),
    write: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue(null),
  };
}

export class MetadataCache {
  getFileCache = jest.fn();
  on = jest.fn(() => ({ unload: jest.fn() }));
  offref = jest.fn();
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
  getActiveFile = jest.fn();
  on = jest.fn(() => ({ unload: jest.fn() }));
  onLayoutReady = jest.fn((callback: () => void) => callback());
  iterateRootLeaves = jest.fn();
  viewRegistry: Record<string, any> = {};
}

export class App {
  vault = new Vault();
  metadataCache = new MetadataCache();
  fileManager = new FileManager();
  workspace = new Workspace();
  commands = {
    commands: {} as Record<string, any>,
  };
}

// Extends HTMLElement with Obsidian's custom methods
function createObsidianElement(tagName: string = "div"): HTMLElement {
  const el = document.createElement(tagName) as HTMLElement & {
    empty: () => void;
    createDiv: (options?: { cls?: string; text?: string }) => HTMLElement;
    createEl: (
      tag: string,
      options?: { cls?: string; text?: string; type?: string; placeholder?: string }
    ) => HTMLElement;
    createSpan: (options?: { cls?: string; text?: string }) => HTMLSpanElement;
    addClass: (cls: string) => void;
    setText: (text: string) => void;
  };

  el.empty = function () {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
  };

  el.createDiv = function (options?: { cls?: string; text?: string }) {
    const div = createObsidianElement("div");
    if (options?.cls) div.className = options.cls;
    if (options?.text) div.textContent = options.text;
    this.appendChild(div);
    return div;
  };

  el.createEl = function (
    tag: string,
    options?: { cls?: string; text?: string; type?: string; placeholder?: string }
  ) {
    const elem = createObsidianElement(tag);
    if (options?.cls) elem.className = options.cls;
    if (options?.text) elem.textContent = options.text;
    if (options?.type && elem instanceof HTMLInputElement) elem.type = options.type;
    if (options?.placeholder && elem instanceof HTMLInputElement)
      elem.placeholder = options.placeholder;
    this.appendChild(elem);
    return elem;
  };

  el.createSpan = function (options?: { cls?: string; text?: string }) {
    return this.createEl("span", options) as HTMLSpanElement;
  };

  el.addClass = function (cls: string) {
    this.classList.add(cls);
  };

  el.setText = function (text: string) {
    this.textContent = text;
  };

  (el as any).appendText = function (text: string) {
    this.appendChild(document.createTextNode(text));
  };

  return el;
}

export class Modal {
  app: App;
  contentEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = createObsidianElement("div");
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class Notice {
  constructor(message: string) {
    Notice.mockConstructor(message);
  }

  static mockConstructor = jest.fn();
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
    const textComponent = {
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis(),
      setPlaceholder: jest.fn().mockReturnThis(),
      inputEl: document.createElement("input"),
    };
    cb(textComponent);
    return this;
  }
  addTextArea(cb: (textarea: any) => void) {
    const textareaComponent = {
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis(),
      setPlaceholder: jest.fn().mockReturnThis(),
      inputEl: Object.assign(document.createElement("textarea"), { rows: 0 }),
    };
    cb(textareaComponent);
    return this;
  }
  addToggle(cb: (toggle: any) => void) {
    const parentEl = document.createElement("div");
    parentEl.createSpan = (options?: { text?: string }) => {
      const span = document.createElement("span");
      if (options?.text) span.textContent = options.text;
      parentEl.appendChild(span);
      return span;
    };
    const toggleEl = document.createElement("div");
    parentEl.appendChild(toggleEl);

    const toggleComponent = {
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis(),
      setTooltip: jest.fn().mockReturnThis(),
      toggleEl: toggleEl,
    };
    cb(toggleComponent);
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
  addCommand(command: any) {
    if (this.app.commands && this.app.commands.commands) {
      this.app.commands.commands[`${this.manifest.id}:${command.id}`] = command;
    }
  }
  removeCommand(commandId: string) {
    if (this.app.commands && this.app.commands.commands) {
      delete this.app.commands.commands[`${this.manifest.id}:${commandId}`];
    }
  }
  addSettingTab(tab: any) {}
  registerView(type: string, viewCreator: any) {
    if (this.app.workspace.viewRegistry) {
      this.app.workspace.viewRegistry[type] = viewCreator;
    }
  }
  loadData() {
    return Promise.resolve({});
  }
  saveData(data: any) {
    return Promise.resolve();
  }
  registerEvent(event: any) {}
  registerDomEvent(el: HTMLElement, event: string, callback: () => void) {}
  registerInterval(interval: number) {}
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

  async setState(state: any, result: any): Promise<void> {
    // Base implementation does nothing
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

export const Platform = {
  isMacOS: false,
  isWin: false,
  isLinux: true,
  isMobile: false,
  isDesktop: true,
  isDesktopApp: true,
};
