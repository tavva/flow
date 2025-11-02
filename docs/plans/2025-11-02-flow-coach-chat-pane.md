# Flow Coach Chat Pane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace standalone CLI with in-Obsidian chat pane for GTD coaching conversations with conversation history, protocol integration, inline tool approvals, and structured cards.

**Architecture:** New ItemView (`FlowCoachView`) with conversation state persistence, message rendering with markdown/cards/approvals, renamed coach tools with display tools, protocol banner component, and full CLI removal.

**Tech Stack:** Obsidian API, TypeScript, marked (markdown), existing LLM clients, protocol scanner/matcher

---

## Task 1: Add Core Types

**Files:**

- Modify: `src/types.ts`

**Step 1: Write failing test**

```typescript
// tests/types.test.ts
describe("Coach types", () => {
  it("should define CoachConversation interface", () => {
    const conversation: CoachConversation = {
      id: "test-id",
      title: "Test Conversation",
      messages: [],
      systemPrompt: "Test prompt",
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    expect(conversation.id).toBe("test-id");
  });

  it("should define CoachState interface", () => {
    const state: CoachState = {
      conversations: [],
      activeConversationId: null,
    };
    expect(state.conversations).toEqual([]);
  });

  it("should define DisplayCard types", () => {
    const projectCard: ProjectCardData = {
      title: "Test Project",
      description: "Test description",
      priority: 1,
      status: "live",
      nextActionsCount: 3,
      file: "Projects/test.md",
    };
    expect(projectCard.title).toBe("Test Project");

    const actionCard: ActionCardData = {
      text: "Test action",
      file: "Projects/test.md",
      lineNumber: 10,
      status: "incomplete",
    };
    expect(actionCard.text).toBe("Test action");
  });

  it("should define ToolApprovalBlock type", () => {
    const block: ToolApprovalBlock = {
      toolCall: {
        id: "test",
        name: "move_to_focus",
        input: {},
      },
      status: "pending",
    };
    expect(block.status).toBe("pending");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- types.test`
Expected: FAIL with "Cannot find name 'CoachConversation'"

**Step 3: Add type definitions**

```typescript
// src/types.ts
import { ChatMessage, ToolCall } from "./language-model";

export interface CoachConversation {
  id: string; // UUID
  title: string; // Auto-generated from first message
  messages: ChatMessage[];
  systemPrompt: string; // Built once at conversation start
  createdAt: number;
  lastUpdatedAt: number;
}

export interface CoachState {
  conversations: CoachConversation[];
  activeConversationId: string | null;
}

export interface ProjectCardData {
  title: string;
  description: string;
  priority: number;
  status: string;
  nextActionsCount: number;
  file: string;
}

export interface ActionCardData {
  text: string;
  file: string;
  lineNumber: number;
  status: "incomplete" | "waiting" | "complete";
}

export type DisplayCard =
  | { type: "project"; data: ProjectCardData }
  | { type: "action"; data: ActionCardData };

export interface ToolApprovalBlock {
  toolCall: ToolCall;
  status: "pending" | "approved" | "rejected" | "error";
  result?: string;
  error?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- types.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add coach conversation and card types"
```

---

## Task 2: Coach State Management

**Files:**

- Create: `src/coach-state.ts`
- Create: `tests/coach-state.test.ts`

**Step 1: Write failing test**

```typescript
// tests/coach-state.test.ts
import { CoachStateManager } from "../src/coach-state";
import { CoachState, CoachConversation } from "../src/types";

describe("CoachStateManager", () => {
  let manager: CoachStateManager;

  beforeEach(() => {
    manager = new CoachStateManager();
  });

  describe("createConversation", () => {
    it("should create new conversation with UUID", () => {
      const systemPrompt = "Test prompt";
      const conversation = manager.createConversation(systemPrompt);

      expect(conversation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
      expect(conversation.title).toBe("New conversation");
      expect(conversation.messages).toEqual([]);
      expect(conversation.systemPrompt).toBe(systemPrompt);
      expect(conversation.createdAt).toBeGreaterThan(0);
      expect(conversation.lastUpdatedAt).toBe(conversation.createdAt);
    });
  });

  describe("updateConversationTitle", () => {
    it("should generate title from first user message", () => {
      const conversation = manager.createConversation("prompt");
      const title = manager.updateConversationTitle("Help me prioritize my tasks for today");

      expect(title).toBe("Help me prioritize my tasks for today");
    });

    it("should truncate long titles to 50 characters", () => {
      const conversation = manager.createConversation("prompt");
      const longMessage =
        "This is a very long message that should be truncated to fifty characters maximum";
      const title = manager.updateConversationTitle(longMessage);

      expect(title.length).toBe(50);
      expect(title).toBe("This is a very long message that should be trun");
    });
  });

  describe("pruneOldConversations", () => {
    it("should keep last 50 conversations", () => {
      const state: CoachState = {
        conversations: [],
        activeConversationId: null,
      };

      // Create 60 conversations
      for (let i = 0; i < 60; i++) {
        state.conversations.push(manager.createConversation("prompt"));
      }

      const pruned = manager.pruneOldConversations(state);

      expect(pruned.conversations.length).toBe(50);
      // Should keep most recent (highest timestamps)
      expect(pruned.conversations[0].createdAt).toBeGreaterThan(state.conversations[0].createdAt);
    });

    it("should not prune if less than 50 conversations", () => {
      const state: CoachState = {
        conversations: [manager.createConversation("prompt"), manager.createConversation("prompt")],
        activeConversationId: null,
      };

      const pruned = manager.pruneOldConversations(state);
      expect(pruned.conversations.length).toBe(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- coach-state.test`
