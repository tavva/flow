// ABOUTME: Presents Flow configuration in the Obsidian settings dialog.
// ABOUTME: Persists project, inbox, output file, and focus preferences.

import {
  App,
  Notice,
  PluginSettingTab,
  requireApiVersion,
  Setting,
  SettingDefinitionItem,
  TextComponent,
} from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { DEFAULT_SETTINGS } from "./types";
import { FolderPathSuggest, FilePathSuggest } from "./suggesters";
import { openInActiveWindow } from "./obsidian-platform";
import { runAsync } from "./async-utils";

// One settings row. Obsidian 1.13+ renders these declaratively (and indexes them for
// settings search); older versions draw them through display().
export interface FlowSettingRow {
  name: string;
  desc?: string | DocumentFragment;
  searchable?: boolean;
  visible?: () => boolean;
  render: (setting: Setting) => void;
}

export interface FlowSettingGroup {
  type: "group";
  heading: string;
  items: FlowSettingRow[];
}

export class FlowGTDSettingTab extends PluginSettingTab {
  plugin: FlowGTDCoachPlugin;
  // Rows drawn by display() that have a visibility predicate
  private displayedConditionalRows: { row: FlowSettingRow; settingEl: HTMLElement }[] = [];

  constructor(app: App, plugin: FlowGTDCoachPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Obsidian 1.13+ calls this and skips display().
  getSettingDefinitions(): SettingDefinitionItem[] {
    return this.buildSettingGroups();
  }

  // Obsidian versions before 1.13 call this instead of getSettingDefinitions().
  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    this.displayedConditionalRows = [];

    for (const group of this.buildSettingGroups()) {
      new Setting(containerEl).setHeading().setName(group.heading);

      for (const row of group.items) {
        const setting = new Setting(containerEl).setName(row.name);
        if (row.desc) {
          setting.setDesc(row.desc);
        }
        row.render(setting);

        if (row.visible) {
          this.displayedConditionalRows.push({ row, settingEl: setting.settingEl });
        }
      }
    }

    this.refreshVisibility();
  }

