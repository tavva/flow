import { App, Plugin, Notice, WorkspaceLeaf } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "./src/types";
import { FlowGTDSettingTab } from "./src/settings-tab";
import { SphereView, SPHERE_VIEW_TYPE } from "./src/sphere-view";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "./src/inbox-processing-view";
import { ReviewModal } from "./src/review-modal";
import { ConfirmationModal } from "./src/confirmation-modal";

type InboxCommandConfig = {
  id: string;
  name: string;
};

export default class FlowGTDCoachPlugin extends Plugin {
  settings: PluginSettings;

  async onload() {
    await this.loadSettings();

    // Register the sphere view
    this.registerView(SPHERE_VIEW_TYPE, (leaf) => {
      // Create with default sphere - will be updated when opened
      return new SphereView(leaf, this.settings.spheres[0] || "personal", this.settings);
    });

    // Register the inbox processing view
    this.registerView(INBOX_PROCESSING_VIEW_TYPE, (leaf) => {
      return new InboxProcessingView(leaf, this.settings);
    });

    // Add ribbon icon
    this.addRibbonIcon("inbox", "Flow GTD: Process Inbox", () => {
      this.openInboxProcessingView();
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

    // Add settings tab
    this.addSettingTab(new FlowGTDSettingTab(this.app, this));

    console.log("Flow GTD Coach plugin loaded");
  }

  onunload() {
    // Detach all sphere views
    this.app.workspace.detachLeavesOfType(SPHERE_VIEW_TYPE);
    // Detach all inbox processing views
    this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
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
          return;
        }
        // User wants to restart - will reuse the leaf
      }

      // Reveal and refresh the existing view
      this.app.workspace.revealLeaf(leaf);
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
        // Activate the existing view
        this.app.workspace.revealLeaf(leaf);
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
    await view.setSphere(sphere, this.settings);
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
}