Expected: FAIL with "Cannot find module '../src/coach-state'"

**Step 3: Implement CoachStateManager**

```typescript
// src/coach-state.ts
// ABOUTME: Manages conversation state including creation, title generation, and pruning.
// ABOUTME: Provides utilities for conversation lifecycle management.

import { CoachState, CoachConversation } from "./types";
import { v4 as uuidv4 } from "uuid";

export class CoachStateManager {
  /**
   * Create a new conversation with UUID and initial state.
   */
  createConversation(systemPrompt: string): CoachConversation {
    const now = Date.now();
    return {
      id: uuidv4(),
      title: "New conversation",
      messages: [],
      systemPrompt,
      createdAt: now,
      lastUpdatedAt: now,
    };
  }

  /**
   * Generate conversation title from first user message.
   * Truncates to 50 characters if necessary.
   */
  updateConversationTitle(firstMessage: string): string {
    const maxLength = 50;
    if (firstMessage.length <= maxLength) {
      return firstMessage;
    }
    return firstMessage.slice(0, maxLength);
  }

  /**
   * Prune conversations to keep last 50, sorted by creation date.
   * Returns new state with pruned conversations.
   */
  pruneOldConversations(state: CoachState): CoachState {
    const maxConversations = 50;

    if (state.conversations.length <= maxConversations) {
      return state;
    }

    // Sort by creation date descending (newest first)
    const sorted = [...state.conversations].sort((a, b) => b.createdAt - a.createdAt);

    // Keep last 50
    const pruned = sorted.slice(0, maxConversations);

    return {
      ...state,
      conversations: pruned,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- coach-state.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/coach-state.ts tests/coach-state.test.ts
git commit -m "feat: add coach state management with conversation lifecycle"
```

---

## Task 3: Rename CLI Tools to Coach Tools

**Files:**

- Rename: `src/cli-tools.ts` → `src/coach-tools.ts`
- Modify: `src/coach-tools.ts`
- Rename: `tests/cli-tools.test.ts` → `tests/coach-tools.test.ts`
- Modify: `tests/coach-tools.test.ts`
- Modify: `tests/cli-tools-execution.test.ts`

**Step 1: Write failing test for display tools**

```typescript
// tests/coach-tools.test.ts (add to existing tests)
describe("Display tools", () => {
  describe("show_project_card", () => {
    it("should be defined in COACH_TOOLS", () => {
      const tool = COACH_TOOLS.find((t) => t.name === "show_project_card");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Display a project card");
    });
  });

  describe("show_action_card", () => {
    it("should be defined in COACH_TOOLS", () => {
      const tool = COACH_TOOLS.find((t) => t.name === "show_action_card");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Display a next action card");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- coach-tools.test`
Expected: FAIL with "Cannot find name 'COACH_TOOLS'"

**Step 3: Rename file and update exports**

```bash
# Rename file
mv src/cli-tools.ts src/coach-tools.ts
mv tests/cli-tools.test.ts tests/coach-tools.test.ts

# Update file headers
# src/coach-tools.ts
# ABOUTME: Defines coach tools for LLM to suggest vault modifications and display cards
# ABOUTME: ToolExecutor routes tool calls to appropriate file operations

# Update exports
# Change CLI_TOOLS to COACH_TOOLS in src/coach-tools.ts
export const COACH_TOOLS: ToolDefinition[] = [
  // ... existing tools ...
];
```

**Step 4: Add display tools to COACH_TOOLS**

```typescript
// src/coach-tools.ts (add to COACH_TOOLS array)
{
  name: "show_project_card",
  description: "Display a project card in the conversation with structured project details",
  input_schema: {
    type: "object",
    properties: {
      project_file: {
        type: "string",
        description: "File path of the project to display",
      },
    },
    required: ["project_file"],
  },
},
{
  name: "show_action_card",
  description: "Display a next action card in the conversation with structured action details",
  input_schema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "File path containing the action",
      },
      line_number: {
        type: "number",
        description: "Line number of the action in the file",
      },
    },
    required: ["file", "line_number"],
  },
},
```

**Step 5: Update tests to use new naming**

```typescript
// tests/coach-tools.test.ts
import { COACH_TOOLS, ToolExecutor } from "../src/coach-tools";
// ... update all CLI_TOOLS references to COACH_TOOLS ...
```

**Step 6: Update cli-tools-execution.test.ts imports**

```typescript
// tests/cli-tools-execution.test.ts
import { COACH_TOOLS, ToolExecutor } from "../src/coach-tools";
// ... update references ...
```

**Step 7: Run tests to verify they pass**

Run: `npm test -- coach-tools.test cli-tools-execution.test`
Expected: PASS

**Step 8: Commit**

```bash
git add src/coach-tools.ts tests/coach-tools.test.ts tests/cli-tools-execution.test.ts
git rm src/cli-tools.ts tests/cli-tools.test.ts
git commit -m "refactor: rename CLI tools to coach tools and add display tools"
```

---

## Task 4: Coach Message Renderer

**Files:**

