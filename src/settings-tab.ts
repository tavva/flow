import { App, PluginSettingTab, Setting } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { DEFAULT_SETTINGS } from "./types";
import { FolderPathSuggest, FilePathSuggest } from "./suggesters";
import { openInActiveWindow } from "./obsidian-platform";
import { runAsync } from "./async-utils";

export class FlowGTDSettingTab extends PluginSettingTab {
  plugin: FlowGTDCoachPlugin;

  constructor(app: App, plugin: FlowGTDCoachPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl).setHeading().setName("Default Project Settings");
    containerEl
      .createDiv("setting-item-description")
      .createEl("p", { text: "These settings are used when creating new Flow projects." });

    // Default Priority
    new Setting(containerEl)
      .setName("Default Priority")
      .setDesc("Default priority level for new projects (1-5, where 1 is highest)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 5, 1)
          .setValue(this.plugin.settings.defaultPriority)
          .setDynamicTooltip()
          .onChange((value) => {
            this.plugin.settings.defaultPriority = value;
            this.saveSettingsAfterChange();
          })
      );

    // Default Status
    new Setting(containerEl)
      .setName("Default Status")
      .setDesc("Default status for new projects")
      .addDropdown((dropdown) =>
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

    // Auto-create cover image
    new Setting(containerEl)
      .setName("Auto-create cover image")
      .setDesc(
        "Automatically generate a cover image when creating new projects during inbox processing"
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoCreateCoverImage).onChange((value) => {
          this.plugin.settings.autoCreateCoverImage = value;
          this.saveSettingsAfterChange();
        })
      );

