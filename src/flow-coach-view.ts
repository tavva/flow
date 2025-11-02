// ABOUTME: Main view for Flow Coach chat interface with conversation management.
// ABOUTME: Handles message rendering, protocol banners, tool approvals, and input.

import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings, CoachState, CoachConversation, ReviewProtocol } from "./types";
import { CoachStateManager } from "./coach-state";
import { CoachMessageRenderer } from "./coach-message-renderer";
import { CoachProtocolBanner } from "./coach-protocol-banner";
import { scanReviewProtocols } from "./protocol-scanner";
import { matchProtocolsForTime } from "./protocol-matcher";

export const FLOW_COACH_VIEW_TYPE = "flow-coach-view";

export class FlowCoachView extends ItemView {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private getState: () => CoachState;
  private setState: (state: CoachState) => void;
  private stateManager: CoachStateManager;
  private messageRenderer: CoachMessageRenderer;
  private protocolBanner: CoachProtocolBanner;
  private state: CoachState;
  private activeConversation: CoachConversation | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    settings: PluginSettings,
    saveSettings: () => Promise<void>,
    getState: () => CoachState,
    setState: (state: CoachState) => void
  ) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.getState = getState;
    this.setState = setState;
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

    // Load state (will add persistence later)
    await this.loadState();

    // Create initial conversation if none exists
    if (this.state.conversations.length === 0) {
      await this.startNewConversation();
    } else {
      // Load active conversation
      if (this.state.activeConversationId) {
        this.activeConversation =
          this.state.conversations.find((c) => c.id === this.state.activeConversationId) || null;
      }

      if (!this.activeConversation) {
        await this.startNewConversation();
      }
    }

    // Render UI
    this.renderHeader(container as HTMLElement);
    this.renderProtocolBanner(container as HTMLElement);
    this.renderMessages(container as HTMLElement);
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

  private async loadState(): Promise<void> {
    this.state = this.getState();
  }

  private async saveState(): Promise<void> {
    this.setState(this.state);
    await this.saveSettings();
  }

  private async startNewConversation(): Promise<void> {
    // Build system prompt
    const systemPrompt = await this.buildSystemPrompt();

    // Create conversation
    const conversation = this.stateManager.createConversation(systemPrompt);

    // Add to state
    this.state.conversations.push(conversation);
    this.state.activeConversationId = conversation.id;
    this.activeConversation = conversation;

    // Prune old conversations
    this.state = this.stateManager.pruneOldConversations(this.state);

    // Save state
    await this.saveState();

    // Refresh view
    await this.refresh();
  }

  private async switchConversation(conversationId: string): Promise<void> {
    const conversation = this.state.conversations.find((c) => c.id === conversationId);

    if (conversation) {
      this.activeConversation = conversation;
      this.state.activeConversationId = conversationId;
      await this.saveState();
      await this.refresh();
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    // Placeholder - will implement with actual scanning
    return "You are a GTD coach.";
  }

  private renderProtocolBanner(container: HTMLElement): void {
    // Only show if conversation is new (no messages)
    if (!this.activeConversation || this.activeConversation.messages.length > 0) {
      return;
    }

    // Scan for protocols
    const vaultPath = (this.app.vault.adapter as any)?.basePath;
    if (!vaultPath) {
      return; // No vault path available (e.g., in tests)
    }

    const protocols = scanReviewProtocols(vaultPath);
    const matched = matchProtocolsForTime(protocols, new Date());

    this.protocolBanner.render(container, matched, {
      onStart: (protocol) => this.startProtocol(protocol),
      onDismiss: () => {
        // Banner removes itself
      },
    });
  }

  private renderMessages(container: HTMLElement): void {
    const messagesEl = container.createDiv({ cls: "coach-messages" });

    if (!this.activeConversation) {
      return;
    }

    // Render each message
    for (const message of this.activeConversation.messages) {
      this.messageRenderer.renderMessage(messagesEl, message);
    }
  }

  private startProtocol(protocol: ReviewProtocol): void {
    // Add protocol to system prompt (implement later)
  }

  private async refresh(): Promise<void> {
    // Re-render view
    await this.onOpen();
  }

  async onClose() {
    // Cleanup
  }
}