- Create: `src/coach-message-renderer.ts`
- Create: `tests/coach-message-renderer.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/coach-message-renderer.test.ts
import { CoachMessageRenderer } from "../src/coach-message-renderer";
import { ChatMessage } from "../src/language-model";
import { ProjectCardData, ActionCardData, ToolApprovalBlock } from "../src/types";

describe("CoachMessageRenderer", () => {
  let renderer: CoachMessageRenderer;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    renderer = new CoachMessageRenderer();
  });

  describe("renderMessage", () => {
    it("should render user message with right alignment", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Test message",
      };

      renderer.renderMessage(container, message);

      const messageEl = container.querySelector(".coach-message-user");
      expect(messageEl).toBeTruthy();
      expect(messageEl?.textContent).toContain("Test message");
    });

    it("should render assistant message with markdown", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "**Bold** text and *italic* text",
      };

      renderer.renderMessage(container, message);

      const messageEl = container.querySelector(".coach-message-assistant");
      expect(messageEl).toBeTruthy();
      expect(messageEl?.innerHTML).toContain("<strong>Bold</strong>");
      expect(messageEl?.innerHTML).toContain("<em>italic</em>");
    });

    it("should not render system messages", () => {
      const message: ChatMessage = {
        role: "system",
        content: "System prompt",
      };

      renderer.renderMessage(container, message);

      expect(container.children.length).toBe(0);
    });
  });

  describe("renderProjectCard", () => {
    it("should render project card with all details", () => {
      const cardData: ProjectCardData = {
        title: "Test Project",
        description: "Test description",
        priority: 1,
        status: "live",
        nextActionsCount: 3,
        file: "Projects/test.md",
      };

      const cardEl = renderer.renderProjectCard(cardData);

      expect(cardEl.querySelector(".coach-card-title")?.textContent).toContain("Test Project");
      expect(cardEl.querySelector(".coach-card-description")?.textContent).toContain(
        "Test description"
      );
      expect(cardEl.querySelector(".coach-card-meta")?.textContent).toContain("Priority: 1");
      expect(cardEl.querySelector(".coach-card-meta")?.textContent).toContain("Status: live");
      expect(cardEl.querySelector(".coach-card-actions")?.textContent).toContain("3 next actions");
    });

    it("should be clickable and emit file path", () => {
      const cardData: ProjectCardData = {
        title: "Test Project",
        description: "Test description",
        priority: 1,
        status: "live",
        nextActionsCount: 3,
        file: "Projects/test.md",
      };

      let clickedFile: string | null = null;
      const cardEl = renderer.renderProjectCard(cardData, (file) => {
        clickedFile = file;
      });

      cardEl.click();
      expect(clickedFile).toBe("Projects/test.md");
    });
  });

  describe("renderActionCard", () => {
    it("should render action card with all details", () => {
      const cardData: ActionCardData = {
        text: "Call Dr. Smith",
        file: "Projects/health.md",
        lineNumber: 10,
        status: "incomplete",
      };

      const cardEl = renderer.renderActionCard(cardData);

      expect(cardEl.querySelector(".coach-card-title")?.textContent).toContain("Call Dr. Smith");
      expect(cardEl.querySelector(".coach-card-meta")?.textContent).toContain("health.md");
      expect(cardEl.querySelector(".coach-card-status")?.textContent).toContain("incomplete");
    });

    it("should be clickable and emit file path and line number", () => {
      const cardData: ActionCardData = {
        text: "Call Dr. Smith",
        file: "Projects/health.md",
        lineNumber: 10,
        status: "incomplete",
      };

      let clicked: { file: string; line: number } | null = null;
      const cardEl = renderer.renderActionCard(cardData, (file, line) => {
        clicked = { file, line };
      });

      cardEl.click();
      expect(clicked).toEqual({ file: "Projects/health.md", line: 10 });
    });
  });

  describe("renderToolApprovalBlock", () => {
    it("should render pending approval block with buttons", () => {
      const block: ToolApprovalBlock = {
        toolCall: {
          id: "test-id",
          name: "move_to_focus",
          input: {
            action_text: "Test action",
            project_path: "Projects/test.md",
          },
        },
        status: "pending",
      };

      const blockEl = renderer.renderToolApprovalBlock(block);

      expect(blockEl.querySelector(".coach-tool-name")?.textContent).toContain("move_to_focus");
      expect(blockEl.querySelector(".coach-tool-description")?.textContent).toContain(
        "Test action"
      );
      expect(blockEl.querySelector(".coach-tool-approve")).toBeTruthy();
      expect(blockEl.querySelector(".coach-tool-reject")).toBeTruthy();
    });

    it("should emit approve event when approve button clicked", () => {
      const block: ToolApprovalBlock = {
        toolCall: {
          id: "test-id",
          name: "move_to_focus",
          input: {},
        },
        status: "pending",
      };

      let approved = false;
      const blockEl = renderer.renderToolApprovalBlock(block, {
        onApprove: () => {
          approved = true;
        },
        onReject: () => {},
      });

      const approveBtn = blockEl.querySelector(".coach-tool-approve") as HTMLButtonElement;
      approveBtn?.click();

      expect(approved).toBe(true);
    });

    it("should render approved block without buttons", () => {
      const block: ToolApprovalBlock = {
        toolCall: {
          id: "test-id",
          name: "move_to_focus",
          input: {},
        },
        status: "approved",
        result: "Success",
      };

      const blockEl = renderer.renderToolApprovalBlock(block);

      expect(blockEl.querySelector(".coach-tool-approve")).toBeNull();
      expect(blockEl.querySelector(".coach-tool-status")?.textContent).toContain("Applied");
      expect(blockEl.querySelector(".coach-tool-result")?.textContent).toContain("Success");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- coach-message-renderer.test`
