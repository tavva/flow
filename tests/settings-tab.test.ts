// ABOUTME: Tests the Flow settings tab's shared setting definitions.
// ABOUTME: Covers declarative (Obsidian 1.13+) and display() rendering, including AI row visibility.

import { App, Setting } from "obsidian";
import { FlowGTDSettingTab } from "../src/settings-tab";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";

function installCreateFragment() {
  (global as any).createFragment = (callback: (fragment: any) => void) => {
    const fragment: any = document.createDocumentFragment();
    fragment.appendText = (text: string) => fragment.append(text);
    fragment.createEl = (tag: string, options?: { text?: string }) => {
      const el = document.createElement(tag);
      if (options?.text) el.textContent = options.text;
      fragment.append(el);
      return el;
    };
    callback(fragment);
    return fragment;
  };
}

describe("FlowGTDSettingTab", () => {
  let settings: PluginSettings;
  let plugin: any;
  let tab: FlowGTDSettingTab;

  beforeEach(() => {
    installCreateFragment();
    settings = { ...DEFAULT_SETTINGS, aiEnabled: false };
    plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
      updateSphereCommands: jest.fn(),
      updateFocusFilePath: jest.fn(),
    };
    tab = new FlowGTDSettingTab(new App(), plugin);
  });

  afterEach(() => {
    delete (global as any).createFragment;
  });

  function toggleFor(name: string, rendered: Setting[]): any {
    const setting = rendered.find((s) => s.settingEl.dataset.name === name) as any;
    return setting.components[0];
  }

  it("returns a definition group for each settings section", () => {
    const groups = tab.getSettingDefinitions() as any[];

    expect(groups.map((group) => group.heading)).toEqual([
      "Default Project Settings",
      "Inbox Settings",
      "Output Files & Folders",
      "Spheres",
      "Focus",
      "AI Settings",
    ]);
    expect(groups.every((group) => group.type === "group")).toBe(true);
  });

  it("gives every searchable setting a name and excludes intro text from search", () => {
    const rows = tab.buildSettingGroups().flatMap((group) => group.items);
    const searchable = rows.filter((row) => row.searchable !== false);
    const unnamed = rows.filter((row) => row.name === "");

    expect(searchable.every((row) => row.name.length > 0)).toBe(true);
    expect(searchable.map((row) => row.name)).toEqual(
      expect.arrayContaining(["Default Priority", "Focus File", "Spheres", "OpenRouter API Key"])
    );
    expect(unnamed.every((row) => row.searchable === false)).toBe(true);
  });

  it("draws every group heading and row when Obsidian calls display()", () => {
    tab.display();

    const rowEls = Array.from(tab.containerEl.children) as HTMLElement[];
    const headings = rowEls.filter((el) => el.classList.contains("setting-item-heading"));
    const groups = tab.buildSettingGroups();
    const rowCount = groups.reduce((total, group) => total + group.items.length, 0);

    expect(headings.map((el) => el.dataset.name)).toEqual(groups.map((group) => group.heading));
    expect(rowEls).toHaveLength(groups.length + rowCount);
    expect(rowEls.some((el) => el.dataset.desc?.includes("Get an API key from OpenRouter"))).toBe(
      true
    );
  });

  it("hides AI rows in display() until AI features are enabled", () => {
    const rendered: Setting[] = [];
    const settingPrototype = Setting.prototype as any;
    const originalSetName = settingPrototype.setName;
    jest.spyOn(settingPrototype, "setName").mockImplementation(function (this: Setting, name) {
      rendered.push(this);
      return originalSetName.call(this, name);
    });

    tab.display();

    const apiKeyRow = rendered.find((s) => s.settingEl.dataset.name === "OpenRouter API Key")!;
    expect(apiKeyRow.settingEl.classList.contains("flow-hidden")).toBe(true);

    const onChange = toggleFor("Enable AI features", rendered).onChange.mock.calls[0][0];
    onChange(true);

    expect(settings.aiEnabled).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(apiKeyRow.settingEl.classList.contains("flow-hidden")).toBe(false);
  });

  it("uses Obsidian's visibility refresh when rendered declaratively", () => {
    const refreshDomState = jest.spyOn(tab, "refreshDomState");
    const aiGroup = tab.buildSettingGroups().find((group) => group.heading === "AI Settings")!;
    const aiRows = aiGroup.items.filter((row) => row.visible);
    const toggleRow = aiGroup.items.find((row) => row.name === "Enable AI features")!;

    expect(aiRows.every((row) => row.visible!() === false)).toBe(true);

    const setting = new Setting(document.createElement("div")) as any;
    toggleRow.render(setting);
    setting.components[0].onChange.mock.calls[0][0](true);

    expect(refreshDomState).toHaveBeenCalled();
    expect(aiRows.every((row) => row.visible!() === true)).toBe(true);
  });
});