  buildSettingGroups(): FlowSettingGroup[] {
    const aiEnabled = () => this.plugin.settings.aiEnabled;

    return [
      {
        type: "group",
        heading: "Default Project Settings",
        items: [
          this.introRow("These settings are used when creating new Flow projects."),

          // Default Priority
          {
            name: "Default Priority",
            desc: "Default priority level for new projects (1-5, where 1 is highest)",
            render: (setting) => {
              setting.addDropdown((dropdown) => {
                for (const value of ["1", "2", "3", "4", "5"]) {
                  dropdown.addOption(value, value);
                }
                dropdown.setValue(String(this.plugin.settings.defaultPriority));
                dropdown.onChange((value) => {
                  this.plugin.settings.defaultPriority = parseInt(value, 10);
                  this.saveSettingsAfterChange();
                });
              });
            },
          },

          // Default Status
          {
            name: "Default Status",
            desc: "Default status for new projects",
            render: (setting) => {
              setting.addDropdown((dropdown) =>
                dropdown
                  .addOptions({
                    live: "Live",
                    active: "Active",
                    planning: "Planning",
                    paused: "Paused",
                    completed: "Completed",
                  })
                  .setValue(this.plugin.settings.defaultStatus)
                  .onChange((value) => {
                    this.plugin.settings.defaultStatus = value;
                    this.saveSettingsAfterChange();
                  })
              );
            },
          },

          // Auto-create cover image
          {
            name: "Auto-create cover image",
            desc: "Automatically generate a cover image when creating new projects during inbox processing",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.autoCreateCoverImage).onChange((value) => {
                  this.plugin.settings.autoCreateCoverImage = value;
                  this.saveSettingsAfterChange();
                })
              );
            },
          },

          {
            name: "Display cover images on project notes",
            desc: "Show cover images on project notes",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.displayCoverImages).onChange((value) => {
                  this.plugin.settings.displayCoverImages = value;
                  this.saveSettingsAfterChange();
                })
              );
            },
          },
        ],
      },

      // Inbox Settings
      {
        type: "group",
        heading: "Inbox Settings",
        items: [
          this.introRow("Configure inbox folders for processing."),

          // Line-at-a-time inbox
          {
            name: "Line at a time",
            desc: "Flow processes all lines in every note in this folder.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder(DEFAULT_SETTINGS.inboxFilesFolderPath)
                  .setValue(this.plugin.settings.inboxFilesFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.inboxFilesFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },

          // Note-at-a-time inbox
          {
            name: "Note at a time",
            desc: "Flow processes entire notes one by one in this folder.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder(DEFAULT_SETTINGS.inboxFolderPath)
                  .setValue(this.plugin.settings.inboxFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.inboxFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },

          // Processed inbox folder
          {
            name: "Processed inbox folder",
            desc: "Processed notes from the inbox folder are archived here instead of being deleted.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder(DEFAULT_SETTINGS.processedInboxFolderPath)
                  .setValue(this.plugin.settings.processedInboxFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.processedInboxFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },
        ],
      },

      // Output Files
      {
        type: "group",
        heading: "Output Files & Folders",
        items: [
          this.introRow("Configure where processed items should be saved."),

          // Next Actions File
          {
            name: "Next Actions File",
            desc: "File for standalone next actions that aren't part of a project.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Next actions.md")
                  .setValue(this.plugin.settings.nextActionsFilePath)
                  .onChange((value) => {
                    this.plugin.settings.nextActionsFilePath = value;
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(this.app, text.inputEl, ["md"]);
              });
            },
          },

          // Someday File
          {
            name: "Someday/Maybe File",
            desc: "File for someday/maybe items (things you might do in the future).",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Someday.md")
                  .setValue(this.plugin.settings.somedayFilePath)
                  .onChange((value) => {
                    this.plugin.settings.somedayFilePath = value;
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(this.app, text.inputEl, ["md"]);
              });
            },
          },

          // Focus File
          {
            name: "Focus File",
            desc: "File for your focus list, relative to the vault. Apply moves your existing file to the new location. Leave blank to use the default.",
            render: (setting) => {
              let focusPathInput: TextComponent;
              setting
                .addText((text) => {
                  focusPathInput = text;
                  text
                    .setPlaceholder(DEFAULT_SETTINGS.focusFilePath)
                    .setValue(this.plugin.settings.focusFilePath);
                  new FilePathSuggest(this.app, text.inputEl, ["md"]);
                })
                .addButton((button) =>
                  button.setButtonText("Apply").onClick(async () => {
                    button.setDisabled(true);
                    focusPathInput.setDisabled(true);
                    try {
                      if (await this.plugin.updateFocusFilePath(focusPathInput.getValue())) {
                        focusPathInput.setValue(this.plugin.settings.focusFilePath);
                        new Notice("Focus file location updated.");
                      }
                    } catch (error) {
                      new Notice(
                        error instanceof Error
                          ? error.message
                          : "Could not change the focus file location."
                      );
                    } finally {
                      button.setDisabled(false);
                      focusPathInput.setDisabled(false);
                    }
                  })
                );
            },
          },

          // Projects Folder
          {
            name: "Projects Folder",
            desc: "Folder where new project files will be created.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Projects")
                  .setValue(this.plugin.settings.projectsFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.projectsFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },

          // Project Template File
          {
            name: "Project Template File",
            desc: "Template file used when creating new projects. Supports {{date}}, {{time}}, {{priority}}, {{status}}, {{sphere}}, and {{description}} variables. Templater syntax is also supported if Templater is installed. See docs/project-templates.md for details.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Templates/Project.md")
                  .setValue(this.plugin.settings.projectTemplateFilePath)
                  .onChange((value) => {
                    this.plugin.settings.projectTemplateFilePath = value;
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(this.app, text.inputEl, ["md"]);
              });
            },
          },

          // People Folder
          {
            name: "People Folder",
            desc: "Folder where new person notes will be created.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("People")
                  .setValue(this.plugin.settings.personsFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.personsFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },

          // Person Template File
          {
            name: "Person Template File",
            desc: "Template file used when creating new person notes. Supports {{date}}, {{time}}, and {{name}} variables.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Templates/Person.md")
                  .setValue(this.plugin.settings.personTemplateFilePath)
                  .onChange((value) => {
                    this.plugin.settings.personTemplateFilePath = value;
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(this.app, text.inputEl, ["md"]);
              });
            },
          },

          // Default Inbox File
          {
            name: "Default Inbox File",
            desc: "Filename for built-in Flow quick capture (will be created in Flow Inbox Files folder)",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Inbox.md")
                  .setValue(this.plugin.settings.defaultInboxFile)
                  .onChange((value) => {
                    this.plugin.settings.defaultInboxFile = value;
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(
                  this.app,
                  text.inputEl,
                  ["md"],
                  () => this.plugin.settings.inboxFilesFolderPath
                );
              });
            },
          },

          // Cover Images Folder
          {
            name: "Cover Images Folder",
            desc: "Folder where generated project cover images will be saved",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Assets/flow-project-cover-images")
                  .setValue(this.plugin.settings.coverImagesFolderPath)
                  .onChange((value) => {
                    this.plugin.settings.coverImagesFolderPath = value;
                    this.saveSettingsAfterChange();
                  });
                new FolderPathSuggest(this.app, text.inputEl);
              });
            },
          },
        ],
      },

      // Spheres
      {
        type: "group",
        heading: "Spheres",
        items: [
          this.introRow(
            "Spheres help categorise projects and actions (e.g., personal, work, health)."
          ),

          {
            name: "Spheres",
            desc: "Comma-separated list of spheres for categorising your projects and actions.",
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder(DEFAULT_SETTINGS.spheres.join(", "))
                  .setValue(this.plugin.settings.spheres.join(", "))
                  .onChange((value) => {
                    this.plugin.settings.spheres = value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    this.saveSettingsAfterChange();
                    this.plugin.updateSphereCommands();
                  })
              );
            },
          },

          {
            name: "Context tag prefix",
            desc:
              "Tag prefix for GTD contexts on actions (e.g. #context/home, #context/office). " +
              "Change this to use a different prefix like 'at' for #at/home or 'ctx' for #ctx/office.",
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder(DEFAULT_SETTINGS.contextTagPrefix)
                  .setValue(this.plugin.settings.contextTagPrefix)
                  .onChange((value) => {
                    this.plugin.settings.contextTagPrefix = value.trim() || "context";
                    this.saveSettingsAfterChange();
                  })
              );
            },
          },
        ],
      },

      // Focus Settings
      {
        type: "group",
        heading: "Focus",
        items: [
          this.introRow("Configure automatic clearing and archiving of your focus."),

          {
            name: "Auto-clear time",
            desc: 'Time to automatically clear the focus daily (e.g., "03:00"). Leave empty to disable auto-clearing.',
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder("03:00")
                  .setValue(this.plugin.settings.focusAutoClearTime)
                  .onChange((value) => {
                    const trimmed = value.trim();
                    // Validate format if not empty
                    if (trimmed && !/^\d{1,2}:\d{2}$/.test(trimmed)) {
                      // Invalid format, don't save
                      return;
                    }
                    this.plugin.settings.focusAutoClearTime = trimmed;
                    this.saveSettingsAfterChange();
                  })
              );
            },
          },

          {
            name: "Archive file",
            desc: "File path where cleared focus items will be archived. Disabled if auto-clear is off.",
            render: (setting) => {
              setting.addText((text) => {
                text
                  .setPlaceholder("Focus Archive.md")
                  .setValue(this.plugin.settings.focusArchiveFile)
                  .onChange((value) => {
                    this.plugin.settings.focusArchiveFile = value.trim();
                    this.saveSettingsAfterChange();
                  });
                new FilePathSuggest(this.app, text.inputEl, ["md"]);
              });
            },
          },
        ],
      },

      // AI Settings
      {
        type: "group",
        heading: "AI Settings",
        items: [
          this.introRow("Configure OpenRouter for AI-powered cover image generation."),

          {
            name: "Enable AI features",
            desc: "Enable AI-powered cover image generation. When disabled, AI functionality is unavailable.",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.aiEnabled).onChange((value) => {
                  this.plugin.settings.aiEnabled = value;
                  this.saveSettingsAfterChange();
                  this.refreshVisibility();
                })
              );
            },
          },

          {
            name: "OpenRouter API Key",
            desc: "Enter your OpenRouter API key for AI-powered features.",
            visible: aiEnabled,
            render: (setting) => {
              setting
                .addText((text) => {
                  text
                    .setPlaceholder("sk-or-v1-...")
                    .setValue(this.plugin.settings.openrouterApiKey)
                    .onChange((value) => {
                      this.plugin.settings.openrouterApiKey = value.trim();
                      this.saveSettingsAfterChange();
                    });
                  text.inputEl.type = "password";
                })
                .addButton((button) =>
                  button.setButtonText("Get API key").onClick(() => {
                    openInActiveWindow("https://openrouter.ai/keys", "_blank");
                  })
                );
            },
          },

          {
            name: "OpenRouter Base URL",
            desc: "Override the API base URL (defaults to OpenRouter).",
            visible: aiEnabled,
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder(DEFAULT_SETTINGS.openrouterBaseUrl)
                  .setValue(this.plugin.settings.openrouterBaseUrl)
                  .onChange((value) => {
                    this.plugin.settings.openrouterBaseUrl =
                      value.trim() || DEFAULT_SETTINGS.openrouterBaseUrl;
                    this.saveSettingsAfterChange();
                  })
              );
            },
          },

          {
            name: "Image Model",
            desc: "OpenRouter model ID for generating project cover images.",
            visible: aiEnabled,
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder(DEFAULT_SETTINGS.openrouterImageModel)
                  .setValue(this.plugin.settings.openrouterImageModel)
                  .onChange((value) => {
                    this.plugin.settings.openrouterImageModel =
                      value.trim() || DEFAULT_SETTINGS.openrouterImageModel;
                    this.saveSettingsAfterChange();
                  })
              );
            },
          },

          {
            name: "",
            desc: createFragment((fragment) => {
              fragment.appendText("Get an API key from ");
              fragment.createEl("a", {
                text: "OpenRouter",
                href: "https://openrouter.ai/keys",
                attr: { target: "_blank" },
              });
              fragment.appendText(". Your key is stored locally and never shared.");
            }),
            searchable: false,
            visible: aiEnabled,
            render: () => {},
          },
        ],
      },
    ];
  }

  // Explanatory text shown under a group heading; not a setting itself.
  private introRow(text: string): FlowSettingRow {
    return { name: "", desc: text, searchable: false, render: () => {} };
  }

  private refreshVisibility(): void {
    // On 1.13+ Obsidian renders the definitions and display() never runs
    if (requireApiVersion("1.13.0")) {
      this.refreshDomState();
      return;
    }

    for (const { row, settingEl } of this.displayedConditionalRows) {
      settingEl.classList.toggle("flow-hidden", !row.visible?.());
    }
  }

  private saveSettingsAfterChange(): void {
    runAsync(this.plugin.saveSettings(), "Failed to save Flow settings");
  }
}