Expected: FAIL with "Cannot find module '../src/coach-message-renderer'"

**Step 3: Implement CoachMessageRenderer**

```typescript
// src/coach-message-renderer.ts
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
  renderProjectCard(data: ProjectCardData, onClick?: (file: string) => void): HTMLElement {
    const cardEl = document.createElement("div");
    cardEl.className = "coach-card coach-card-project";

    if (onClick) {
      cardEl.style.cursor = "pointer";
      cardEl.addEventListener("click", () => onClick(data.file));
    }

    // Title with icon
    const titleEl = cardEl.createDiv({ cls: "coach-card-title" });
    titleEl.innerHTML = `🎯 ${data.title}`;

    // Meta (priority, status, actions count)
    const metaEl = cardEl.createDiv({ cls: "coach-card-meta" });
    metaEl.setText(`Priority: ${data.priority} • Status: ${data.status}`);

    const actionsEl = cardEl.createDiv({ cls: "coach-card-actions" });
    actionsEl.setText(`${data.nextActionsCount} next actions`);

    // Description
    if (data.description) {
      const descEl = cardEl.createDiv({ cls: "coach-card-description" });
      descEl.setText(data.description);
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
    const cardEl = document.createElement("div");
    cardEl.className = "coach-card coach-card-action";

    if (onClick) {
      cardEl.style.cursor = "pointer";
      cardEl.addEventListener("click", () => onClick(data.file, data.lineNumber));
    }

    // Title (action text) with checkbox icon
    const titleEl = cardEl.createDiv({ cls: "coach-card-title" });
    titleEl.innerHTML = `☑️ ${data.text}`;

    // Meta (file name)
    const metaEl = cardEl.createDiv({ cls: "coach-card-meta" });
    const fileName = data.file.split("/").pop() || data.file;
    metaEl.setText(fileName);

    // Status
    const statusEl = cardEl.createDiv({ cls: "coach-card-status" });
    statusEl.setText(data.status);

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
    const blockEl = document.createElement("div");
    blockEl.className = `coach-tool-block coach-tool-${block.status}`;

    // Tool name
    const nameEl = blockEl.createDiv({ cls: "coach-tool-name" });
    nameEl.setText(this.formatToolName(block.toolCall.name));

    // Tool description (formatted from input)
    const descEl = blockEl.createDiv({ cls: "coach-tool-description" });
    descEl.setText(this.formatToolDescription(block.toolCall));

    if (block.status === "pending") {
      // Show approve/reject buttons
      const buttonsEl = blockEl.createDiv({ cls: "coach-tool-buttons" });

      const approveBtn = buttonsEl.createEl("button", {
        cls: "coach-tool-approve",
        text: "Approve",
      });
      approveBtn.addEventListener("click", () => callbacks?.onApprove?.());

      const rejectBtn = buttonsEl.createEl("button", {
        cls: "coach-tool-reject",
        text: "Reject",
      });
      rejectBtn.addEventListener("click", () => callbacks?.onReject?.());
    } else {
      // Show status
      const statusEl = blockEl.createDiv({ cls: "coach-tool-status" });
      statusEl.setText(this.formatStatus(block.status));

      // Show result or error
      if (block.result) {
        const resultEl = blockEl.createDiv({ cls: "coach-tool-result" });
        resultEl.setText(block.result);
      } else if (block.error) {
        const errorEl = blockEl.createDiv({ cls: "coach-tool-error" });
        errorEl.setText(block.error);
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
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- coach-message-renderer.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/coach-message-renderer.ts tests/coach-message-renderer.test.ts
git commit -m "feat: add coach message renderer with markdown, cards, and tool approvals"
```

---

## Task 5: Coach Protocol Banner

**Files:**

- Create: `src/coach-protocol-banner.ts`
- Create: `tests/coach-protocol-banner.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/coach-protocol-banner.test.ts
import { CoachProtocolBanner } from "../src/coach-protocol-banner";
import { ReviewProtocol } from "../src/types";

describe("CoachProtocolBanner", () => {
  let banner: CoachProtocolBanner;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    banner = new CoachProtocolBanner();
  });

  describe("render", () => {
    it("should not render if no protocols", () => {
      banner.render(container, []);
      expect(container.children.length).toBe(0);
    });

    it("should render single protocol with simple layout", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      banner.render(container, protocols);

      expect(container.querySelector(".coach-protocol-banner")).toBeTruthy();
      expect(container.textContent).toContain("Weekly Review is available");
      expect(container.querySelector(".coach-protocol-start")).toBeTruthy();
      expect(container.querySelector(".coach-protocol-dismiss")).toBeTruthy();
    });

    it("should render multiple protocols with bulleted list", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test 1",
          triggers: [],
        },
        {
          name: "Project Review",
          filename: "project.md",
          content: "Test 2",
          triggers: [],
        },
      ];

      banner.render(container, protocols);

      expect(container.textContent).toContain("Reviews available");
      expect(container.querySelectorAll(".coach-protocol-item").length).toBe(2);
      expect(container.querySelectorAll(".coach-protocol-start").length).toBe(2);
    });

    it("should emit start event when protocol selected", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      let selectedProtocol: ReviewProtocol | null = null;
      banner.render(container, protocols, {
        onStart: (protocol) => {
          selectedProtocol = protocol;
        },
      });

      const startBtn = container.querySelector(".coach-protocol-start") as HTMLButtonElement;
      startBtn?.click();

      expect(selectedProtocol).toEqual(protocols[0]);
    });

    it("should emit dismiss event and hide banner", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      let dismissed = false;
      banner.render(container, protocols, {
        onDismiss: () => {
          dismissed = true;
        },
      });

      const dismissBtn = container.querySelector(".coach-protocol-dismiss") as HTMLButtonElement;
      dismissBtn?.click();

      expect(dismissed).toBe(true);
      expect(container.querySelector(".coach-protocol-banner")).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- coach-protocol-banner.test`
