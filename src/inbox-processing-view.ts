// ABOUTME: Implements the inbox processing view as a full Obsidian tab view
// ABOUTME: Provides view type, display text, and icon for the inbox processing interface
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { InboxModalState, RenderTarget } from "./inbox-modal-state";
import { renderInboxView, renderEditableItemsView } from "./inbox-modal-views";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;
  private state: InboxModalState;
  private renderTimeout?: NodeJS.Timeout;
  private pendingTarget: RenderTarget = "inbox";
  private pendingFocus: string | null = null;
  private saveSettings: () => Promise<void>;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    const controller = new InboxProcessingController(this.app, settings, {}, saveSettings);
    this.state = new InboxModalState(this.app, controller, settings, (target, options) =>
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
    const container = this.contentEl;
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
    const container = this.contentEl;
    if (!container) {
      return;
    }

    if (target === "editable") {
      renderEditableItemsView(container, this.state, {
        onClose: () => this.handleClose(),
        onShowHelp: () => new KeyboardShortcutsModal(this.app).open(),
      });

      if (this.pendingFocus) {
        const selector = this.pendingFocus;
        // Small timeout to ensure DOM is ready and layout is settled
        setTimeout(() => {
          const element = container.querySelector(selector) as HTMLElement;
          if (element) {
            element.focus();
          }
        }, 0);
        this.pendingFocus = null;
      }
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
    const expandedItem = this.state.editableItems.find((item) => item.isExpanded);
    const currentIndex = this.state.editableItems.findIndex((item) => item.isExpanded);

    // Ctrl+Shift+Q blurs the input without closing the view
    if (event.key.toLowerCase() === "q" && event.ctrlKey && event.shiftKey && !event.metaKey) {
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        target.blur();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Ctrl+Shift+Enter saves the current item
    if (event.key === "Enter" && event.ctrlKey && event.shiftKey && !event.metaKey) {
      if (expandedItem) {
        this.state.saveAndRemoveItem(expandedItem);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Arrow keys for navigation (when not in input)
    if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
      if (event.key === "ArrowLeft" && currentIndex > 0) {
        this.navigateToItem(currentIndex - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight" && currentIndex < this.state.editableItems.length - 1) {
        this.navigateToItem(currentIndex + 1);
        event.preventDefault();
        return;
      }
    }

    // Ctrl+Shift+1, Ctrl+Shift+2, etc. to toggle sphere selection
    if (event.ctrlKey && event.shiftKey && !event.metaKey && /^[1-9]$/.test(event.key)) {
      if (expandedItem) {
        const spheres = this.settings.spheres;
        const sphereIndex = parseInt(event.key) - 1;

        // Check if this action type shows sphere selector (next or someday)
        const simplified = this.getSimplifiedAction(expandedItem);
        const showsSphereSelector = simplified === "next" || simplified === "someday";

        if (showsSphereSelector && sphereIndex >= 0 && sphereIndex < spheres.length) {
          const sphere = spheres[sphereIndex];
          if (expandedItem.selectedSpheres.includes(sphere)) {
            expandedItem.selectedSpheres = expandedItem.selectedSpheres.filter((s) => s !== sphere);
          } else {
            expandedItem.selectedSpheres.push(sphere);
          }
          this.state.queueRender("editable");
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }

    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    if (!expandedItem) return;

    // Enter focuses the first action input
    if (event.key === "Enter") {
      const container = this.contentEl;
      const firstActionInput = container?.querySelector(
        ".flow-inbox-action-input"
      ) as HTMLInputElement;
      if (firstActionInput) {
        firstActionInput.focus();
        event.preventDefault();
      }
      return;
    }

    // Show keyboard shortcuts help
    if (event.key === "?") {
      new KeyboardShortcutsModal(this.app).open();
      event.preventDefault();
      return;
    }

    // Number keys 1-9 to toggle sphere selection (when not in input)
    if (/^[1-9]$/.test(event.key)) {
      const spheres = this.settings.spheres;
      const sphereIndex = parseInt(event.key) - 1;

      const simplified = this.getSimplifiedAction(expandedItem);
      const showsSphereSelector = simplified === "next" || simplified === "someday";

      if (showsSphereSelector && sphereIndex >= 0 && sphereIndex < spheres.length) {
        const sphere = spheres[sphereIndex];
        if (expandedItem.selectedSpheres.includes(sphere)) {
          expandedItem.selectedSpheres = expandedItem.selectedSpheres.filter((s) => s !== sphere);
        } else {
          expandedItem.selectedSpheres.push(sphere);
        }
        this.state.queueRender("editable");
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Quick type switching with single keys
    switch (event.key.toLowerCase()) {
      case "n":
        expandedItem.selectedAction = "next-actions-file";
        this.state.queueRender("editable");
        event.preventDefault();
        break;
      case "s":
        expandedItem.selectedAction = "someday-file";
        this.state.queueRender("editable");
        event.preventDefault();
        break;
      case "r":
        expandedItem.selectedAction = "reference";
        this.state.queueRender("editable");
        event.preventDefault();
        break;
      case "d":
        this.state.confirmAndDiscardItem(expandedItem);
        event.preventDefault();
        break;
      case "p": {
        const projectInput = this.containerEl.querySelector(
          ".flow-inbox-project-input"
        ) as HTMLInputElement;
        if (projectInput) {
          projectInput.focus();
        }
        event.preventDefault();
        break;
      }
    }
  };

  private navigateToItem(targetIndex: number) {
    this.state.editableItems.forEach((item, i) => {
      item.isExpanded = i === targetIndex;
    });
    this.state.queueRender("editable");
  }

  private getSimplifiedAction(
    item: { selectedAction: string } | undefined
  ): "next" | "someday" | "reference" {
    if (!item) return "next";
    switch (item.selectedAction) {
      case "create-project":
      case "add-to-project":
      case "next-actions-file":
      case "person":
        return "next";
      case "someday-file":
        return "someday";
      case "reference":
      case "trash":
        return "reference";
      default:
        return "next";
    }
  }
}
