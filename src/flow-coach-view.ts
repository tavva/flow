// ABOUTME: Main view for Flow Coach chat interface with conversation management.
// ABOUTME: Handles message rendering, protocol banners, tool approvals, and input.

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import {
  PluginSettings,
  CoachState,
  CoachConversation,
  ReviewProtocol,
  FlowProject,
  ToolApprovalBlock,
  ProjectCardData,
  ActionCardData,
} from "./types";
import { CoachStateManager } from "./coach-state";
import { CoachMessageRenderer } from "./coach-message-renderer";
import { CoachProtocolBanner } from "./coach-protocol-banner";
import { scanReviewProtocols } from "./protocol-scanner";
import { matchProtocolsForTime } from "./protocol-matcher";
import { ChatMessage, ToolCallResponse, LanguageModelClient } from "./language-model";
import { FlowProjectScanner } from "./flow-scanner";
import { GTDContext, GTDContextScanner } from "./gtd-context-scanner";
import { buildProjectHierarchy, flattenHierarchy } from "./project-hierarchy";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";
import { withRetry } from "./network-retry";
import { COACH_TOOLS, ToolExecutor } from "./coach-tools";
import { FileWriter } from "./file-writer";

export const FLOW_COACH_VIEW_TYPE = "flow-coach-view";