Expected: FAIL with "Cannot find module '../src/coach-protocol-banner'"

**Step 3: Implement CoachProtocolBanner**

```typescript
// src/coach-protocol-banner.ts
// ABOUTME: Renders protocol suggestion banner with start/dismiss actions.
// ABOUTME: Handles single and multiple protocol layouts.

import { ReviewProtocol } from "./types";

export interface ProtocolBannerCallbacks {
  onStart?: (protocol: ReviewProtocol) => void;
  onDismiss?: () => void;
}

export class CoachProtocolBanner {
  /**
   * Render protocol banner to container.
   * Different layouts for single vs multiple protocols.
   */
  render(
    container: HTMLElement,
    protocols: ReviewProtocol[],
    callbacks?: ProtocolBannerCallbacks
  ): void {
    if (protocols.length === 0) {
      return;
    }

    const bannerEl = container.createDiv({ cls: "coach-protocol-banner" });

    if (protocols.length === 1) {
      // Simple layout for single protocol
      this.renderSingleProtocol(bannerEl, protocols[0], callbacks);
    } else {
      // List layout for multiple protocols
      this.renderMultipleProtocols(bannerEl, protocols, callbacks);
    }
  }

  private renderSingleProtocol(
    container: HTMLElement,
    protocol: ReviewProtocol,
    callbacks?: ProtocolBannerCallbacks
  ): void {
    const textEl = container.createDiv({ cls: "coach-protocol-text" });
    textEl.setText(`📅 ${protocol.name} is available`);

    const buttonsEl = container.createDiv({ cls: "coach-protocol-buttons" });

    const startBtn = buttonsEl.createEl("button", {
      cls: "coach-protocol-start",
      text: "Start",
    });
    startBtn.addEventListener("click", () => {
      callbacks?.onStart?.(protocol);
      container.remove();
    });

    const dismissBtn = buttonsEl.createEl("button", {
      cls: "coach-protocol-dismiss",
      text: "Dismiss",
    });
    dismissBtn.addEventListener("click", () => {
      callbacks?.onDismiss?.();
      container.remove();
    });
  }

  private renderMultipleProtocols(
    container: HTMLElement,
    protocols: ReviewProtocol[],
    callbacks?: ProtocolBannerCallbacks
  ): void {
    const textEl = container.createDiv({ cls: "coach-protocol-text" });
    textEl.setText("📅 Reviews available:");

    const listEl = container.createEl("ul", { cls: "coach-protocol-list" });

    for (const protocol of protocols) {
      const itemEl = listEl.createEl("li", { cls: "coach-protocol-item" });
      itemEl.setText(`• ${protocol.name} `);

      const startBtn = itemEl.createEl("button", {
        cls: "coach-protocol-start",
        text: "[Start]",
      });
      startBtn.addEventListener("click", () => {
        callbacks?.onStart?.(protocol);
        container.remove();
      });
    }

    const dismissBtn = container.createEl("button", {
      cls: "coach-protocol-dismiss",
      text: "Dismiss All",
    });
    dismissBtn.addEventListener("click", () => {
      callbacks?.onDismiss?.();
      container.remove();
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- coach-protocol-banner.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/coach-protocol-banner.ts tests/coach-protocol-banner.test.ts
git commit -m "feat: add protocol suggestion banner component"
```

---

## Task 6: Flow Coach View (Part 1 - Basic Structure)

**Files:**

- Create: `src/flow-coach-view.ts`
- Create: `tests/flow-coach-view.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/flow-coach-view.test.ts
import { FlowCoachView, FLOW_COACH_VIEW_TYPE } from "../src/flow-coach-view";
import { WorkspaceLeaf } from "obsidian";
import { PluginSettings } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

describe("FlowCoachView", () => {
  let view: FlowCoachView;
  let mockLeaf: WorkspaceLeaf;
  let mockSettings: PluginSettings;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockLeaf = {} as WorkspaceLeaf;
    mockSettings = {
      aiEnabled: true,
      llmProvider: "anthropic",
      anthropicApiKey: generateDeterministicFakeApiKey("test"),
      anthropicModel: "claude-sonnet-4-20250514",
      openaiApiKey: "",
      openaiBaseUrl: "",
      openaiModel: "",
      defaultPriority: 2,
      defaultStatus: "live",
      inboxFilesFolderPath: "Inbox",
      inboxFolderPath: "Inbox",
      processedInboxFolderPath: "Processed",
      nextActionsFilePath: "Next actions.md",
      somedayFilePath: "Someday.md",
      projectsFolderPath: "Projects",
      projectTemplateFilePath: "",
      spheres: ["personal", "work"],
      focusAutoClearTime: "",
      focusArchiveFile: "Archive.md",
      lastFocusClearTimestamp: 0,
      inboxFileProcessingThreshold: 10,
    };
    mockSaveSettings = jest.fn().mockResolvedValue(undefined);

    view = new FlowCoachView(mockLeaf, mockSettings, mockSaveSettings);
  });

  describe("View metadata", () => {
    it("should return correct view type", () => {
      expect(view.getViewType()).toBe(FLOW_COACH_VIEW_TYPE);
    });

    it("should return correct display text", () => {
      expect(view.getDisplayText()).toBe("Flow Coach");
    });

    it("should return correct icon", () => {
      expect(view.getIcon()).toBe("message-circle");
    });
  });

  describe("onOpen", () => {
    it("should render header with title and dropdown", async () => {
      await view.onOpen();

      const container = view.containerEl.children[1];
      expect(container.querySelector(".coach-header")).toBeTruthy();
      expect(container.querySelector(".coach-title")?.textContent).toBe("Flow Coach");
      expect(container.querySelector(".coach-conversation-dropdown")).toBeTruthy();
    });

    it("should render empty state for new conversation", async () => {
      await view.onOpen();

      const container = view.containerEl.children[1];
      expect(container.querySelector(".coach-messages")).toBeTruthy();
      expect(container.querySelector(".coach-input-area")).toBeTruthy();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- flow-coach-view.test`
