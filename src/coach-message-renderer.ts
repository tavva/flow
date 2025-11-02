// ABOUTME: Renders coach messages, project/action cards, and tool approval blocks.
// ABOUTME: Handles markdown conversion and interactive elements.

import { Marked } from "marked";
import { ChatMessage } from "./language-model";
import { ProjectCardData, ActionCardData, ToolApprovalBlock } from "./types";

export class CoachMessageRenderer {
  private marked: Marked;

  constructor() {
    this.marked = new Marked();
    this.marked.setOptions({ async: false });
  }

  /**
   * Render a chat message to the container.
   * User messages: right-aligned, plain text
   * Assistant messages: left-aligned, markdown
   * System messages: not rendered
   */
  renderMessage(container: HTMLElement, message: ChatMessage): void {
    if (message.role === "system") {
      return; // Don't render system messages
    }

    const messageEl = container.createDiv({
      cls: `coach-message coach-message-${message.role}`,
    });

    if (message.role === "user") {
      messageEl.setText(message.content);
    } else {
      // Render markdown for assistant messages
      const html = this.marked.parse(message.content) as string;
      messageEl.innerHTML = html;
    }
  }

  /**
   * Render a project card with clickable link to file.
   */
  renderProjectCard(
    data: ProjectCardData,
    onClick?: (file: string) => void
  ): HTMLElement {
    const cardEl = this.createDiv("coach-card coach-card-project");

    if (onClick) {
      cardEl.style.cursor = "pointer";
      cardEl.addEventListener("click", () => onClick(data.file));
    }

    // Title with icon
    const titleEl = this.createDiv("coach-card-title");
    titleEl.innerHTML = `🎯 ${data.title}`;
    cardEl.appendChild(titleEl);

    // Meta (priority, status, actions count)
    const metaEl = this.createDiv("coach-card-meta");
    metaEl.textContent = `Priority: ${data.priority} • Status: ${data.status}`;
    cardEl.appendChild(metaEl);

    const actionsEl = this.createDiv("coach-card-actions");
    actionsEl.textContent = `${data.nextActionsCount} next actions`;
    cardEl.appendChild(actionsEl);

    // Description
    if (data.description) {
      const descEl = this.createDiv("coach-card-description");
      descEl.textContent = data.description;
      cardEl.appendChild(descEl);
    }

    return cardEl;
  }

  /**
   * Render an action card with clickable link to file at line number.
   */
  renderActionCard(
    data: ActionCardData,
    onClick?: (file: string, lineNumber: number) => void
  ): HTMLElement {
    const cardEl = this.createDiv("coach-card coach-card-action");

    if (onClick) {
      cardEl.style.cursor = "pointer";
      cardEl.addEventListener("click", () => onClick(data.file, data.lineNumber));
    }

    // Title (action text) with checkbox icon
    const titleEl = this.createDiv("coach-card-title");
    titleEl.innerHTML = `☑️ ${data.text}`;
    cardEl.appendChild(titleEl);

    // Meta (file name)
    const metaEl = this.createDiv("coach-card-meta");
    const fileName = data.file.split("/").pop() || data.file;
    metaEl.textContent = fileName;
    cardEl.appendChild(metaEl);

    // Status
    const statusEl = this.createDiv("coach-card-status");
    statusEl.textContent = data.status;
    cardEl.appendChild(statusEl);

    return cardEl;
  }

  /**
   * Render a tool approval block with approve/reject buttons.
   * Shows different UI based on approval status.
   */
  renderToolApprovalBlock(
    block: ToolApprovalBlock,
    callbacks?: {
      onApprove?: () => void;
      onReject?: () => void;
    }
  ): HTMLElement {
    const blockEl = this.createDiv(`coach-tool-block coach-tool-${block.status}`);

    // Tool name
    const nameEl = this.createDiv("coach-tool-name");
    nameEl.textContent = this.formatToolName(block.toolCall.name);
    blockEl.appendChild(nameEl);

    // Tool description (formatted from input)
    const descEl = this.createDiv("coach-tool-description");
    descEl.textContent = this.formatToolDescription(block.toolCall);
    blockEl.appendChild(descEl);

    if (block.status === "pending") {
      // Show approve/reject buttons
      const buttonsEl = this.createDiv("coach-tool-buttons");
      blockEl.appendChild(buttonsEl);

      const approveBtn = document.createElement("button");
      approveBtn.className = "coach-tool-approve";
      approveBtn.textContent = "Approve";
      approveBtn.addEventListener("click", () => callbacks?.onApprove?.());
      buttonsEl.appendChild(approveBtn);

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "coach-tool-reject";
      rejectBtn.textContent = "Reject";
      rejectBtn.addEventListener("click", () => callbacks?.onReject?.());
      buttonsEl.appendChild(rejectBtn);
    } else {
      // Show status
      const statusEl = this.createDiv("coach-tool-status");
      statusEl.textContent = this.formatStatus(block.status);
      blockEl.appendChild(statusEl);

      // Show result or error
      if (block.result) {
        const resultEl = this.createDiv("coach-tool-result");
        resultEl.textContent = block.result;
        blockEl.appendChild(resultEl);
      } else if (block.error) {
        const errorEl = this.createDiv("coach-tool-error");
        errorEl.textContent = block.error;
        blockEl.appendChild(errorEl);
      }
    }

    return blockEl;
  }

  private formatToolName(name: string): string {
    // Convert snake_case to Title Case
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private formatToolDescription(toolCall: any): string {
    // Format tool input as human-readable description
    switch (toolCall.name) {
      case "move_to_focus":
        return `Add "${toolCall.input.action_text}" to focus`;
      case "update_next_action":
        return `Change "${toolCall.input.old_action}" to "${toolCall.input.new_action}"`;
      case "create_project":
        return `Create project: ${toolCall.input.title}`;
      case "update_project":
        return `Update project: ${toolCall.input.project_path}`;
      default:
        return JSON.stringify(toolCall.input);
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case "approved":
        return "✓ Applied";
      case "rejected":
        return "Skipped";
      case "error":
        return "✗ Error";
      default:
        return status;
    }
  }

  /**
   * Helper to create a div element with a class name.
   */
  private createDiv(className: string): HTMLElement {
    const div = document.createElement("div");
    div.className = className;
    return div;
  }
}