export class FlowCoachView extends ItemView {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private getCoachState: () => CoachState;
  private setCoachState: (state: CoachState) => void;
  private stateManager: CoachStateManager;
  private messageRenderer: CoachMessageRenderer;
  private protocolBanner: CoachProtocolBanner;
  private state: CoachState;
  private activeConversation: CoachConversation | null = null;
  private messagesContainerEl: HTMLElement | null = null;
  private newMessagesButtonEl: HTMLElement | null = null;
  private loadingIndicatorEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    settings: PluginSettings,
    saveSettings: () => Promise<void>,
    getCoachState: () => CoachState,
    setCoachState: (state: CoachState) => void
  ) {
    super(leaf);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.getCoachState = getCoachState;
    this.setCoachState = setCoachState;
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

    // Wire up send button
    sendBtn.addEventListener("click", async () => {
      const message = textareaEl.value.trim();
      if (!message || !this.activeConversation) {
        return;
      }

      // Disable inputs while processing
      sendBtn.disabled = true;
      textareaEl.disabled = true;

      try {
        await this.sendMessage(message);
        textareaEl.value = "";
      } finally {
        sendBtn.disabled = false;
        textareaEl.disabled = false;
        textareaEl.focus();
      }
    });

    // Wire up reset button
    resetBtn.addEventListener("click", async () => {
      await this.startNewConversation();
    });

    // Allow Enter to send (Shift+Enter for new line)
    textareaEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  private async loadState(): Promise<void> {
    this.state = this.getCoachState();
  }

  private async saveState(): Promise<void> {
    this.setCoachState(this.state);
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

  private async buildWeeklyReviewSystemPrompt(
    spheres: string[],
    includeStatuses: string[]
  ): Promise<string> {
    // Scan projects from vault
    const scanner = new FlowProjectScanner(this.app);
    const allProjects = await scanner.scanProjects();

    // Filter projects by sphere and status
    const projects = allProjects.filter((p) => {
      const hasSphere = p.tags.some((tag) => spheres.some((s) => tag === `project/${s}`));
      const hasStatus = p.status ? includeStatuses.includes(p.status) : includeStatuses.includes("live");
      return hasSphere && hasStatus;
    });

    // Scan GTD context
    const contextScanner = new GTDContextScanner(this.app, this.settings);
    const gtdContext = await contextScanner.scanContext();

    // Build project hierarchy
    const hierarchy = buildProjectHierarchy(projects);
    const flattenedHierarchy = flattenHierarchy(hierarchy);
    const projectCount = flattenedHierarchy.length;

    const nextActionsCount = gtdContext.nextActions.length;
    const somedayCount = gtdContext.somedayItems.length;
    const inboxCount = gtdContext.inboxItems.length;

    const sphereLabel = spheres.join(", ");
    const statusLabel = includeStatuses.join(", ");

    let prompt = `You are Flow, a GTD (Getting Things Done) coach conducting a weekly review for ${sphereLabel}.\n\n`;
    prompt += `Weekly Review Context:\n`;
    prompt += `- Reviewing ${projectCount} projects with status: ${statusLabel}\n`;
    prompt += `- ${nextActionsCount} next actions from central next actions file\n`;
    prompt += `- ${somedayCount} items in someday/maybe\n`;
    prompt += `- ${inboxCount} unprocessed inbox items\n\n`;

    prompt += `Weekly Review Protocol:\n`;
    prompt += `Guide the user through these six steps systematically:\n\n`;
    prompt += `1. **Process Inbox to Zero**\n`;
    prompt += `   - Review all ${inboxCount} inbox items\n`;
    prompt += `   - Suggest processing each item appropriately\n`;
    prompt += `   - Wait for acknowledgment before proceeding\n\n`;
    prompt += `2. **Review Projects**\n`;
    prompt += `   - Identify stalled projects (no next actions)\n`;
    prompt += `   - Check for unclear outcomes or descriptions\n`;
    prompt += `   - Suggest status changes (mark complete, pause, etc.)\n`;
    prompt += `   - Suggest improvements using show_project_card to display key projects\n`;
    prompt += `   - Wait for acknowledgment before proceeding\n\n`;
    prompt += `3. **Review Next Actions**\n`;
    prompt += `   - Check for vague or unclear actions\n`;
    prompt += `   - Suggest improvements using update_next_action\n`;
    prompt += `   - Identify actions to add to focus using move_to_focus\n`;
    prompt += `   - Wait for acknowledgment before proceeding\n\n`;
    prompt += `4. **Review Someday/Maybe**\n`;
    prompt += `   - Highlight items that might be ready to activate\n`;
    prompt += `   - Suggest pruning irrelevant items\n`;
    prompt += `   - Wait for acknowledgment before proceeding\n\n`;
    prompt += `5. **Review Waiting-For**\n`;
    prompt += `   - Identify items that may need follow-up\n`;
    prompt += `   - Suggest converting to next actions if appropriate\n`;
    prompt += `   - Wait for acknowledgment before proceeding\n\n`;
    prompt += `6. **Set Weekly Focus**\n`;
    prompt += `   - Suggest key next actions to focus on this week\n`;
    prompt += `   - Use move_to_focus to add selected actions\n`;
    prompt += `   - Wait for acknowledgment before completing review\n\n`;

    prompt += `Process Guidelines:\n`;
    prompt += `- Work through steps sequentially, waiting for acknowledgment\n`;
    prompt += `- Accept requests to skip steps if user chooses\n`;
    prompt += `- Use tools to suggest specific improvements\n`;
    prompt += `- Focus on actionable insights, not just listing data\n`;
    prompt += `- Ask clarifying questions when needed\n\n`;

    // Add The Flow System section
    prompt += `The Flow System:\n`;
    prompt += `Flow is a GTD implementation for Obsidian with specific conventions:\n\n`;
    prompt += `Spheres:\n`;
    prompt += `- Life areas for categorising projects (work, personal, etc.)\n`;
    prompt += `- Projects belong to one sphere via their tags (project/work, project/personal)\n`;
    prompt += `- You are currently reviewing: ${sphereLabel}\n\n`;
    prompt += `File Organisation:\n`;
    prompt += `- Projects folder: Individual project files\n`;
    prompt += `- Next actions file: Central list for actions not tied to specific projects\n`;
    prompt += `- Someday file: Future aspirations and maybes\n`;
    prompt += `- Inbox: Unprocessed items awaiting GTD categorisation\n\n`;
    prompt += `Project Structure:\n`;
    prompt += `- Projects are Markdown files with frontmatter (tags, priority, status, creation-date)\n`;
    prompt += `- Sub-projects reference parents using parent-project: "[[Parent Name]]" in frontmatter\n`;
    prompt += `- Next actions are Markdown checkboxes under "## Next actions" heading\n`;
    prompt += `- Projects should have clear outcomes (what does "done" look like?)\n`;
    prompt += `- Priority: 1-5 scale (1=highest priority, 5=lowest priority)\n\n`;
    prompt += `Project Statuses:\n`;
    prompt += `- live: Active projects with ongoing work\n`;
    prompt += `- hold: Paused projects (waiting on external factors)\n`;
    prompt += `- archived: Completed or cancelled projects\n`;
    prompt += `- someday: Projects not yet committed to\n\n`;

    prompt += `Communication Style:\n`;
    prompt += `- Ask questions only when the current instructions are ambiguous or incomplete\n`;
    prompt += `- Never ask open-ended, reflective, or rapport-building questions\n`;
    prompt += `- Focus on providing actionable GTD advice based on the data\n\n`;

    prompt += `Presenting Information:\n`;
    prompt += `- NEVER list all projects in a table or enumerated list unless explicitly requested\n`;
    prompt += `- Use high-level summaries by default (e.g., "You have 18 active projects, with 3 at priority-1")\n`;
    prompt += `- When discussing specific projects, use the show_project_card tool to display them as structured cards\n`;
    prompt += `- When discussing specific actions, use the show_action_card tool to display them as structured cards\n`;
    prompt += `- Focus on the subset of projects/actions relevant to the current conversation\n`;
    prompt += `- Only present detailed lists when the user specifically asks for them\n\n`;

    prompt += `GTD Quality Standards:\n`;
    prompt += `- Next actions must start with a verb, be specific, and completable in one sitting\n`;
    prompt += `- Project outcomes should be clear and measurable (what does "done" look like?)\n`;
    prompt += `- Projects need at least one next action to maintain momentum\n\n`;

    if (projectCount === 0 && nextActionsCount === 0 && somedayCount === 0 && inboxCount === 0) {
      prompt += `No GTD data found. The weekly review cannot proceed without data.\n`;
      return prompt;
    }

    prompt += `---\n\n`;

    if (projectCount > 0) {
      prompt += `## Projects (${projectCount})\n\n`;
      prompt += `Projects are shown hierarchically with sub-projects indented under their parents.\n\n`;

      for (const node of flattenedHierarchy) {
        const project = node.project;
        const indent = "  ".repeat(node.depth);

        prompt += `${indent}### ${project.title}\n`;
        prompt += `${indent}File: ${project.file}\n`;
        prompt += `${indent}Description: ${project.description || "No description"}\n`;
        prompt += `${indent}Priority: ${project.priority} (1=highest, 5=lowest)\n`;
        prompt += `${indent}Status: ${project.status}\n`;

        if (node.depth > 0) {
          prompt += `${indent}(Sub-project at depth ${node.depth})\n`;
        }

        if (project.status !== "live") {
          prompt += `${indent}⚠️ Project is ${project.status} - review if status should change\n`;
        }

        if (project.milestones) {
          prompt += `${indent}Milestones:\n`;
          const milestoneLines = project.milestones.split("\n");
          for (const line of milestoneLines) {
            prompt += `${indent}${line}\n`;
          }
        }

        if (project.nextActions && project.nextActions.length > 0) {
          prompt += `${indent}Next Actions (${project.nextActions.length}):\n`;
          for (const action of project.nextActions) {
            prompt += `${indent}- ${action}\n`;
          }
        } else {
          prompt += `${indent}⚠️ Next Actions: None defined (project may be stalled)\n`;
        }

        prompt += `\n`;
      }
    }

    if (nextActionsCount > 0) {
      prompt += `## Central Next Actions (${nextActionsCount})\n\n`;
      for (const action of gtdContext.nextActions) {
        prompt += `- ${action}\n`;
      }
      prompt += `\n`;
    }

    if (somedayCount > 0) {
      prompt += `## Someday/Maybe (${somedayCount})\n\n`;
      for (const item of gtdContext.somedayItems) {
        prompt += `- ${item}\n`;
      }
      prompt += `\n`;
    }

    if (inboxCount > 0) {
      prompt += `## Inbox Items (${inboxCount} unprocessed)\n\n`;
      for (const item of gtdContext.inboxItems) {
        prompt += `- ${item}\n`;
      }
      prompt += `\n`;
    }

    return prompt;
  }

  private async buildSystemPrompt(protocol?: ReviewProtocol): Promise<string> {
    // Scan projects from vault
    const scanner = new FlowProjectScanner(this.app);
    const allProjects = await scanner.scanProjects();

    // Determine which spheres to include
    let spheres: string[] = this.settings.spheres;
    let sphereLabel = "all spheres";

    if (protocol?.spheres && protocol.spheres.length > 0) {
      // Protocol specifies spheres - filter to those
      spheres = protocol.spheres;
      sphereLabel = spheres.join(", ");
    }

    // Filter projects by sphere (if protocol specified)
    const projects =
      protocol?.spheres && protocol.spheres.length > 0
        ? allProjects.filter((p) =>
            p.tags.some((tag) => spheres.some((s) => tag === `project/${s}`))
          )
        : allProjects;

    // Scan GTD context (inbox, next actions, someday)
    const contextScanner = new GTDContextScanner(this.app, this.settings);
    const gtdContext = await contextScanner.scanContext();

    // Build project hierarchy
    const hierarchy = buildProjectHierarchy(projects);
    const flattenedHierarchy = flattenHierarchy(hierarchy);
    const projectCount = flattenedHierarchy.length;

    const nextActionsCount = gtdContext.nextActions.length;
    const somedayCount = gtdContext.somedayItems.length;
    const inboxCount = gtdContext.inboxItems.length;

    let prompt = `You are Flow, a GTD (Getting Things Done) coach for ${sphereLabel}.\n\n`;
    prompt += `You have context on the user's complete GTD system:\n`;
    prompt += `- ${projectCount} active projects (including sub-projects) with their next actions and priorities\n`;
    prompt += `- ${nextActionsCount} next actions from the central next actions file\n`;
    prompt += `- ${somedayCount} items in someday/maybe\n`;
    prompt += `- ${inboxCount} unprocessed inbox items\n\n`;

    prompt += `The Flow System:\n`;
    prompt += `Flow is a GTD implementation for Obsidian with specific conventions:\n\n`;
    prompt += `Spheres:\n`;
    prompt += `- Life areas for categorising projects (work, personal, etc.)\n`;
    prompt += `- Projects belong to one sphere via their tags (project/work, project/personal)\n`;
    prompt += `- You are currently coaching in: ${sphereLabel}\n\n`;
    prompt += `File Organisation:\n`;
    prompt += `- Projects folder: Individual project files\n`;
    prompt += `- Next actions file: Central list for actions not tied to specific projects\n`;
    prompt += `- Someday file: Future aspirations and maybes\n`;
    prompt += `- Inbox: Unprocessed items awaiting GTD categorisation\n\n`;
    prompt += `Project Structure:\n`;
    prompt += `- Projects are Markdown files with frontmatter (tags, priority, status, creation-date)\n`;
    prompt += `- Sub-projects reference parents using parent-project: "[[Parent Name]]" in frontmatter\n`;
    prompt += `- Next actions are Markdown checkboxes under "## Next actions" heading\n`;
    prompt += `- Projects should have clear outcomes (what does "done" look like?)\n`;
    prompt += `- Priority: 1-5 scale (1=highest priority, 5=lowest priority)\n\n`;
    prompt += `Project Statuses:\n`;
    prompt += `- live: Active projects with ongoing work\n`;
    prompt += `- hold: Paused projects (waiting on external factors)\n`;
    prompt += `- archived: Completed or cancelled projects\n`;
    prompt += `- someday: Projects not yet committed to\n\n`;

    prompt += `Your role is to provide expert GTD advice:\n`;
    prompt += `- Help prioritise projects and actions based on goals, context, energy, and time\n`;
    prompt += `- Review project quality: Are outcomes clear? Are next actions specific and actionable?\n`;
    prompt += `- Coach on GTD processes: weekly reviews, inbox processing, project planning\n`;
    prompt += `- Answer methodology questions about GTD principles and best practices\n`;
    prompt += `- Identify issues: projects with no next actions, vague actions, unclear outcomes\n\n`;

    prompt += `You can suggest and apply changes to help improve the GTD system:\n`;
    prompt += `- Move important actions to the focus for today\n`;
    prompt += `- Improve vague or unclear next actions to be more specific\n`;
    prompt += `- Add missing next actions to projects\n`;
    prompt += `- Update project status (mark completed projects, pause projects, etc.)\n\n`;
    prompt += `When you identify improvements, use the available tools to suggest changes. `;
    prompt += `The user will review and approve each suggestion before it's applied.\n\n`;
    prompt += `IMPORTANT: You should only add actions to projects with status 'live'. `;
    prompt += `Projects with other statuses (paused, completed, etc.) are not active and should not have new actions added.\n\n`;

    prompt += `Communication Style:\n`;
    prompt += `- Ask questions only when the current instructions are ambiguous or incomplete\n`;
    prompt += `- Never ask open-ended, reflective, or rapport-building questions\n`;
    prompt += `- Focus on providing actionable GTD advice based on the data\n\n`;

    prompt += `Presenting Information:\n`;
    prompt += `- NEVER list all projects in a table or enumerated list unless explicitly requested\n`;
    prompt += `- Use high-level summaries by default (e.g., "You have 18 active projects, with 3 at priority-1")\n`;
    prompt += `- When discussing specific projects, use the show_project_card tool to display them as structured cards\n`;
    prompt += `- When discussing specific actions, use the show_action_card tool to display them as structured cards\n`;
    prompt += `- Focus on the subset of projects/actions relevant to the current conversation\n`;
    prompt += `- Only present detailed lists when the user specifically asks for them\n\n`;

    prompt += `GTD Quality Standards:\n`;
    prompt += `- Next actions must start with a verb, be specific, and completable in one sitting\n`;
    prompt += `- Project outcomes should be clear and measurable (what does "done" look like?)\n`;
    prompt += `- Projects need at least one next action to maintain momentum\n\n`;

    prompt += `Weekly Review Support:\n`;
    prompt += `When the user requests a weekly review:\n`;
    prompt += `1. Ask which sphere(s) they want to review (work, personal, both, or all)\n`;
    prompt += `2. Ask if they want to include only live projects, or also review paused/someday projects\n`;
    prompt += `3. Once confirmed, use the start_weekly_review tool with their preferences\n`;
    prompt += `4. The tool will rebuild the conversation context with filtered data and weekly review protocol\n`;
    prompt += `5. After the tool completes, begin guiding them through the weekly review process\n\n`;
    prompt += `Example flow:\n`;
    prompt += `User: "I want to do a weekly review"\n`;
    prompt += `You: "I'll help with that. Which sphere(s) would you like to review? (work, personal, or both)"\n`;
    prompt += `User: "Just work"\n`;
    prompt += `You: "Would you like to review only live projects, or include paused/someday projects as well?"\n`;
    prompt += `User: "Just live"\n`;
    prompt += `You: [Call start_weekly_review with spheres=["work"], include_statuses=["live"]]\n\n`;

    // Add custom review protocol if provided
    if (protocol) {
      prompt += `Custom Review in Progress:\n`;
      prompt += `The user has selected the "${protocol.name}" review. Follow the protocol below:\n\n`;
      prompt += `---\n${protocol.content}\n---\n\n`;
      prompt += `Follow this protocol step-by-step. After presenting each section or completing each task, `;
      prompt += `wait for the user to acknowledge before moving to the next step.\n\n`;
    }

    if (projectCount === 0 && nextActionsCount === 0 && somedayCount === 0 && inboxCount === 0) {
      prompt += `No GTD data found. You can still answer general GTD methodology questions.\n`;
      return prompt;
    }

    prompt += `---\n\n`;

    if (projectCount > 0) {
      prompt += `## Projects (${projectCount})\n\n`;
      prompt += `Projects are shown hierarchically with sub-projects indented under their parents.\n\n`;

      for (const node of flattenedHierarchy) {
        const project = node.project;
        const indent = "  ".repeat(node.depth);

        prompt += `${indent}### ${project.title}\n`;
        prompt += `${indent}File: ${project.file}\n`;
        prompt += `${indent}Description: ${project.description || "No description"}\n`;
        prompt += `${indent}Priority: ${project.priority} (1=highest, 5=lowest)\n`;
        prompt += `${indent}Status: ${project.status}\n`;

        if (node.depth > 0) {
          prompt += `${indent}(Sub-project at depth ${node.depth})\n`;
        }

        // Warn about non-live projects
        if (project.status !== "live") {
          prompt += `${indent}⚠️ Project is paused - do not add actions to this project\n`;
        }

        if (project.milestones) {
          prompt += `${indent}Milestones:\n`;
          const milestoneLines = project.milestones.split("\n");
          for (const line of milestoneLines) {
            prompt += `${indent}${line}\n`;
          }
        }

        if (project.nextActions && project.nextActions.length > 0) {
          prompt += `${indent}Next Actions (${project.nextActions.length}):\n`;
          for (const action of project.nextActions) {
            prompt += `${indent}- ${action}\n`;
          }
        } else {
          prompt += `${indent}⚠️ Next Actions: None defined (project may be stalled)\n`;
        }

        prompt += `\n`;
      }
    }

    if (nextActionsCount > 0) {
      prompt += `## Central Next Actions (${nextActionsCount})\n\n`;
      for (const action of gtdContext.nextActions) {
        prompt += `- ${action}\n`;
      }
      prompt += `\n`;
    }

    if (somedayCount > 0) {
      prompt += `## Someday/Maybe (${somedayCount})\n\n`;
      for (const item of gtdContext.somedayItems) {
        prompt += `- ${item}\n`;
      }
      prompt += `\n`;
    }

    if (inboxCount > 0) {
      prompt += `## Inbox Items (${inboxCount} unprocessed)\n\n`;
      for (const item of gtdContext.inboxItems) {
        prompt += `- ${item}\n`;
      }
      prompt += `\n`;
    }

    return prompt;
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
    this.messagesContainerEl = messagesEl;

    if (!this.activeConversation) {
      return;
    }

    // Check if we should scroll to bottom (user was already at bottom, or first load)
    const shouldScrollToBottom =
      !this.activeConversation.lastSeenMessageCount ||
      this.activeConversation.lastSeenMessageCount === this.activeConversation.messages.length;

    // Render messages with inline cards
    for (let i = 0; i < this.activeConversation.messages.length; i++) {
      const message = this.activeConversation.messages[i];
      this.messageRenderer.renderMessage(messagesEl, message);

      // Render cards that belong to this message
      if (this.activeConversation.displayCards) {
        const cardsForMessage = this.activeConversation.displayCards.filter(
          (card) => card.messageIndex === i
        );
        for (const card of cardsForMessage) {
          if (card.type === "project") {
            const cardEl = this.messageRenderer.renderProjectCard(card.data, (file) => {
              // Open project file
              this.app.workspace.openLinkText(file, "", false);
            });
            messagesEl.appendChild(cardEl);
          } else if (card.type === "action") {
            const cardEl = this.messageRenderer.renderActionCard(card.data, (file, lineNumber) => {
              // Open file at line number
              this.app.workspace.openLinkText(file, "", false);
            });
            messagesEl.appendChild(cardEl);
          }
        }
      }
    }

    // Render tool approval blocks at the end (they don't have message association)
    if (this.activeConversation.toolApprovalBlocks) {
      for (const block of this.activeConversation.toolApprovalBlocks) {
        const blockEl = this.messageRenderer.renderToolApprovalBlock(block, {
          onApprove: () => this.approveTool(block),
          onReject: () => this.rejectTool(block),
        });
        messagesEl.appendChild(blockEl);
      }
    }

    // Add scroll event listener to track position
    messagesEl.addEventListener("scroll", () => {
      this.updateNewMessagesButton();
    });

    // Render new messages button if needed
    this.renderNewMessagesButton(container);

    // Auto-scroll to bottom if appropriate
    if (shouldScrollToBottom) {
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        this.markMessagesAsSeen();
      }, 0);
    }
  }

  private isScrolledToBottom(el: HTMLElement): boolean {
    // Consider "at bottom" if within 50px of bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  private updateNewMessagesButton(): void {
    if (!this.messagesContainerEl || !this.activeConversation || !this.newMessagesButtonEl) {
      return;
    }

    const hasNewMessages =
      (this.activeConversation.lastSeenMessageCount || 0) < this.activeConversation.messages.length;
    const isAtBottom = this.isScrolledToBottom(this.messagesContainerEl);

    // Show button if there are new messages and user is not at bottom
    if (hasNewMessages && !isAtBottom) {
      this.newMessagesButtonEl.style.display = "flex";
    } else {
      this.newMessagesButtonEl.style.display = "none";

      // Mark messages as seen if we're at the bottom
      if (isAtBottom) {
        this.markMessagesAsSeen();
      }
    }
  }

  private renderNewMessagesButton(container: HTMLElement): void {
    const buttonEl = container.createDiv({ cls: "coach-new-messages-button" });
    buttonEl.setText("New messages ↓");
    buttonEl.style.display = "none"; // Hidden by default

    this.newMessagesButtonEl = buttonEl;

    buttonEl.addEventListener("click", () => {
      this.scrollToFirstNewMessage();
    });

    // Initial update
    this.updateNewMessagesButton();
  }

  private scrollToFirstNewMessage(): void {
    if (!this.messagesContainerEl || !this.activeConversation) {
      return;
    }

    const lastSeenCount = this.activeConversation.lastSeenMessageCount || 0;
    const messageElements = this.messagesContainerEl.querySelectorAll(".coach-message");

    if (messageElements.length > lastSeenCount) {
      // Scroll to the first unseen message
      const firstNewMessage = messageElements[lastSeenCount];
      if (firstNewMessage) {
        firstNewMessage.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  private markMessagesAsSeen(): void {
    if (!this.activeConversation) {
      return;
    }

    this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;
    this.saveState();
  }

  private showLoadingIndicator(): void {
    if (!this.messagesContainerEl) {
      return;
    }

    // Remove existing loading indicator if present
    this.hideLoadingIndicator();

    // Create loading indicator
    const loadingEl = this.messagesContainerEl.createDiv({
      cls: "coach-loading-indicator coach-message",
    });
    loadingEl.setText("...");
    this.loadingIndicatorEl = loadingEl;

    // Scroll to bottom to show loading indicator
    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
  }

  private hideLoadingIndicator(): void {
    if (this.loadingIndicatorEl) {
      this.loadingIndicatorEl.remove();
      this.loadingIndicatorEl = null;
    }
  }

  private async startProtocol(protocol: ReviewProtocol): Promise<void> {
    if (!this.activeConversation) {
      return;
    }

    // Add protocol content as system message
    this.activeConversation.messages.push({
      role: "system",
      content: `The user has requested the "${protocol.name}" review. Follow the protocol below:\n\n---\n${protocol.content}\n---\n\nFollow this protocol step-by-step. After presenting each section or completing each task, wait for the user to acknowledge before moving to the next step.`,
    });

    // Add confirmation from user
    this.activeConversation.messages.push({
      role: "user",
      content: `Let's do the ${protocol.name}.`,
    });

    // Update title if this is the first interaction
    const nonSystemMessages = this.activeConversation.messages.filter((m) => m.role !== "system");
    if (nonSystemMessages.length === 1) {
      this.activeConversation.title = protocol.name;
    }

    // Update timestamp
    this.activeConversation.lastUpdatedAt = Date.now();

    // Save state and refresh
    await this.saveState();
    await this.refresh();

    // Show loading indicator
    this.showLoadingIndicator();

    // Get initial LLM response to start the protocol
    try {
      const languageModelClient = createLanguageModelClient(this.settings);
      if (!languageModelClient) {
        if (!this.settings.aiEnabled) {
          throw new Error("AI features are disabled. Please enable AI in plugin settings.");
        }
        throw new Error("Failed to create language model client. Please check your API settings.");
      }

      const model = getModelForSettings(this.settings);

      // Build messages array with system prompt prepended
      const messagesWithSystemPrompt: ChatMessage[] = [
        {
          role: "system",
          content: this.activeConversation.systemPrompt,
        },
        ...this.activeConversation.messages,
      ];

      const response = await withRetry(
        () =>
          languageModelClient.sendMessage({
            model,
            maxTokens: 4000,
            messages: messagesWithSystemPrompt,
          }),
        { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 }
      );

      const text = typeof response === "string" ? response : (response as any).content || "";
      this.activeConversation.messages.push({
        role: "assistant",
        content: text,
      });

      this.hideLoadingIndicator();
      await this.saveState();
      await this.refresh();
    } catch (error) {
      const errorMessage = `Error starting protocol: ${error instanceof Error ? error.message : String(error)}`;
      this.activeConversation.messages.push({
        role: "assistant",
        content: errorMessage,
      });

      this.hideLoadingIndicator();
      await this.saveState();
      await this.refresh();
    }
  }

  private detectProtocolInvocation(
    input: string,
    protocols: ReviewProtocol[]
  ): ReviewProtocol | null {
    const lowerInput = input.toLowerCase();

    // Check for review/protocol invocation patterns
    const patterns = [
      /(?:run|start|do|begin)\s+(?:the\s+)?(.+?)\s+(?:review|protocol)/i,
      /(?:review|protocol):\s*(.+)/i,
      /^(.+?)\s+review$/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const searchTerm = match[1].trim().toLowerCase();

        // Try to find matching protocol
        const protocol = protocols.find(
          (p) =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.filename.toLowerCase().includes(searchTerm)
        );

        if (protocol) {
          return protocol;
        }
      }
    }

    return null;
  }

  private async handleToolCalls(response: ToolCallResponse): Promise<void> {
    if (!this.activeConversation || !response.toolCalls) {
      return;
    }

    const { content, toolCalls } = response;

    // Add assistant message with content
    this.activeConversation.messages.push({
      role: "assistant",
      content: content || "",
    });

    // Initialize arrays if needed
    if (!this.activeConversation.toolApprovalBlocks) {
      this.activeConversation.toolApprovalBlocks = [];
    }
    if (!this.activeConversation.displayCards) {
      this.activeConversation.displayCards = [];
    }

    // Separate display tools, system tools, and action tools
    const displayTools = toolCalls.filter(
      (tc) => tc.name === "show_project_card" || tc.name === "show_action_card"
    );
    const systemTools = toolCalls.filter((tc) => tc.name === "start_weekly_review");
    const actionTools = toolCalls.filter(
      (tc) =>
        tc.name !== "show_project_card" &&
        tc.name !== "show_action_card" &&
        tc.name !== "start_weekly_review"
    );

    // Process system tools - execute immediately and modify conversation state
    const toolResults: string[] = [];

    for (const toolCall of systemTools) {
      try {
        if (toolCall.name === "start_weekly_review") {
          const { spheres, include_statuses } = toolCall.input as {
            spheres: string[];
            include_statuses?: string[];
          };

          // Rebuild system prompt with filtered context
          const newSystemPrompt = await this.buildWeeklyReviewSystemPrompt(
            spheres,
            include_statuses || ["live"]
          );

          // Update conversation system prompt
          this.activeConversation.systemPrompt = newSystemPrompt;

          const sphereLabel = spheres.join(", ");
          const statusLabel = (include_statuses || ["live"]).join(", ");
          toolResults.push(
            `Started weekly review for ${sphereLabel} sphere(s), including ${statusLabel} projects.`
          );
        }
      } catch (error) {
        toolResults.push(
          `Error starting weekly review: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Process display tools - extract card data and store
    // Cards should render after the assistant message we just added
    const cardMessageIndex = this.activeConversation.messages.length - 1;

    for (const toolCall of displayTools) {
      try {
        if (toolCall.name === "show_project_card") {
          const { project_file } = toolCall.input as { project_file: string };
          const cardData = await this.extractProjectCardData(project_file);
          if (cardData) {
            this.activeConversation.displayCards.push({
              type: "project",
              data: cardData,
              messageIndex: cardMessageIndex,
            });
            toolResults.push(`Displayed project card: ${cardData.title}`);
          }
        } else if (toolCall.name === "show_action_card") {
          const { file, line_number } = toolCall.input as { file: string; line_number: number };
          const cardData = await this.extractActionCardData(file, line_number);
          if (cardData) {
            this.activeConversation.displayCards.push({
              type: "action",
              data: cardData,
              messageIndex: cardMessageIndex,
            });
            toolResults.push(`Displayed action card: ${cardData.text}`);
          }
        }
      } catch (error) {
        // Ignore display tool errors silently
        toolResults.push(
          `Error displaying card: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Create approval blocks for action tools (require user approval)
    for (const toolCall of actionTools) {
      this.activeConversation.toolApprovalBlocks.push({
        toolCall,
        status: "pending",
      });
    }

    await this.saveState();
    await this.refresh();

    // If we have display tool results, continue the conversation with the LLM
    if (toolResults.length > 0) {
      await this.continueConversationAfterTools(toolResults);
    }
  }

  private async continueConversationAfterTools(toolResults: string[]): Promise<void> {
    if (!this.activeConversation) {
      return;
    }

    // Add tool results as a system message (will be filtered from UI rendering)
    const toolResultMessage = toolResults.join("\n");
    this.activeConversation.messages.push({
      role: "system",
      content: `[Tool Results]\n${toolResultMessage}`,
    });

    // Show loading indicator
    this.showLoadingIndicator();

    try {
      // Create LLM client
      const languageModelClient = createLanguageModelClient(this.settings);
      if (!languageModelClient) {
        if (!this.settings.aiEnabled) {
          throw new Error("AI features are disabled. Please enable AI in plugin settings.");
        }
        throw new Error("Failed to create language model client. Please check your API settings.");
      }

      const model = getModelForSettings(this.settings);

      // Build messages array with system prompt prepended
      const messagesWithSystemPrompt: ChatMessage[] = [
        {
          role: "system",
          content: this.activeConversation.systemPrompt,
        },
        ...this.activeConversation.messages,
      ];

      // Check if client supports tools
      const supportsTools = typeof languageModelClient.sendMessageWithTools === "function";

      let response: string | ToolCallResponse;

      if (supportsTools) {
        // Call LLM with tools
        response = await withRetry(
          () =>
            languageModelClient.sendMessageWithTools!(
              {
                model,
                maxTokens: 4000,
                messages: messagesWithSystemPrompt,
              },
              COACH_TOOLS
            ),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 }
        );
      } else {
        // Call LLM without tools
        response = await withRetry(
          () =>
            languageModelClient.sendMessage({
              model,
              maxTokens: 4000,
              messages: messagesWithSystemPrompt,
            }),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 }
        );
      }

      // Handle response
      if (typeof response !== "string" && response.toolCalls) {
        // More tool calls - handle them recursively
        this.hideLoadingIndicator();
        await this.handleToolCalls(response);
      } else {
        // Regular text response
        const text = typeof response === "string" ? response : response.content || "";
        this.activeConversation.messages.push({
          role: "assistant",
          content: text,
        });

        // Mark as seen so we auto-scroll to bottom
        this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;

        this.hideLoadingIndicator();
        await this.saveState();
        await this.refresh();
      }
    } catch (error) {
      // Add error message to conversation
      const errorMessage = `Error continuing conversation: ${error instanceof Error ? error.message : String(error)}`;
      this.activeConversation.messages.push({
        role: "assistant",
        content: errorMessage,
      });

      // Mark as seen so we auto-scroll to bottom
      this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;

      this.hideLoadingIndicator();
      await this.saveState();
      await this.refresh();
    }
  }

  private async approveTool(block: ToolApprovalBlock): Promise<void> {
    if (!this.activeConversation) {
      return;
    }

    // Update block status
    block.status = "approved";

    // Execute the tool
    const toolExecutor = new ToolExecutor(
      this.app,
      new FileWriter(this.app, this.settings),
      this.settings
    );

    try {
      const result = await toolExecutor.executeTool(block.toolCall);

      if (result.is_error) {
        block.status = "error";
        block.error = result.content;
      } else {
        block.result = result.content;
      }
    } catch (error) {
      block.status = "error";
      block.error = error instanceof Error ? error.message : String(error);
    }

    await this.saveState();
    await this.refresh();
  }

  private async rejectTool(block: ToolApprovalBlock): Promise<void> {
    if (!this.activeConversation) {
      return;
    }

    // Update block status
    block.status = "rejected";

    await this.saveState();
    await this.refresh();
  }

  private async extractProjectCardData(projectPath: string): Promise<ProjectCardData | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(projectPath);
      if (!(file instanceof TFile)) {
        return null;
      }

      const content = await this.app.vault.read(file);
      const cache = this.app.metadataCache.getFileCache(file);

      // Extract project metadata
      const frontmatter = cache?.frontmatter || {};
      const title = frontmatter.title || file.basename;
      const priority = frontmatter.priority || 3;
      const status = frontmatter.status || "live";

      // Extract description (first paragraph after frontmatter)
      const descMatch = content.match(/---[\s\S]*?---\n\n(.+?)(?:\n\n|$)/);
      const description = descMatch ? descMatch[1] : "";

      // Count next actions
      const actionMatches = content.match(/^- \[ \]/gm);
      const nextActionsCount = actionMatches ? actionMatches.length : 0;

      return {
        title,
        description,
        priority,
        status,
        nextActionsCount,
        file: projectPath,
      };
    } catch (error) {
      return null;
    }
  }

  private async extractActionCardData(
    filePath: string,
    lineNumber: number
  ): Promise<ActionCardData | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return null;
      }

      const content = await this.app.vault.read(file);
      const lines = content.split(/\r?\n/);

      if (lineNumber < 1 || lineNumber > lines.length) {
        return null;
      }

      const line = lines[lineNumber - 1];
      const checkboxMatch = line.match(/^- \[(?: |w|x)\] (.+)$/);

      if (!checkboxMatch) {
        return null;
      }

      const text = checkboxMatch[1];
      let status: "incomplete" | "waiting" | "complete" = "incomplete";

      if (line.includes("- [w]")) {
        status = "waiting";
      } else if (line.includes("- [x]")) {
        status = "complete";
      }

      return {
        text,
        file: filePath,
        lineNumber,
        status,
      };
    } catch (error) {
      return null;
    }
  }

  private async sendMessage(message: string): Promise<void> {
    if (!this.activeConversation) {
      return;
    }

    // Check for protocol invocation
    const vaultPath = (this.app.vault.adapter as any)?.basePath;
    if (vaultPath) {
      const protocols = scanReviewProtocols(vaultPath);
      const invokedProtocol = this.detectProtocolInvocation(message, protocols);
      if (invokedProtocol) {
        // Inject protocol into conversation
        await this.startProtocol(invokedProtocol);
        // Don't add the user message - startProtocol handles it
        return;
      }
    }

    // Add user message
    this.activeConversation.messages.push({
      role: "user",
      content: message,
    });

    // Update title if first message (excluding system message)
    const nonSystemMessages = this.activeConversation.messages.filter((m) => m.role !== "system");
    if (nonSystemMessages.length === 1) {
      this.activeConversation.title = this.stateManager.updateConversationTitle(message);
    }

    // Update timestamp
    this.activeConversation.lastUpdatedAt = Date.now();

    // Mark as seen so we auto-scroll to bottom when refreshing
    this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;

    // Save state and refresh to show user message
    await this.saveState();
    await this.refresh();

    // Show loading indicator
    this.showLoadingIndicator();

    try {
      // Create LLM client
      const languageModelClient = createLanguageModelClient(this.settings);
      if (!languageModelClient) {
        if (!this.settings.aiEnabled) {
          throw new Error("AI features are disabled. Please enable AI in plugin settings.");
        }
        throw new Error("Failed to create language model client. Please check your API settings.");
      }

      const model = getModelForSettings(this.settings);

      // Build messages array with system prompt prepended
      const messagesWithSystemPrompt: ChatMessage[] = [
        {
          role: "system",
          content: this.activeConversation.systemPrompt,
        },
        ...this.activeConversation.messages,
      ];

      // Check if client supports tools
      const supportsTools = typeof languageModelClient.sendMessageWithTools === "function";

      let response: string | ToolCallResponse;

      if (supportsTools) {
        // Call LLM with tools
        response = await withRetry(
          () =>
            languageModelClient.sendMessageWithTools!(
              {
                model,
                maxTokens: 4000,
                messages: messagesWithSystemPrompt,
              },
              COACH_TOOLS
            ),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 }
        );
      } else {
        // Call LLM without tools
        response = await withRetry(
          () =>
            languageModelClient.sendMessage({
              model,
              maxTokens: 4000,
              messages: messagesWithSystemPrompt,
            }),
          { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 10000 }
        );
      }

      // Handle response
      if (typeof response !== "string" && response.toolCalls) {
        // Tool calls present - handle them
        this.hideLoadingIndicator();
        await this.handleToolCalls(response);
      } else {
        // Regular text response
        const text = typeof response === "string" ? response : response.content || "";
        this.activeConversation.messages.push({
          role: "assistant",
          content: text,
        });

        // Mark as seen so we auto-scroll to bottom
        this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;

        this.hideLoadingIndicator();
        await this.saveState();
        await this.refresh();
      }
    } catch (error) {
      // Add error message to conversation
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      this.activeConversation.messages.push({
        role: "assistant",
        content: errorMessage,
      });

      // Mark as seen so we auto-scroll to bottom
      this.activeConversation.lastSeenMessageCount = this.activeConversation.messages.length;

      this.hideLoadingIndicator();
      await this.saveState();
      await this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    // Re-render view
    await this.onOpen();
  }

  async onClose() {
    // Cleanup
  }
}