Expected: FAIL with "Cannot find module '../src/flow-coach-view'"

**Step 3: Implement basic FlowCoachView structure**

```typescript
// src/flow-coach-view.ts
// ABOUTME: Main view for Flow Coach chat interface with conversation management.
// ABOUTME: Handles message rendering, protocol banners, tool approvals, and input.

import { ItemView, WorkspaceLeaf } from "obsidian";
import { PluginSettings, CoachState, CoachConversation } from "./types";
import { CoachStateManager } from "./coach-state";
import { CoachMessageRenderer } from "./coach-message-renderer";
import { CoachProtocolBanner } from "./coach-protocol-banner";
import { scanReviewProtocols } from "./protocol-scanner";
import { matchProtocolsForTime } from "./protocol-matcher";

export const FLOW_COACH_VIEW_TYPE = "flow-coach-view";

export class FlowCoachView extends ItemView {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private stateManager: CoachStateManager;
  private messageRenderer: CoachMessageRenderer;
  private protocolBanner: CoachProtocolBanner;
  private state: CoachState;
  private activeConversation: CoachConversation | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, saveSettings: () => Promise<void>) {
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- flow-coach-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/flow-coach-view.ts tests/flow-coach-view.test.ts
git commit -m "feat: add flow coach view basic structure with header and input"
```

---

## Task 7: Flow Coach View (Part 2 - Conversation Management)

**Note:** This task builds on Task 6. Add to existing files.

**Step 1: Write failing tests**

```typescript
// tests/flow-coach-view.test.ts (add to existing tests)
describe("Conversation management", () => {
  it("should create new conversation on startup", async () => {
    await view.onOpen();

    // Should have created a conversation
    expect(view["activeConversation"]).toBeTruthy();
    expect(view["state"].conversations.length).toBe(1);
  });

  it("should switch to existing conversation", async () => {
    await view.onOpen();

    const firstConversation = view["activeConversation"];

    // Start new conversation
    view["startNewConversation"]();

    expect(view["activeConversation"]?.id).not.toBe(firstConversation?.id);
    expect(view["state"].conversations.length).toBe(2);

    // Switch back to first
    view["switchConversation"](firstConversation!.id);

    expect(view["activeConversation"]?.id).toBe(firstConversation?.id);
  });

  it("should save state after creating conversation", async () => {
    await view.onOpen();

    expect(mockSaveSettings).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- flow-coach-view.test`
Expected: FAIL (conversation not created on startup)

**Step 3: Implement conversation management**

```typescript
// src/flow-coach-view.ts (add methods)

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
      this.activeConversation = this.state.conversations.find(
        (c) => c.id === this.state.activeConversationId
      ) || null;
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

private async loadState(): Promise<void> {
  // Load from plugin data (implement after integrating with main.ts)
  // For now, use empty state
  this.state = {
    conversations: [],
    activeConversationId: null,
  };
}

private async saveState(): Promise<void> {
  // Save to plugin data
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

private switchConversation(conversationId: string): void {
  const conversation = this.state.conversations.find((c) => c.id === conversationId);

  if (conversation) {
    this.activeConversation = conversation;
    this.state.activeConversationId = conversationId;
    this.saveState();
    this.refresh();
  }
}

private async buildSystemPrompt(): Promise<string> {
  // Placeholder - will implement with actual scanning
  return "You are a GTD coach.";
}

private renderProtocolBanner(container: HTMLElement): void {
  // Scan for protocols
  const vaultPath = (this.app.vault.adapter as any).basePath;
  const protocols = scanReviewProtocols(vaultPath);
  const matched = matchProtocolsForTime(protocols, new Date());

  // Only show if conversation is new (no messages)
  if (this.activeConversation && this.activeConversation.messages.length === 0) {
    this.protocolBanner.render(container, matched, {
      onStart: (protocol) => this.startProtocol(protocol),
      onDismiss: () => {
        // Banner removes itself
      },
    });
  }
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- flow-coach-view.test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/flow-coach-view.ts tests/flow-coach-view.test.ts
git commit -m "feat: add conversation management to flow coach view"
```

---

## Task 8: Integration with main.ts

**Files:**

- Modify: `main.ts`
- Modify: `src/types.ts`

**Step 1: Write failing test**

