// ABOUTME: Implements the inbox processing view as a full Obsidian tab view
// ABOUTME: Provides view type, display text, and icon for the inbox processing interface
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { InboxModalState, RenderTarget } from "./inbox-modal-state";
import { renderInboxView, renderEditableItemsView } from "./inbox-modal-views";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;
  private state: InboxModalState;
  private renderTimeout?: NodeJS.Timeout;
  private pendingTarget: RenderTarget = "inbox";
  private saveSettings: () => Promise<void>;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    const controller = new InboxProcessingController(this.app, settings, {}, saveSettings);
    this.state = new InboxModalState(controller, settings, (target, options) =>
      this.requestRender(target, options?.immediate === true)
    );
  }

  getViewType(): string {
    return INBOX_PROCESSING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flow Inbox Processing";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-gtd-inbox-modal");

    await this.state.loadReferenceData();

    renderInboxView(container as HTMLElement, this.state, { isLoading: true });
    await this.state.loadInboxItems();
  }

  async onClose() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = undefined;
    }
  }

  private requestRender(target: RenderTarget, immediate = false) {
    if (immediate) {
      this.renderCurrentView(target);
      return;
    }

    this.pendingTarget = target;

    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }

    this.renderTimeout = setTimeout(() => {
      this.renderCurrentView(this.pendingTarget);
      this.renderTimeout = undefined;
    }, 50);
  }

  private renderCurrentView(target: RenderTarget) {
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) {
      return;
    }

    if (target === "editable") {
      renderEditableItemsView(container, this.state, { onClose: () => this.handleClose() });
      return;
    }

    renderInboxView(container, this.state, { isLoading: this.state.isLoadingInbox });
  }

  private handleClose() {
    this.app.workspace.detachLeavesOfType(INBOX_PROCESSING_VIEW_TYPE);
  }

  hasItemsInProgress(): boolean {
    return this.state.editableItems.length > 0;
  }

  async refresh() {
    await this.onOpen();
  }
}
