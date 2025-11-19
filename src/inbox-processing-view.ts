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

    renderInboxView(container as HTMLElement, this.state, { isLoading: true });

    await this.state.loadReferenceData();
    await this.state.loadInboxItems();

    window.addEventListener("keydown", this.handleKeyDown);
  }

  async onClose() {
    window.removeEventListener("keydown", this.handleKeyDown);
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

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.app.workspace.getActiveViewOfType(InboxProcessingView) !== this) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    const expandedItem = this.state.editableItems.find((item) => item.isExpanded);
    if (!expandedItem) return;

    let action: string | undefined;
    switch (event.key.toLowerCase()) {
      case "c":
        action = "create-project";
        break;
      case "a":
        action = "add-to-project";
        break;
      case "r":
        action = "reference";
        break;
      case "n":
        action = "next-actions-file";
        break;
      case "s":
        action = "someday-file";
        break;
      case "p":
        action = "person";
        break;
      case "t":
        action = "trash";
        break;
    }

    if (action) {
      expandedItem.selectedAction = action as any;
      this.state.queueRender("editable");
      event.preventDefault();
    }
  };
}