```typescript
// tests/main.test.ts (add to existing tests)
describe("Flow Coach View registration", () => {
  it("should register flow-coach-view on load", async () => {
    await plugin.onload();

    const viewTypes = Object.keys(plugin.app.workspace.viewRegistry);
    expect(viewTypes).toContain("flow-coach-view");
  });

  it("should register open-flow-coach command", async () => {
    await plugin.onload();

    const commands = plugin.app.commands.commands;
    expect(commands["flow:open-flow-coach"]).toBeDefined();
  });

  it("should load and save coach state", async () => {
    // Set initial data
    plugin.app.vault.adapter.write = jest.fn();
    plugin.app.vault.adapter.read = jest.fn().mockResolvedValue(
      JSON.stringify({
        settings: {},
        coachState: {
          conversations: [
            {
              id: "test-id",
              title: "Test",
              messages: [],
              systemPrompt: "prompt",
              createdAt: 123,
              lastUpdatedAt: 123,
            },
          ],
          activeConversationId: "test-id",
        },
      })
    );

    await plugin.onload();

    expect(plugin["coachState"]).toBeDefined();
    expect(plugin["coachState"].conversations.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- main.test`
Expected: FAIL (flow-coach-view not registered)

**Step 3: Update main.ts**

```typescript
// main.ts (add to FlowPlugin class)
import { FlowCoachView, FLOW_COACH_VIEW_TYPE } from "./flow-coach-view";
import { CoachState } from "./types";

export default class FlowPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  coachState: CoachState = {
    conversations: [],
    activeConversationId: null,
  };

  async onload() {
    // Load data
    await this.loadSettings();

    // Register Flow Coach View
    this.registerView(
      FLOW_COACH_VIEW_TYPE,
      (leaf) => new FlowCoachView(leaf, this.settings, () => this.saveSettings())
    );

    // Add command to open Flow Coach
    this.addCommand({
      id: "open-flow-coach",
      name: "Open Flow Coach",
      callback: () => {
        this.activateFlowCoachView();
      },
    });

    // ... existing code ...
  }

  async activateFlowCoachView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(FLOW_COACH_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already exists, activate it
      leaf = leaves[0];
    } else {
      // Create new view in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: FLOW_COACH_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async loadSettings() {
    const data = await this.loadData();
    if (data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || data);
      this.coachState = data.coachState || {
        conversations: [],
        activeConversationId: null,
      };
    }
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      coachState: this.coachState,
    });
  }
}
```

**Step 4: Update FlowCoachView to use plugin state**

```typescript
// src/flow-coach-view.ts (update constructor and methods)
export class FlowCoachView extends ItemView {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;
  private getState: () => CoachState;
  private setState: (state: CoachState) => void;
  // ... other fields ...

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
    // ... rest of constructor ...
  }

  private async loadState(): Promise<void> {
    this.state = this.getState();
  }

  private async saveState(): Promise<void> {
    this.setState(this.state);
    await this.saveSettings();
  }
}
```

**Step 5: Update main.ts to pass state accessors**

```typescript
// main.ts (update FlowCoachView registration)
this.registerView(
  FLOW_COACH_VIEW_TYPE,
  (leaf) =>
    new FlowCoachView(
      leaf,
      this.settings,
      () => this.saveSettings(),
      () => this.coachState,
      (state) => {
        this.coachState = state;
      }
    )
);
```

**Step 6: Run test to verify it passes**

Run: `npm test -- main.test`
Expected: PASS

**Step 7: Commit**

```bash
git add main.ts src/flow-coach-view.ts src/types.ts tests/main.test.ts
git commit -m "feat: integrate flow coach view with main plugin"
```

---

## Task 9: Remove CLI Files

**Files:**

- Delete: `src/cli.tsx`
- Delete: `src/cli-entry.mts`
- Delete: `src/obsidian-compat.ts`
- Delete: `src/cli-approval.ts`
- Delete: `src/components/InboxApp.tsx`
- Delete: `esbuild.cli.mjs`
- Delete: `docs/gtd-coach-cli.md`
- Delete: `docs/cli-architecture.md`
- Delete: `docs/cli-ink-usage.md`
- Delete: `docs/manual-testing-custom-reviews.md`
- Delete tests: `tests/cli.test.ts`, `tests/cli-approval.test.ts`, `tests/cli-opening-message.test.ts`, `tests/cli-protocol-integration.test.ts`, `tests/cli-repl-tools.test.ts`, `tests/cli-system-prompt.test.ts`, `tests/components/InboxApp.test.tsx`
- Modify: `package.json` (remove CLI scripts and Ink dependencies)

**Step 1: Run tests to ensure existing tests pass**

Run: `npm test`
Expected: PASS (all existing tests pass before deletion)

**Step 2: Remove CLI source files**

```bash
git rm src/cli.tsx
git rm src/cli-entry.mts
git rm src/obsidian-compat.ts
git rm src/cli-approval.ts
git rm src/components/InboxApp.tsx
git rm esbuild.cli.mjs
```

**Step 3: Remove CLI documentation**

```bash
git rm docs/gtd-coach-cli.md
git rm docs/cli-architecture.md
git rm docs/cli-ink-usage.md
git rm docs/manual-testing-custom-reviews.md
```

**Step 4: Remove CLI tests**

```bash
git rm tests/cli.test.ts
git rm tests/cli-approval.test.ts
git rm tests/cli-opening-message.test.ts
git rm tests/cli-protocol-integration.test.ts
git rm tests/cli-repl-tools.test.ts
git rm tests/cli-system-prompt.test.ts
git rm tests/components/InboxApp.test.tsx
```

**Step 5: Update package.json**

