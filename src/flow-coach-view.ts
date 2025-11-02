// ABOUTME: Main view for Flow Coach chat interface with conversation management.
// ABOUTME: Handles message rendering, protocol banners, tool approvals, and input.

import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings, CoachState, CoachConversation } from "./types";
import { CoachStateManager } from "./coach-state";
import { CoachMessageRenderer } from "./coach-message-renderer";
import { CoachProtocolBanner } from "./coach-protocol-banner";

export const FLOW_COACH_VIEW_TYPE = "flow-coach-view";

export class FlowCoachView extends ItemView {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private stateManager: CoachStateManager;
  private messageRenderer: CoachMessageRenderer;
  private protocolBanner: CoachProtocolBanner;
  private state: CoachState;
  private activeConversation: CoachConversation | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    settings: PluginSettings,
    saveSettings: () => Promise<void>
  ) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.stateManager = new CoachStateManager();
    this.messageRenderer = new CoachMessageRenderer();
    this.protocolBanner = new CoachProtocolBanner();

    // Initialize empty state
    this.state = {
      conversations: [],
      activeConversationId: null,
    };
  }

  getViewType(): string {
    return FLOW_COACH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flow Coach";
  }

  getIcon(): string {
    return "message-circle";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("flow-coach-view");

    // Render header
    this.renderHeader(container as HTMLElement);

    // Render messages area
    const messagesEl = (container as HTMLElement).createDiv({ cls: "coach-messages" });

    // Render input area
    this.renderInputArea(container as HTMLElement);
  }

  private renderHeader(container: HTMLElement): void {
    const headerEl = container.createDiv({ cls: "coach-header" });

    const titleEl = headerEl.createDiv({ cls: "coach-title" });
    titleEl.setText("Flow Coach");

    const dropdownEl = headerEl.createEl("select", {
      cls: "coach-conversation-dropdown",
    });

    // Add "New conversation" option
    const newOption = dropdownEl.createEl("option");
    newOption.value = "new";
    newOption.text = "New conversation";

    // Add existing conversations
    for (const conversation of this.state.conversations) {
      const option = dropdownEl.createEl("option");
      option.value = conversation.id;
      option.text = conversation.title;
    }

    // Handle dropdown change
    dropdownEl.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value === "new") {
        this.startNewConversation();
      } else {
        this.switchConversation(target.value);
      }
    });
  }

  private renderInputArea(container: HTMLElement): void {
    const inputAreaEl = container.createDiv({ cls: "coach-input-area" });

    const textareaEl = inputAreaEl.createEl("textarea", {
      cls: "coach-input",
      attr: {
        placeholder: "Type a message...",
      },
    });

    const buttonsEl = inputAreaEl.createDiv({ cls: "coach-input-buttons" });

    const sendBtn = buttonsEl.createEl("button", {
      cls: "coach-send-btn",
      text: "Send",
    });

    const resetBtn = buttonsEl.createEl("button", {
      cls: "coach-reset-btn",
      text: "↻",
    });
  }

  private startNewConversation(): void {
    // Placeholder - will implement in next task
  }

  private switchConversation(conversationId: string): void {
    // Placeholder - will implement in next task
  }

  async onClose() {
    // Cleanup
  }
}
