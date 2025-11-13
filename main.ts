import { App, Plugin, Notice, WorkspaceLeaf } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS, CoachState } from "./src/types";
import { FlowGTDSettingTab } from "./src/settings-tab";
import { SphereView, SPHERE_VIEW_TYPE } from "./src/sphere-view";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "./src/inbox-processing-view";
import { ReviewModal } from "./src/review-modal";
import { ConfirmationModal } from "./src/confirmation-modal";
import { cycleTaskStatus } from "./src/task-status-cycler";
import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "./src/waiting-for-view";
import { FocusView, FOCUS_VIEW_TYPE } from "./src/focus-view";
import { FlowCoachView, FLOW_COACH_VIEW_TYPE } from "./src/flow-coach-view";
import { shouldClearFocus, archiveClearedTasks } from "./src/focus-auto-clear";
import { registerFocusEditorMenu } from "./src/focus-editor-menu";
import { loadFocusItems, saveFocusItems } from "./src/focus-persistence";
import { generateCoverImage } from "./src/cover-image-generator";

type InboxCommandConfig = {
  id: string;
  name: string;
};

export default class FlowGTDCoachPlugin extends Plugin {
  settings: PluginSettings;
  coachState: CoachState = {
    conversations: [],
    activeConversationId: null,
  };
  private autoClearInterval: number | null = null;

  async onload() {
    await this.loadSettings();

    // Migrate focus from settings to file (one-time migration)
    await this.migrateFocusToFile();

    // Check and clear focus if needed
    await this.checkAndClearFocus();

    // Set up periodic check (every hour)
    this.autoClearInterval = window.setInterval(
      async () => {
        await this.checkAndClearFocus();
      },
      60 * 60 * 1000
    ); // 1 hour

    // Register the sphere view
    this.registerView(SPHERE_VIEW_TYPE, (leaf) => {
      // Check if there's saved state for this leaf
      const state = (leaf as any).getViewState?.()?.state;
      const sphere = state?.sphere || this.settings.spheres[0] || "personal";

      return new SphereView(leaf, sphere, this.settings, this.saveSettings.bind(this));
    });

    // Register the inbox processing view
    this.registerView(INBOX_PROCESSING_VIEW_TYPE, (leaf) => {
      return new InboxProcessingView(leaf, this.settings, this.saveSettings.bind(this));
    });

    // Register the waiting for view
    this.registerView(
      WAITING_FOR_VIEW_TYPE,
      (leaf) => new WaitingForView(leaf, this.settings, this.saveSettings.bind(this))
    );

    // Register the focus view
    this.registerView(
      FOCUS_VIEW_TYPE,
      (leaf) => new FocusView(leaf, this.settings, this.saveSettings.bind(this))
    );

    // Register the Flow Coach view
    this.registerView(
      FLOW_COACH_VIEW_TYPE,
      (leaf) =>
        new FlowCoachView(
          leaf,
          this.settings,
          () => this.saveSettings(),
          () => this.coachState,
          (state) => {
            this.coachState = state;
          }
        )
    );

    // Add ribbon icon
    this.addRibbonIcon("inbox", "Flow: Process Inbox", () => {
      this.openInboxProcessingView();
    });

    // Add waiting for ribbon icon
    this.addRibbonIcon("clock", "Open Waiting For view", () => {
      this.activateWaitingForView();
    });

    // Add focus ribbon icon
    this.addRibbonIcon("list-checks", "Open Focus", () => {
      this.activateFocusView();
    });

    const inboxCommands: InboxCommandConfig[] = [
      { id: "process-inbox", name: "Process inbox files" },
    ];

    inboxCommands.forEach((config) => this.registerInboxCommand(config));
    this.registerSphereCommands();

    // Add project review command
    this.addCommand({
      id: "flow-review-projects",
      name: "Review projects",
      callback: () => {
        this.openReviewModal();
      },
    });

    // Add cycle task status command
    this.addCommand({
      id: "cycle-task-status",
      name: "Cycle task status",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const cycled = cycleTaskStatus(line);

        if (cycled) {
          editor.setLine(cursor.line, cycled);
        }
      },
    });

    // Add waiting for view command
    this.addCommand({
      id: "open-waiting-for-view",
      name: "Open waiting for view",
      callback: () => {
        this.activateWaitingForView();
      },
    });

    // Add focus command
    this.addCommand({
      id: "open-focus",
      name: "Open focus",
      callback: () => {
        this.activateFocusView();
      },
    });