    new Setting(containerEl)
      .setName("Display cover images on project notes")
      .setDesc("Show cover images on project notes")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.displayCoverImages).onChange((value) => {
          this.plugin.settings.displayCoverImages = value;
          this.saveSettingsAfterChange();
        })
      );

    // Inbox Settings
    new Setting(containerEl).setHeading().setName("Inbox Settings");
    containerEl
      .createDiv("setting-item-description")
      .createEl("p", { text: "Configure inbox folders for processing." });

    // Line-at-a-time inbox
    new Setting(containerEl)
      .setName("Line at a time")
      .setDesc("Flow processes all lines in every note in this folder.")
      .addText((text) => {
        text
          .setPlaceholder("Flow Inbox Files")
          .setValue(this.plugin.settings.inboxFilesFolderPath)
          .onChange((value) => {
            this.plugin.settings.inboxFilesFolderPath = value;
            this.saveSettingsAfterChange();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Note-at-a-time inbox
    new Setting(containerEl)
      .setName("Note at a time")
      .setDesc("Flow processes entire notes one by one in this folder.")
      .addText((text) => {
        text
          .setPlaceholder("Flow Inbox Folder")
          .setValue(this.plugin.settings.inboxFolderPath)
          .onChange((value) => {
            this.plugin.settings.inboxFolderPath = value;
            this.saveSettingsAfterChange();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Processed inbox folder
    new Setting(containerEl)
      .setName("Processed inbox folder")
      .setDesc("Processed notes from the inbox folder are archived here instead of being deleted.")
      .addText((text) => {
        text
          .setPlaceholder("Processed Inbox Folder Notes")
          .setValue(this.plugin.settings.processedInboxFolderPath)
          .onChange((value) => {
            this.plugin.settings.processedInboxFolderPath = value;
            this.saveSettingsAfterChange();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Output Files
    new Setting(containerEl).setHeading().setName("Output Files & Folders");
    containerEl
      .createDiv("setting-item-description")
      .createEl("p", { text: "Configure where processed items should be saved." });

    // Next Actions File
    new Setting(containerEl)
      .setName("Next Actions File")
      .setDesc("File for standalone next actions that aren't part of a project.")
      .addText((text) => {
        text
          .setPlaceholder("Next actions.md")
          .setValue(this.plugin.settings.nextActionsFilePath)
          .onChange((value) => {
            this.plugin.settings.nextActionsFilePath = value;
            this.saveSettingsAfterChange();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });

    // Someday File
    new Setting(containerEl)
      .setName("Someday/Maybe File")
      .setDesc("File for someday/maybe items (things you might do in the future).")
      .addText((text) => {
        text
          .setPlaceholder("Someday.md")
          .setValue(this.plugin.settings.somedayFilePath)
          .onChange((value) => {
            this.plugin.settings.somedayFilePath = value;
            this.saveSettingsAfterChange();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });

    // Projects Folder
    new Setting(containerEl)
      .setName("Projects Folder")
      .setDesc("Folder where new project files will be created.")
      .addText((text) => {
        text
          .setPlaceholder("Projects")
          .setValue(this.plugin.settings.projectsFolderPath)
          .onChange((value) => {
            this.plugin.settings.projectsFolderPath = value;
            this.saveSettingsAfterChange();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Project Template File
    new Setting(containerEl)
      .setName("Project Template File")
      .setDesc(
        "Template file used when creating new projects. Supports {{date}}, {{time}}, {{priority}}, {{status}}, {{sphere}}, and {{description}} variables. Templater syntax is also supported if Templater is installed. See docs/project-templates.md for details."
      )
      .addText((text) => {
        text
          .setPlaceholder("Templates/Project.md")
          .setValue(this.plugin.settings.projectTemplateFilePath)
          .onChange((value) => {
            this.plugin.settings.projectTemplateFilePath = value;
            this.saveSettingsAfterChange();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });

    // People Folder
    new Setting(containerEl)
      .setName("People Folder")
      .setDesc("Folder where new person notes will be created.")
      .addText((text) => {
        text
          .setPlaceholder("People")
          .setValue(this.plugin.settings.personsFolderPath)
          .onChange((value) => {
            this.plugin.settings.personsFolderPath = value;
            this.saveSettingsAfterChange();
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
          .onChange((value) => {
            this.plugin.settings.personTemplateFilePath = value;
            this.saveSettingsAfterChange();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });

    // Default Inbox File
    new Setting(containerEl)
      .setName("Default Inbox File")
      .setDesc(
        "Filename for built-in Flow quick capture (will be created in Flow Inbox Files folder)"
      )
      .addText((text) =>
        text
          .setPlaceholder("Inbox.md")
          .setValue(this.plugin.settings.defaultInboxFile)
          .onChange((value) => {
            this.plugin.settings.defaultInboxFile = value;
            this.saveSettingsAfterChange();
          })
      );

    // Cover Images Folder
    new Setting(containerEl)
      .setName("Cover Images Folder")
      .setDesc("Folder where generated project cover images will be saved")
      .addText((text) => {
        text
          .setPlaceholder("Assets/flow-project-cover-images")
          .setValue(this.plugin.settings.coverImagesFolderPath)
          .onChange((value) => {
            this.plugin.settings.coverImagesFolderPath = value;
            this.saveSettingsAfterChange();
          });
        new FolderPathSuggest(this.app, text.inputEl);
      });

    // Spheres
    new Setting(containerEl).setHeading().setName("Spheres");
    containerEl.createDiv("setting-item-description").createEl("p", {
      text: "Spheres help categorise projects and actions (e.g., personal, work, health).",
    });

    new Setting(containerEl)
      .setName("Spheres")
      .setDesc("Comma-separated list of spheres for categorising your projects and actions.")
      .addText((text) =>
        text
          .setPlaceholder("personal, work, health")
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

    new Setting(containerEl)
      .setName("Context tag prefix")
      .setDesc(
        "Tag prefix for GTD contexts on actions (e.g. #context/home, #context/office). " +
          "Change this to use a different prefix like 'at' for #at/home or 'ctx' for #ctx/office."
      )
      .addText((text) =>
        text
          .setPlaceholder("context")
          .setValue(this.plugin.settings.contextTagPrefix)
          .onChange((value) => {
            this.plugin.settings.contextTagPrefix = value.trim() || "context";
            this.saveSettingsAfterChange();
          })
      );

    // Focus Settings
    new Setting(containerEl).setHeading().setName("Focus");
    containerEl
      .createDiv("setting-item-description")
      .createEl("p", { text: "Configure automatic clearing and archiving of your focus." });

    new Setting(containerEl)
      .setName("Auto-clear time")
      .setDesc(
        'Time to automatically clear the focus daily (e.g., "03:00"). Leave empty to disable auto-clearing.'
      )
      .addText((text) =>
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

    new Setting(containerEl)
      .setName("Archive file")
      .setDesc(
        "File path where cleared focus items will be archived. Disabled if auto-clear is off."
      )
      .addText((text) => {
        text
          .setPlaceholder("Focus Archive.md")
          .setValue(this.plugin.settings.focusArchiveFile)
          .onChange((value) => {
            this.plugin.settings.focusArchiveFile = value.trim();
            this.saveSettingsAfterChange();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });

    // AI Settings
    new Setting(containerEl).setHeading().setName("AI Settings");
    containerEl.createDiv("setting-item-description").createEl("p", {
      text: "Configure OpenRouter for AI-powered cover image generation.",
    });

    const aiSettingsContainer = containerEl.createDiv();

    new Setting(containerEl)
      .setName("Enable AI features")
      .setDesc(
        "Enable AI-powered cover image generation. When disabled, AI functionality is unavailable."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiEnabled).onChange((value) => {
          this.plugin.settings.aiEnabled = value;
          this.saveSettingsAfterChange();
          aiSettingsContainer.classList.toggle("flow-hidden", !value);
        })
      );

    new Setting(aiSettingsContainer)
      .setName("OpenRouter API Key")
      .setDesc("Enter your OpenRouter API key for AI-powered features.")
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
        button.setButtonText("Get API Key").onClick(() => {
          openInActiveWindow("https://openrouter.ai/keys", "_blank");
        })
      );

    new Setting(aiSettingsContainer)
      .setName("OpenRouter Base URL")
      .setDesc("Override the API base URL (defaults to OpenRouter).")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openrouterBaseUrl)
          .setValue(this.plugin.settings.openrouterBaseUrl)
          .onChange((value) => {
            this.plugin.settings.openrouterBaseUrl =
              value.trim() || DEFAULT_SETTINGS.openrouterBaseUrl;
            this.saveSettingsAfterChange();
          })
      );

    new Setting(aiSettingsContainer)
      .setName("Image Model")
      .setDesc("OpenRouter model ID for generating project cover images.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openrouterImageModel)
          .setValue(this.plugin.settings.openrouterImageModel)
          .onChange((value) => {
            this.plugin.settings.openrouterImageModel =
              value.trim() || DEFAULT_SETTINGS.openrouterImageModel;
            this.saveSettingsAfterChange();
          })
      );

    const descEl = aiSettingsContainer.createDiv("setting-item-description");
    const p1 = descEl.createEl("p");
    p1.appendText("Get an API key from ");
    p1.createEl("a", {
      text: "OpenRouter",
      href: "https://openrouter.ai/keys",
      attr: { target: "_blank" },
    });
    p1.appendText(". Your key is stored locally and never shared.");

    // Set initial visibility
    aiSettingsContainer.classList.toggle("flow-hidden", !this.plugin.settings.aiEnabled);
  }

  private saveSettingsAfterChange(): void {
    runAsync(this.plugin.saveSettings(), "Failed to save Flow settings");
  }
}
