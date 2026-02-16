import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import FlowGTDCoachPlugin from "../main";
import { DEFAULT_SETTINGS, LLMProvider } from "./types";
import { validateApiKey } from "./validation";
import { FolderPathSuggest, FilePathSuggest } from "./suggesters";

export class FlowGTDSettingTab extends PluginSettingTab {
  plugin: FlowGTDCoachPlugin;

  constructor(app: App, plugin: FlowGTDCoachPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // AI Enable/Disable Toggle
    new Setting(containerEl)
      .setName("Enable AI features")
      .setDesc(
        "Enable AI-powered inbox processing and project review. When disabled, all AI functionality is unavailable."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiEnabled).onChange(async (value) => {
          this.plugin.settings.aiEnabled = value;
          await this.plugin.saveSettings();
          updateProviderVisibility();
        })
      );

    const providerDropdownContainer = containerEl.createDiv();
    new Setting(providerDropdownContainer)
      .setName("AI Provider")
      .setDesc("Choose which language model to use for GTD processing.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "openai-compatible": "OpenAI-compatible (e.g. OpenRouter)",
            anthropic: "Anthropic Messages API",
          })
          .setValue(this.plugin.settings.llmProvider)
          .onChange(async (value) => {
            this.plugin.settings.llmProvider = value as LLMProvider;
            await this.plugin.saveSettings();
            updateProviderVisibility();
          })
      );

    const anthropicContainer = containerEl.createDiv();
    const openAIContainer = containerEl.createDiv();

    new Setting(anthropicContainer)
      .setName("Anthropic API Key")
      .setDesc("Enter your Anthropic API key to enable AI-powered GTD processing")
      .addText((text) => {
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
              const validation = validateApiKey(trimmed);
              if (!validation.valid) {
                new Notice(validation.error || "Invalid API key format");
                return;
              }
            }
            this.plugin.settings.anthropicApiKey = trimmed;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      })
      .addButton((button) =>
        button.setButtonText("Get API Key").onClick(() => {
          window.open("https://console.anthropic.com/settings/keys", "_blank");
        })
      );

    new Setting(anthropicContainer)
      .setName("Anthropic Model")
      .setDesc(
        "Specify the Anthropic Messages API model ID to use for GTD processing (e.g., claude-sonnet-4-20250514)."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.anthropicModel)
          .setValue(this.plugin.settings.anthropicModel)
          .onChange(async (value) => {
            const trimmedValue = value.trim() || DEFAULT_SETTINGS.anthropicModel;
            this.plugin.settings.anthropicModel = trimmedValue;
            await this.plugin.saveSettings();
          })
      );

    const anthropicDesc = anthropicContainer.createDiv("setting-item-description");
    const anthropicP1 = anthropicDesc.createEl("p");
    anthropicP1.appendText("You can get your API key from ");
    anthropicP1.createEl("a", {
      text: "Anthropic Console",
      href: "https://console.anthropic.com/settings/keys",
      attr: { target: "_blank" },
    });
    anthropicP1.appendText(".");
    const anthropicP2 = anthropicDesc.createEl("p");
    anthropicP2.createEl("strong", { text: "Note:" });
    anthropicP2.appendText(" Your API key is stored locally and never shared.");

    new Setting(openAIContainer)
      .setName("OpenAI-compatible API Key")
      .setDesc("Enter the API key for your OpenAI-compatible provider (e.g., OpenRouter).")
      .addText((text) => {
        text
          .setPlaceholder("sk-or-v1-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(openAIContainer)
      .setName("OpenAI-compatible Base URL")
      .setDesc("Override the API base URL (use https://openrouter.ai/api/v1 for OpenRouter).")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openaiBaseUrl)
          .setValue(this.plugin.settings.openaiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openaiBaseUrl = value.trim() || DEFAULT_SETTINGS.openaiBaseUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(openAIContainer)
      .setName("OpenAI-compatible Model")
      .setDesc("Specify the model ID to use with your OpenAI-compatible provider.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openaiModel)
          .setValue(this.plugin.settings.openaiModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiModel = value.trim() || DEFAULT_SETTINGS.openaiModel;
            await this.plugin.saveSettings();
          })
      );

    new Setting(openAIContainer)
      .setName("OpenRouter Image Model")
      .setDesc("Specify the OpenRouter model ID to use for image generation.")
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

    const openAIDesc = openAIContainer.createDiv("setting-item-description");
    const openAIP1 = openAIDesc.createEl("p");
    openAIP1.appendText("OpenRouter requires the ");
    openAIP1.createEl("code", { text: "HTTP-Referer" });
    openAIP1.appendText(" and ");
    openAIP1.createEl("code", { text: "X-Title" });
    openAIP1.appendText(
      " headers. This plugin sends them automatically when the base URL contains "
    );
    openAIP1.createEl("code", { text: "openrouter.ai" });
    openAIP1.appendText(".");
    const openAIP2 = openAIDesc.createEl("p");
    openAIP2.createEl("strong", { text: "Note:" });
    openAIP2.appendText(" API keys are stored locally on your device.");

    const updateProviderVisibility = () => {
      const aiEnabled = this.plugin.settings.aiEnabled;
      const isAnthropic = this.plugin.settings.llmProvider === "anthropic";

      // Show/hide all AI-related settings based on AI enabled state
      providerDropdownContainer.style.display = aiEnabled ? "" : "none";
      anthropicContainer.style.display = aiEnabled && isAnthropic ? "" : "none";
      openAIContainer.style.display = aiEnabled && !isAnthropic ? "" : "none";
    };

    updateProviderVisibility();

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
      .addText((text) => {
        text
          .setPlaceholder("Flow Inbox Files")
          .setValue(this.plugin.settings.inboxFilesFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.inboxFilesFolderPath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.inboxFolderPath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.processedInboxFolderPath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.nextActionsFilePath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.somedayFilePath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.projectsFolderPath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.projectTemplateFilePath = value;
            await this.plugin.saveSettings();
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
      .addText((text) => {
        text
          .setPlaceholder("Assets/flow-project-cover-images")
          .setValue(this.plugin.settings.coverImagesFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.coverImagesFolderPath = value;
            await this.plugin.saveSettings();
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
          .onChange(async (value) => {
            this.plugin.settings.spheres = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
            this.plugin.updateSphereCommands();
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
      .addText((text) => {
        text
          .setPlaceholder("Focus Archive.md")
          .setValue(this.plugin.settings.focusArchiveFile)
          .onChange(async (value) => {
            this.plugin.settings.focusArchiveFile = value.trim();
            await this.plugin.saveSettings();
          });
        new FilePathSuggest(this.app, text.inputEl, ["md"]);
      });
  }
}
