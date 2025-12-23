// ABOUTME: Implements the inbox processing view as a full Obsidian tab view
// ABOUTME: Provides view type, display text, and icon for the inbox processing interface
import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { InboxModalState, RenderTarget } from "./inbox-modal-state";
import { renderInboxView, renderListPane, renderDetailPane } from "./inbox-modal-views";

export const INBOX_PROCESSING_VIEW_TYPE = "flow-gtd-inbox-processing";

export class InboxProcessingView extends ItemView {
  private settings: PluginSettings;
  private state: InboxModalState;
  private renderTimeout?: NodeJS.Timeout;
  private pendingTarget: RenderTarget = "inbox";
  private pendingFocus: string | null = null;
  private saveSettings: () => Promise<void>;
  private showingHelp = false;

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
      this.renderTwoPaneView(container);

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

  private renderTwoPaneView(container: HTMLElement) {
    container.empty();
    container.addClass("flow-gtd-inbox-modal");

    // Completion state - all items processed
    if (this.state.editableItems.length === 0) {
      const completionEl = container.createDiv("flow-gtd-completion");
      completionEl.createEl("h3", { text: "🎉 All items processed!" });
      completionEl.createEl("p", { text: "Your inbox is now empty." });

      const closeBtn = completionEl.createEl("button", {
        text: "Close",
        cls: "mod-cta",
      });
      closeBtn.addEventListener("click", () => this.handleClose());
      return;
    }

    // Two-pane container
    const twoPaneContainer = container.createDiv("flow-inbox-container");

    // Apply view mode class for narrow viewports
    twoPaneContainer.classList.add(this.state.viewMode === "list" ? "view-list" : "view-detail");

    // List pane
    const listPane = twoPaneContainer.createDiv();
    renderListPane(listPane, this.state, {
      onRefresh: () => this.refresh(),
      onItemSelect: () => {
        // On narrow viewports, switch to detail view when item selected
        if (window.innerWidth < 800) {
          this.state.showDetail();
        }
      },
    });

    // Detail pane
    const detailPane = twoPaneContainer.createDiv();
    renderDetailPane(detailPane, this.state, {
      showBack: window.innerWidth < 800,
      onBack: () => this.state.showList(),
      onSave: (item) => this.state.saveAndRemoveItem(item),
      onDiscard: (item) => this.state.discardItem(item),
    });
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
    const selectedItem = this.state.selectedItem;

    // ? shows keyboard shortcuts help
    if (event.key === "?") {
      this.toggleHelp();
      event.preventDefault();
      return;
    }

    // Escape closes help overlay if showing
    if (event.key === "Escape" && this.showingHelp) {
      this.toggleHelp();
      event.preventDefault();
      return;
    }

    // Ctrl+Q (or Cmd+Q on Mac) blurs the input without closing the view
    if (event.key === "q" && (event.ctrlKey || event.metaKey)) {
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        target.blur();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Ctrl+Enter (or Cmd+Enter on Mac) saves the current item
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      if (selectedItem) {
        this.state.saveAndRemoveItem(selectedItem);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Arrow keys for item navigation
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (
        target.tagName !== "INPUT" &&
        target.tagName !== "TEXTAREA" &&
        !target.isContentEditable
      ) {
        const delta = event.key === "ArrowUp" ? -1 : 1;
        const newIndex = this.state.selectedIndex + delta;
        if (newIndex >= 0 && newIndex < this.state.editableItems.length) {
          this.state.selectItem(newIndex);
          event.preventDefault();
        }
      }
      return;
    }

    // Ctrl+1, Ctrl+2, etc. to toggle sphere selection
    if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
      if (selectedItem) {
        const spheres = this.settings.spheres;
        const sphereIndex = parseInt(event.key) - 1;

        // Check if this action type shows sphere selector
        const showsSphereSelector =
          selectedItem.selectedAction !== "add-to-project" &&
          selectedItem.selectedAction !== "reference" &&
          selectedItem.selectedAction !== "trash";

        if (showsSphereSelector && sphereIndex >= 0 && sphereIndex < spheres.length) {
          const sphere = spheres[sphereIndex];
          if (selectedItem.selectedSpheres.includes(sphere)) {
            selectedItem.selectedSpheres = selectedItem.selectedSpheres.filter((s) => s !== sphere);
          } else {
            selectedItem.selectedSpheres.push(sphere);
          }
          this.state.queueRender("editable");
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }

    // Ctrl+J to toggle "Add to focus" checkbox
    if (event.key === "j" && (event.ctrlKey || event.metaKey)) {
      if (selectedItem) {
        // Check if this action type shows focus checkbox
        const showsFocusCheckbox =
          selectedItem.selectedAction === "create-project" ||
          selectedItem.selectedAction === "add-to-project" ||
          selectedItem.selectedAction === "next-actions-file";

        if (showsFocusCheckbox) {
          selectedItem.addToFocus = !selectedItem.addToFocus;
          // Mutual exclusion with markAsDone
          if (selectedItem.addToFocus && selectedItem.markAsDone && selectedItem.markAsDone[0]) {
            selectedItem.markAsDone[0] = false;
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
      if (selectedItem) {
        // Check if this action type shows focus checkbox (same as above)
        const showsFocusCheckbox =
          selectedItem.selectedAction === "create-project" ||
          selectedItem.selectedAction === "add-to-project" ||
          selectedItem.selectedAction === "next-actions-file";

        if (showsFocusCheckbox) {
          // Initialize markAsDone array if not exists
          if (!selectedItem.markAsDone) {
            selectedItem.markAsDone = [];
          }
          selectedItem.markAsDone[0] = !selectedItem.markAsDone[0];
          // Mutual exclusion with addToFocus
          if (selectedItem.markAsDone[0] && selectedItem.addToFocus) {
            selectedItem.addToFocus = false;
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
      if (selectedItem) {
        // Check if this action type shows date section (all except reference and trash)
        const showsDateSection =
          selectedItem.selectedAction !== "reference" && selectedItem.selectedAction !== "trash";

        if (showsDateSection) {
          selectedItem.isDateSectionExpanded = !selectedItem.isDateSectionExpanded;
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

    if (!selectedItem) return;

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
      selectedItem.selectedAction = action as any;
      this.state.queueRender("editable");
      event.preventDefault();
    }
  };

  private toggleHelp() {
    this.showingHelp = !this.showingHelp;
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) return;

    const existingOverlay = container.querySelector(".flow-inbox-help-overlay");
    if (existingOverlay) {
      existingOverlay.remove();
      return;
    }

    const overlay = container.createDiv("flow-inbox-help-overlay");
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.toggleHelp();
    });

    const modal = overlay.createDiv("flow-inbox-help-modal");

    const header = modal.createDiv("flow-inbox-help-header");
    header.createEl("h3", { text: "Keyboard Shortcuts" });
    const closeBtn = header.createEl("button", { text: "×", cls: "flow-inbox-help-close" });
    closeBtn.addEventListener("click", () => this.toggleHelp());

    const content = modal.createDiv("flow-inbox-help-content");

    const shortcuts = [
      { section: "Navigation" },
      { key: "↑ / ↓", desc: "Select previous/next item" },
      { key: "?", desc: "Show/hide this help" },
      { key: "Esc", desc: "Close help overlay" },
      { section: "Action Types" },
      { key: "C", desc: "Create project" },
      { key: "A", desc: "Add to project" },
      { key: "N", desc: "Next actions" },
      { key: "S", desc: "Someday/maybe" },
      { key: "R", desc: "Reference" },
      { key: "P", desc: "Person note" },
      { key: "T", desc: "Trash" },
      { section: "Options" },
      { key: "⌘/Ctrl + 1-9", desc: "Toggle sphere selection" },
      { key: "⌘/Ctrl + J", desc: "Toggle 'Add to focus'" },
      { key: "⌘/Ctrl + D", desc: "Toggle 'Mark as done'" },
      { key: "⌘/Ctrl + T", desc: "Toggle date section" },
      { section: "Actions" },
      { key: "⌘/Ctrl + Enter", desc: "Save item" },
      { key: "⌘/Ctrl + Q", desc: "Exit text field" },
    ];

    for (const item of shortcuts) {
      if ("section" in item && item.section) {
        content.createEl("h4", { text: item.section, cls: "flow-inbox-help-section" });
      } else if ("key" in item) {
        const row = content.createDiv("flow-inbox-help-row");
        row.createEl("kbd", { text: item.key });
        row.createEl("span", { text: item.desc });
      }
    }
  }
}
