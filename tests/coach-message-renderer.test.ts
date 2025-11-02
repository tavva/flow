// tests/coach-message-renderer.test.ts
import { CoachMessageRenderer } from "../src/coach-message-renderer";
import { ChatMessage } from "../src/language-model";
import { ProjectCardData, ActionCardData, ToolApprovalBlock } from "../src/types";

// Helper to add Obsidian-specific methods to DOM elements
function addObsidianMethods(element: HTMLElement): void {
  (element as any).createDiv = function (opts?: any) {
    const div = document.createElement("div");
    if (opts?.cls) div.className = opts.cls;
    if (opts?.text) div.textContent = opts.text;
    this.appendChild(div);
    addObsidianMethods(div);
    return div;
  };
  (element as any).createEl = function (tag: string, opts?: any) {
    const el = document.createElement(tag);
    if (opts?.cls) el.className = opts.cls;
    if (opts?.text) el.textContent = opts.text;
    if (opts?.attr) {
      for (const [key, value] of Object.entries(opts.attr)) {
        el.setAttribute(key, value as string);
      }
    }
    this.appendChild(el);
    addObsidianMethods(el);
    return el;
  };
  (element as any).setText = function (text: string) {
    this.textContent = text;
  };
  (element as any).addClass = function (cls: string) {
    this.classList.add(cls);
  };
}

describe("CoachMessageRenderer", () => {
  let renderer: CoachMessageRenderer;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    addObsidianMethods(container);
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

      expect(blockEl.querySelector(".coach-tool-name")?.textContent).toContain("Move To Focus");
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
