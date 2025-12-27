import { App, PluginSettingTab, Setting } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { DEFAULT_SETTINGS } from "./types";

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
          .onChange(async (value) => {
            this.plugin.settings.defaultPriority = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.defaultStatus = value;
            await this.plugin.saveSettings();
          })
      );

    // Auto-create cover image
    new Setting(containerEl)
      .setName("Auto-create cover image")
      .setDesc(
        "Automatically generate a cover image when creating new projects during inbox processing"
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoCreateCoverImage).onChange(async (value) => {
          this.plugin.settings.autoCreateCoverImage = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Display cover images on project notes")
      .setDesc("Show cover images on project notes")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.displayCoverImages).onChange(async (value) => {
          this.plugin.settings.displayCoverImages = value;
          await this.plugin.saveSettings();
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
      .addText((text) =>
        text
          .setPlaceholder("Flow Inbox Files")
          .setValue(this.plugin.settings.inboxFilesFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.inboxFilesFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

    // Note-at-a-time inbox
    new Setting(containerEl)
      .setName("Note at a time")
      .setDesc("Flow processes entire notes one by one in this folder.")
      .addText((text) =>
        text
          .setPlaceholder("Flow Inbox Folder")
          .setValue(this.plugin.settings.inboxFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.inboxFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

    // Processed inbox folder
    new Setting(containerEl)
      .setName("Processed inbox folder")
      .setDesc("Processed notes from the inbox folder are archived here instead of being deleted.")
      .addText((text) =>
        text
          .setPlaceholder("Processed Inbox Folder Notes")
          .setValue(this.plugin.settings.processedInboxFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.processedInboxFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

    // Output Files
    new Setting(containerEl).setHeading().setName("Output Files & Folders");
    containerEl
      .createDiv("setting-item-description")
      .createEl("p", { text: "Configure where processed items should be saved." });

    // Next Actions File
    new Setting(containerEl)
      .setName("Next Actions File")
      .setDesc("File for standalone next actions that aren't part of a project.")
      .addText((text) =>
        text
          .setPlaceholder("Next actions.md")
          .setValue(this.plugin.settings.nextActionsFilePath)
          .onChange(async (value) => {
            this.plugin.settings.nextActionsFilePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Someday File
    new Setting(containerEl)
      .setName("Someday/Maybe File")
      .setDesc("File for someday/maybe items (things you might do in the future).")
      .addText((text) =>
        text
          .setPlaceholder("Someday.md")
          .setValue(this.plugin.settings.somedayFilePath)
          .onChange(async (value) => {
            this.plugin.settings.somedayFilePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Projects Folder
    new Setting(containerEl)
      .setName("Projects Folder")
      .setDesc("Folder where new project files will be created.")
      .addText((text) =>
        text
          .setPlaceholder("Projects")
          .setValue(this.plugin.settings.projectsFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.projectsFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

    // Project Template File
    new Setting(containerEl)
      .setName("Project Template File")
      .setDesc(
        "Template file used when creating new projects. Supports {{priority}}, {{sphere}}, and {{description}} variables."
      )
      .addText((text) =>
        text
          .setPlaceholder("Templates/Project.md")
          .setValue(this.plugin.settings.projectTemplateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.projectTemplateFilePath = value;
            await this.plugin.saveSettings();
          })
      );

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
          .onChange(async (value) => {
            this.plugin.settings.defaultInboxFile = value;
            await this.plugin.saveSettings();
          })
      );

    // Cover Images Folder
    new Setting(containerEl)
      .setName("Cover Images Folder")
      .setDesc("Folder where generated project cover images will be saved")
      .addText((text) =>
        text
          .setPlaceholder("Assets/flow-project-cover-images")
          .setValue(this.plugin.settings.coverImagesFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.coverImagesFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

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
          .onChange(async (value) => {
            this.plugin.settings.spheres = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            const trimmed = value.trim();
            // Validate format if not empty
            if (trimmed && !/^\d{1,2}:\d{2}$/.test(trimmed)) {
              // Invalid format, don't save
              return;
            }
            this.plugin.settings.focusAutoClearTime = trimmed;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Archive file")
      .setDesc(
        "File path where cleared focus items will be archived. Disabled if auto-clear is off."
      )
      .addText((text) =>
        text
          .setPlaceholder("Focus Archive.md")
          .setValue(this.plugin.settings.focusArchiveFile)
          .onChange(async (value) => {
            this.plugin.settings.focusArchiveFile = value.trim();
            await this.plugin.saveSettings();
          })
      );

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
        toggle.setValue(this.plugin.settings.aiEnabled).onChange(async (value) => {
          this.plugin.settings.aiEnabled = value;
          await this.plugin.saveSettings();
          aiSettingsContainer.style.display = value ? "" : "none";
        })
      );

    new Setting(aiSettingsContainer)
      .setName("OpenRouter API Key")
      .setDesc("Enter your OpenRouter API key for AI-powered features.")
      .addText((text) => {
        text
          .setPlaceholder("sk-or-v1-...")
          .setValue(this.plugin.settings.openrouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openrouterApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      })
      .addButton((button) =>
        button.setButtonText("Get API Key").onClick(() => {
          window.open("https://openrouter.ai/keys", "_blank");
        })
      );

    new Setting(aiSettingsContainer)
      .setName("OpenRouter Base URL")
      .setDesc("Override the API base URL (defaults to OpenRouter).")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openrouterBaseUrl)
          .setValue(this.plugin.settings.openrouterBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openrouterBaseUrl =
              value.trim() || DEFAULT_SETTINGS.openrouterBaseUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(aiSettingsContainer)
      .setName("Image Model")
      .setDesc("OpenRouter model ID for generating project cover images.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openrouterImageModel)
          .setValue(this.plugin.settings.openrouterImageModel)
          .onChange(async (value) => {
            this.plugin.settings.openrouterImageModel =
              value.trim() || DEFAULT_SETTINGS.openrouterImageModel;
            await this.plugin.saveSettings();
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
    aiSettingsContainer.style.display = this.plugin.settings.aiEnabled ? "" : "none";
  }
}
