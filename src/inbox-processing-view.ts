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
  private pendingFocus: string | null = null;
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

    // Ctrl+Q (or Cmd+Q on Mac) blurs the input without closing the view
    if (event.key === "q" && (event.ctrlKey || event.metaKey)) {
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        target.blur();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Ctrl+S (or Cmd+S on Mac) saves the current item
    if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
      if (expandedItem) {
        this.state.saveAndRemoveItem(expandedItem);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Ctrl+1, Ctrl+2, etc. to toggle sphere selection
    if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
      if (expandedItem) {
        const spheres = this.settings.spheres;
        const sphereIndex = parseInt(event.key) - 1;

        // Check if this action type shows sphere selector
        const showsSphereSelector =
          expandedItem.selectedAction !== "add-to-project" &&
          expandedItem.selectedAction !== "reference" &&
          expandedItem.selectedAction !== "trash";

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

    // Ctrl+F to toggle "Add to focus" checkbox
    if (event.key === "f" && (event.ctrlKey || event.metaKey)) {
      if (expandedItem) {
        // Check if this action type shows focus checkbox
        const showsFocusCheckbox =
          expandedItem.selectedAction === "create-project" ||
          expandedItem.selectedAction === "add-to-project" ||
          expandedItem.selectedAction === "next-actions-file";

        if (showsFocusCheckbox) {
          expandedItem.addToFocus = !expandedItem.addToFocus;
          // Mutual exclusion with markAsDone
          if (expandedItem.addToFocus && expandedItem.markAsDone && expandedItem.markAsDone[0]) {
            expandedItem.markAsDone[0] = false;
          }
          this.state.queueRender("editable");
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }

    // Ctrl+D to toggle "Mark as done" checkbox
    if (event.key === "d" && (event.ctrlKey || event.metaKey)) {
      if (expandedItem) {
        // Check if this action type shows focus checkbox (same as above)
        const showsFocusCheckbox =
          expandedItem.selectedAction === "create-project" ||
          expandedItem.selectedAction === "add-to-project" ||
          expandedItem.selectedAction === "next-actions-file";

        if (showsFocusCheckbox) {
          // Initialize markAsDone array if not exists
          if (!expandedItem.markAsDone) {
            expandedItem.markAsDone = [];
          }
          expandedItem.markAsDone[0] = !expandedItem.markAsDone[0];
          // Mutual exclusion with addToFocus
          if (expandedItem.markAsDone[0] && expandedItem.addToFocus) {
            expandedItem.addToFocus = false;
          }
          this.state.queueRender("editable");
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }

    // Ctrl+T to toggle date section
    if (event.key === "t" && (event.ctrlKey || event.metaKey)) {
      if (expandedItem) {
        // Check if this action type shows date section (all except reference and trash)
        const showsDateSection =
          expandedItem.selectedAction !== "reference" && expandedItem.selectedAction !== "trash";

        if (showsDateSection) {
          expandedItem.isDateSectionExpanded = !expandedItem.isDateSectionExpanded;
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

    let action: string | undefined;
    switch (event.key.toLowerCase()) {
      case "c":
        action = "create-project";
        this.pendingFocus = ".flow-gtd-project-input";
        break;
      case "a":
        action = "add-to-project";
        this.pendingFocus = ".flow-gtd-project-search";
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
