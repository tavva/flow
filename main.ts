import { App, Plugin, Notice, WorkspaceLeaf } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "./src/types";
import { FlowGTDSettingTab } from "./src/settings-tab";
import { SphereView, SPHERE_VIEW_TYPE } from "./src/sphere-view";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "./src/inbox-processing-view";
import { ReviewModal } from "./src/review-modal";
import { ConfirmationModal } from "./src/confirmation-modal";
import { cycleTaskStatus } from "./src/task-status-cycler";
import { WaitingForView, WAITING_FOR_VIEW_TYPE } from "./src/waiting-for-view";
import { HotlistView, HOTLIST_VIEW_TYPE } from "./src/hotlist-view";
import { shouldClearHotlist, archiveClearedTasks } from "./src/hotlist-auto-clear";

type InboxCommandConfig = {
  id: string;
  name: string;
};

export default class FlowGTDCoachPlugin extends Plugin {
  settings: PluginSettings;
  private autoClearInterval: number | null = null;

  async onload() {
    await this.loadSettings();

    // Check and clear hotlist if needed
    await this.checkAndClearHotlist();

    // Set up periodic check (every hour)
    this.autoClearInterval = window.setInterval(async () => {
      await this.checkAndClearHotlist();
    }, 60 * 60 * 1000); // 1 hour

    // Register the sphere view
    this.registerView(SPHERE_VIEW_TYPE, (leaf) => {
      // Create with default sphere - will be updated when opened
      return new SphereView(
        leaf,
        this.settings.spheres[0] || "personal",
        this.settings,
        this.saveSettings.bind(this)
      );
    });

    // Register the inbox processing view
    this.registerView(INBOX_PROCESSING_VIEW_TYPE, (leaf) => {
      return new InboxProcessingView(leaf, this.settings);
    });

    // Register the waiting for view
    this.registerView(WAITING_FOR_VIEW_TYPE, (leaf) => new WaitingForView(leaf));

    // Register the hotlist view
    this.registerView(
      HOTLIST_VIEW_TYPE,
      (leaf) => new HotlistView(leaf, this.settings, this.saveSettings.bind(this))
    );

    // Add ribbon icon
    this.addRibbonIcon("inbox", "Flow GTD: Process Inbox", () => {
      this.openInboxProcessingView();
    });

    // Add waiting for ribbon icon
    this.addRibbonIcon("clock", "Open Waiting For view", () => {
      this.activateWaitingForView();
    });

    // Add hotlist ribbon icon
    this.addRibbonIcon("list-checks", "Open Hotlist", () => {
      this.activateHotlistView();
    });

    const inboxCommands: InboxCommandConfig[] = [
      { id: "process-inbox", name: "Process Inbox Files" },
    ];

    inboxCommands.forEach((config) => this.registerInboxCommand(config));
    this.registerSphereCommands();

    // Add project review command
    this.addCommand({
      id: "flow-review-projects",
      name: "Review Projects",
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
      name: "Open Waiting For view",
      callback: () => {
        this.activateWaitingForView();
      },
    });

    // Add hotlist command
    this.addCommand({
      id: "open-hotlist",
      name: "Open Hotlist",
      callback: () => {
        this.activateHotlistView();
      },
    });

    // Add settings tab
    this.addSettingTab(new FlowGTDSettingTab(this.app, this));

    console.log("Flow GTD Coach plugin loaded");
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
    // Detach all hotlist views
    this.app.workspace.detachLeavesOfType(HOTLIST_VIEW_TYPE);
    console.log("Flow GTD Coach plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    if (!this.hasRequiredApiKey()) {
      new Notice(this.getMissingApiKeyMessage());
      return;
    }

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
    if (this.settings.llmProvider === "openai-compatible") {
      return Boolean(this.settings.openaiApiKey);
    }

    return Boolean(this.settings.anthropicApiKey);
  }

  private getMissingApiKeyMessage(): string {
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
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: WAITING_FOR_VIEW_TYPE,
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

  async activateHotlistView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(HOTLIST_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: HOTLIST_VIEW_TYPE,
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

  private async checkAndClearHotlist(): Promise<void> {
    // Check if it's time to clear the hotlist
    if (
      !shouldClearHotlist(
        this.settings.hotlistAutoClearTime,
        this.settings.lastHotlistClearTimestamp
      )
    ) {
      return;
    }

    // Archive the tasks if archive file is configured
    if (this.settings.hotlistArchiveFile && this.settings.hotlist.length > 0) {
      try {
        await archiveClearedTasks(
          this.app.vault,
          this.settings.hotlist,
          this.settings.hotlistArchiveFile,
          new Date()
        );
      } catch (error) {
        console.error("Failed to archive cleared hotlist tasks", error);
      }
    }

    // Clear the hotlist
    this.settings.hotlist = [];
    this.settings.lastHotlistClearTimestamp = Date.now();
    this.settings.hotlistClearedNotificationDismissed = false; // Reset so user sees notification
    await this.saveSettings();
  }
}