    // Add Flow Coach command
    this.addCommand({
      id: "open-flow-coach",
      name: "Open Flow Coach",
      callback: () => {
        this.activateFlowCoachView();
      },
    });

    // Add generate cover image command
    this.addCommand({
      id: "generate-cover-image",
      name: "Generate cover image for current project",
      callback: async () => {
        // Check if AI is enabled (cover image generation requires AI)
        if (!this.settings.aiEnabled) {
          new Notice(
            "AI features are disabled. Please enable AI in the plugin settings to use this feature."
          );
          return;
        }

        // Check if API key is configured
        if (!this.hasRequiredApiKey()) {
          new Notice(this.getMissingApiKeyMessage());
          return;
        }

        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
          new Notice("No active file. Please open a project file.");
          return;
        }

        // Check if file is in projects folder
        if (!activeFile.path.startsWith(this.settings.projectsFolderPath)) {
          new Notice(`File is not in the projects folder (${this.settings.projectsFolderPath})`);
          return;
        }

        try {
          new Notice("Generating cover image...");
          const result = await generateCoverImage(this.app.vault, activeFile, this.settings);
          new Notice(`Cover image generated successfully: ${result.imagePath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          new Notice(`Failed to generate cover image: ${errorMessage}`);
        }
      },
    });

    // Register focus editor menu (right-click context menu)
    this.registerEvent(
      registerFocusEditorMenu(
        this.app,
        this.settings,
        this.saveSettings.bind(this),
        this.refreshFocusView.bind(this)
      )
    );

    // Add settings tab
    this.addSettingTab(new FlowGTDSettingTab(this.app, this));
  }

  onunload() {
    // Clear the auto-clear interval
    if (this.autoClearInterval !== null) {
      window.clearInterval(this.autoClearInterval);
      this.autoClearInterval = null;
    }

    // Detach all sphere views
    this.app.workspace.detachLeavesOfType(SPHERE_VIEW_TYPE);
    // Detach all inbox processing views
    this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
    // Detach all waiting for views
    this.app.workspace.detachLeavesOfType(WAITING_FOR_VIEW_TYPE);
    // Detach all focus views
    this.app.workspace.detachLeavesOfType(FOCUS_VIEW_TYPE);
    // Detach all Flow Coach views
    this.app.workspace.detachLeavesOfType(FLOW_COACH_VIEW_TYPE);
  }

  async loadSettings() {
    const data = await this.loadData();
    if (data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || data);
      this.coachState = data.coachState || {
        conversations: [],
        activeConversationId: null,
      };
    }
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      coachState: this.coachState,
    });
  }

  private registerInboxCommand(config: InboxCommandConfig) {
    this.addCommand({
      id: config.id,
      name: config.name,
      callback: () => {
        this.openInboxProcessingView();
      },
    });
  }

  private registerSphereCommands() {
    const spheres = this.settings.spheres;
    spheres.forEach((sphere) => {
      const normalizedId = sphere
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      this.addCommand({
        id: `sphere-view-${normalizedId || "default"}`,
        name: `Open ${this.getDisplaySphereName(sphere)} sphere`,
        callback: () => {
          this.openSphereView(sphere);
        },
      });
    });
  }

  private async openInboxProcessingView() {
    // No API key required - inbox processing is manual only (AI was removed)

    // Check if inbox processing view already exists
    const existingLeaves = this.app.workspace.getLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);

    if (existingLeaves.length > 0) {
      const leaf = existingLeaves[0];
      const view = leaf.view as InboxProcessingView;

      // Check if view has items in progress
      if (view.hasItemsInProgress()) {
        const shouldRestart = await this.confirmRestart();
        if (!shouldRestart) {
          // Just reveal the existing view
          this.app.workspace.revealLeaf(leaf);
          this.app.workspace.setActiveLeaf(leaf, { focus: true });
          return;
        }
        // User wants to restart - will reuse the leaf
      }

      // Reveal and refresh the existing view
      this.app.workspace.revealLeaf(leaf);
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
      await view.refresh();
      return;
    }

    // No existing view, create new one
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: INBOX_PROCESSING_VIEW_TYPE,
      active: true,
    });
  }

  private async confirmRestart(): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmationModal(
        this.app,
        "Restart inbox processing?",
        "You have items in progress. Starting a new session will discard your current work.",
        () => resolve(true),
        () => resolve(false)
      );
      modal.open();
    });
  }

  private async openSphereView(sphere: string) {
    // Check if a sphere view is already open for this sphere
    const existingLeaves = this.app.workspace.getLeavesOfType(SPHERE_VIEW_TYPE);
    for (const leaf of existingLeaves) {
      const view = leaf.view as SphereView;
      // Check if this view is for the same sphere
      if (view.getDisplayText().toLowerCase().includes(sphere.toLowerCase())) {
        // Activate and refresh the existing view
        this.app.workspace.revealLeaf(leaf);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
        await view.onOpen(); // Refresh the view with latest data
        // Open focus if not already open
        await this.activateFocusView();
        return;
      }
    }

    // No existing view found, create a new one
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: SPHERE_VIEW_TYPE,
      active: true,
    });

    // Update the view with the correct sphere
    const view = leaf.view as SphereView;
    await view.setSphere(sphere, this.settings, this.saveSettings.bind(this));

    // Open focus if not already open
    await this.activateFocusView();
  }

  private getDisplaySphereName(sphere: string): string {
    return sphere
      .split(/[-_\s]+/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .trim();
  }

  private hasRequiredApiKey(): boolean {
    // When AI is disabled, no API key is required
    if (!this.settings.aiEnabled) {
      return true;
    }

    if (this.settings.llmProvider === "openai-compatible") {
      return Boolean(this.settings.openaiApiKey);
    }

    return Boolean(this.settings.anthropicApiKey);
  }

  private getMissingApiKeyMessage(): string {
    if (!this.settings.aiEnabled) {
      return "AI features are disabled. Please enable AI in the plugin settings to use this feature.";
    }
    return "Please set your API key in the plugin settings first";
  }

  private openReviewModal() {
    if (!this.hasRequiredApiKey()) {
      new Notice(this.getMissingApiKeyMessage());
      return;
    }

    const modal = new ReviewModal(this.app, this.settings);
    modal.open();
  }

  async activateWaitingForView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(WAITING_FOR_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({
        type: WAITING_FOR_VIEW_TYPE,
        active: true,
      });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      workspace.setActiveLeaf(leaf, { focus: true });
    }
  }

  async activateFocusView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(FOCUS_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: FOCUS_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      workspace.setActiveLeaf(leaf, { focus: true });
    }
  }

  async activateFlowCoachView() {
    if (!this.hasRequiredApiKey()) {
      new Notice(this.getMissingApiKeyMessage());
      return;
    }

    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(FLOW_COACH_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already exists, activate it
      leaf = leaves[0];
    } else {
      // Create new view in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: FLOW_COACH_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async migrateFocusToFile(): Promise<void> {
    // Check if settings has focus items (old storage)
    if (this.settings.focus && this.settings.focus.length > 0) {
      try {
        // Save to file
        await saveFocusItems(this.app.vault, this.settings.focus);

        // Clear from settings
        this.settings.focus = [];
        await this.saveSettings();

        console.log("Migrated focus items from settings to file");
      } catch (error) {
        console.error("Failed to migrate focus items to file", error);
      }
    }
  }

  private async checkAndClearFocus(): Promise<void> {
    // Check if it's time to clear the focus
    if (
      !shouldClearFocus(this.settings.focusAutoClearTime, this.settings.lastFocusClearTimestamp)
    ) {
      return;
    }

    // Load focus items
    const focusItems = await loadFocusItems(this.app.vault);

    // Archive the tasks if archive file is configured
    let archiveSucceeded = false;
    if (this.settings.focusArchiveFile && focusItems.length > 0) {
      try {
        await archiveClearedTasks(
          this.app.vault,
          focusItems,
          this.settings.focusArchiveFile,
          new Date()
        );
        archiveSucceeded = true;
      } catch (error) {
        console.error("Failed to archive cleared focus tasks", error);
        archiveSucceeded = false;
      }
    }

    // Clear the focus
    await saveFocusItems(this.app.vault, []);
    this.settings.lastFocusClearTimestamp = Date.now();
    this.settings.lastFocusArchiveSucceeded = archiveSucceeded;
    this.settings.focusClearedNotificationDismissed = false; // Reset so user sees notification
    await this.saveSettings();
  }

  private async refreshFocusView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(FOCUS_VIEW_TYPE);

    if (leaves.length > 0) {
      for (const leaf of leaves) {
        if (leaf.view && "onOpen" in leaf.view) {
          await (leaf.view as any).onOpen();
        }
      }
    }
  }
}
