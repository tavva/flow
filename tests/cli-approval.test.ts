import { presentToolCallsForApproval, ApprovalResult } from "../src/cli-approval";
import { ToolCall } from "../src/language-model";
import * as readline from "readline";

// Mock readline
jest.mock("readline");

describe("CLI Approval Handler", () => {
  let mockQuestion: jest.Mock;
  let mockClose: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockQuestion = jest.fn();
    mockClose = jest.fn();

    (readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    });

    // Suppress console.log output during tests
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  it("should return empty array for no tool calls", async () => {
    const result = await presentToolCallsForApproval([]);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle single tool approval with 'y'", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test action", project_path: "Projects/Test.md" },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("y");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
    expect(mockClose).toHaveBeenCalled();
  });

  it("should handle single tool approval with 'yes'", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test.md",
          old_action: "Original text",
          new_action: "Better text",
        },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("yes");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
  });

  it("should handle single tool rejection with 'n'", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test", project_path: "Projects/Test.md" },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("n");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with 'all'", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
      {
        id: "call_3",
        name: "add_next_action_to_project",
        input: { project_path: "Projects/Test3.md", action_text: "New action" },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("all");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1", "call_2", "call_3"]);
  });

  it("should handle batch approval with 'none'", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("none");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with empty string (none)", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual([]);
  });

  it("should handle batch approval with comma-separated numbers", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
      {
        id: "call_3",
        name: "add_next_action_to_project",
        input: { project_path: "Projects/Test3.md", action_text: "New action" },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("1,3");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1", "call_3"]);
  });

  it("should handle batch approval with spaces in numbers", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
      {
        id: "call_3",
        name: "add_next_action_to_project",
        input: { project_path: "Projects/Test3.md", action_text: "New action" },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback(" 2 , 3 ");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_2", "call_3"]);
  });

  it("should ignore invalid numbers in batch selection", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test 1", project_path: "Projects/Test1.md" },
      },
      {
        id: "call_2",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test2.md",
          old_action: "Old",
          new_action: "New",
        },
      },
    ];

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("1,5,99");
    });

    const result = await presentToolCallsForApproval(toolCalls);
    expect(result.approvedToolIds).toEqual(["call_1"]);
  });

  it("should include context text when provided", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_1",
        name: "move_to_hotlist",
        input: { action_text: "Test", project_path: "Projects/Test.md" },
      },
    ];

    let capturedOutput = "";
    const originalLog = console.log;
    console.log = jest.fn((...args) => {
      capturedOutput += args.join(" ") + "\n";
    });

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("y");
    });

    await presentToolCallsForApproval(toolCalls, "Here is my reasoning...");

    console.log = originalLog;

    expect(capturedOutput).toContain("Here is my reasoning...");
  });
});