```json
// package.json (remove these)
{
  "scripts": {
    // Remove these lines:
    "build:cli": "node esbuild.cli.mjs",
    "cli": "node dist/cli.mjs"
  },
  "dependencies": {
    // Remove these:
    "ink": "^5.2.1",
    "react": "^18.3.1",
    "wrap-ansi": "^9.0.0"
  },
  "devDependencies": {
    // Remove these:
    "@types/react": "^18.3.11"
  }
}
```

**Step 6: Run tests to ensure nothing broke**

Run: `npm test`
Expected: PASS (all remaining tests pass)

**Step 7: Commit**

```bash
git add package.json
git commit -m "refactor: remove CLI code, tests, docs, and dependencies"
```

---

## Task 10: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Remove CLI documentation**

Remove these sections from CLAUDE.md:

- "GTD Coach CLI" section under Common Commands
- "CLI Tools" paragraph in Architecture section
- Reference to `cli-tools.ts` (update to `coach-tools.ts`)
- CLI test files from Test Files section

**Step 2: Add Flow Coach documentation**

Add new section under "Architecture":

```markdown
### Flow Coach Chat Pane

The plugin provides an in-Obsidian chat interface for GTD coaching conversations:

- **FlowCoachView** (`src/flow-coach-view.ts`) - Chat pane view with conversation history
- **CoachState** (`src/coach-state.ts`) - Conversation persistence and management
- **CoachMessageRenderer** (`src/coach-message-renderer.ts`) - Message, card, and approval rendering
- **CoachTools** (`src/coach-tools.ts`) - LLM tools for vault modifications and display cards
- **CoachProtocolBanner** (`src/coach-protocol-banner.ts`) - Protocol suggestion UI

**Features:**

- Persistent conversation history across sessions
- Multi-sphere access with protocol filtering
- Inline tool approvals for suggested changes
- Structured project/action cards
- Protocol auto-suggestions based on time
- Markdown message rendering

**Commands:**

- `open-flow-coach` - Opens Flow Coach view in right sidebar
```

**Step 3: Update test files list**

Update the test files section to reflect:

- Removed: All CLI test files
- Renamed: `cli-tools.test.ts` → `coach-tools.test.ts`
- Added: `coach-state.test.ts`, `coach-message-renderer.test.ts`, `flow-coach-view.test.ts`

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect CLI removal and coach pane addition"
```

---

## Task 11: Add CSS Styling

**Files:**

- Create: `styles/coach.css`
- Modify: `styles.css` (import coach.css)

**Step 1: Create coach.css**

```css
/* styles/coach.css */

/* Flow Coach View Container */
.flow-coach-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
}

/* Header */
.coach-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--background-modifier-border);
}

.coach-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.coach-conversation-dropdown {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
}

/* Protocol Banner */
.coach-protocol-banner {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--background-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--interactive-accent);
}

.coach-protocol-text {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.coach-protocol-list {
  list-style: none;
  margin: 0.5rem 0;
  padding: 0;
}

.coach-protocol-item {
  margin: 0.25rem 0;
}

.coach-protocol-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.coach-protocol-start {
  padding: 0.25rem 0.75rem;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.coach-protocol-dismiss {
  padding: 0.25rem 0.75rem;
  background: var(--background-modifier-border);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Messages Area */
.coach-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Messages */
.coach-message {
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 85%;
}

.coach-message-user {
  align-self: flex-end;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  margin-left: auto;
}

.coach-message-assistant {
  align-self: flex-start;
  background: var(--background-secondary);
}

/* Cards */
.coach-card {
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 8px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary-alt);
}

.coach-card:hover {
  border-color: var(--interactive-accent);
}

.coach-card-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.coach-card-meta {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.coach-card-description {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.coach-card-actions {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.coach-card-status {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Tool Approval Blocks */
.coach-tool-block {
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 8px;
  border-left: 3px solid var(--background-modifier-border);
}

.coach-tool-pending {
  background: var(--background-secondary);
  border-left-color: var(--text-warning);
}

.coach-tool-approved {
  background: var(--background-secondary);
  border-left-color: var(--text-success);
}

.coach-tool-rejected {
  background: var(--background-secondary);
  border-left-color: var(--text-muted);
  opacity: 0.7;
}

.coach-tool-error {
  background: var(--background-secondary);
  border-left-color: var(--text-error);
}

.coach-tool-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.coach-tool-description {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.coach-tool-buttons {
  display: flex;
  gap: 0.5rem;
}

.coach-tool-approve {
  padding: 0.5rem 1rem;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.coach-tool-reject {
  padding: 0.5rem 1rem;
  background: var(--background-modifier-border);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.coach-tool-status {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.coach-tool-result,
.coach-tool-error {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.coach-tool-error {
  color: var(--text-error);
}

/* Input Area */
.coach-input-area {
  border-top: 1px solid var(--background-modifier-border);
  padding-top: 1rem;
}

.coach-input {
  width: 100%;
  min-height: 60px;
  padding: 0.5rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  resize: vertical;
  font-family: var(--font-interface);
  margin-bottom: 0.5rem;
}

.coach-input-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.coach-send-btn {
  padding: 0.5rem 1.5rem;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.coach-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.coach-reset-btn {
  padding: 0.5rem 1rem;
  background: var(--background-modifier-border);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

**Step 2: Import in main styles.css**

```css
/* styles.css */
@import "coach.css";
```

**Step 3: Commit**

```bash
git add styles/coach.css styles.css
git commit -m "style: add CSS styling for flow coach view"
```

---

## Execution Choice

Plan complete and saved to `docs/plans/2025-11-02-flow-coach-chat-pane.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
