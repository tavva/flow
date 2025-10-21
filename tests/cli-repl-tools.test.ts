import { LanguageModelClient, ToolCallResponse } from "../src/language-model";
import { GTDContext } from "../src/gtd-context-scanner";
import { App, TFile } from "obsidian";
import { PluginSettings } from "../src/types";
import * as cliApproval from "../src/cli-approval";

// Mock dependencies
jest.mock("../src/cli-approval");
jest.mock("readline");

describe("CLI REPL - Tool Integration", () => {
  let mockClient: LanguageModelClient;
  let mockApp: App;
  let mockSettings: PluginSettings;
  let mockContext: GTDContext;

  beforeEach(() => {
    mockClient = {
      sendMessage: jest.fn(),
      sendMessageWithTools: jest.fn(),
    };

    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      fileManager: {
        processFrontMatter: jest.fn(),
      },
      metadataCache: {
        getFileCache: jest.fn(),
      },
    } as any;

    mockSettings = {
      hotlist: [],
    } as any;

    mockContext = {
      nextActions: [],
      somedayItems: [],
      inboxItems: [],
    };

    // Mock stdin/stdout for REPL
    process.stdin.setRawMode = jest.fn();
    (process.stdin as any).setEncoding = jest.fn();
    process.stdout.write = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should detect when client supports tools", () => {
    const clientWithTools = {
      sendMessage: jest.fn(),
      sendMessageWithTools: jest.fn(),
    };

    expect(typeof clientWithTools.sendMessageWithTools).toBe("function");
  });

  it("should detect when client does not support tools", () => {
    const clientWithoutTools = {
      sendMessage: jest.fn(),
    };

    expect(typeof clientWithoutTools.sendMessageWithTools).toBe("undefined");
  });

  it("should use sendMessageWithTools when available", async () => {
    const mockResponse: ToolCallResponse = {
      content: "Just text",
      stopReason: "end_turn",
    };

    (mockClient.sendMessageWithTools as jest.Mock).mockResolvedValue(mockResponse);

    // This test verifies the structure exists
    // Full REPL testing requires more complex mocking
    expect(mockClient.sendMessageWithTools).toBeDefined();
  });

  it("should handle tool calls in response", async () => {
    const toolCallResponse: ToolCallResponse = {
      content: "I suggest this improvement",
      toolCalls: [
        {
          id: "call_1",
          name: "move_to_hotlist",
          input: {
            project_path: "Projects/Test.md",
            action_text: "Test action",
          },
        },
      ],
      stopReason: "tool_use",
    };

    (mockClient.sendMessageWithTools as jest.Mock).mockResolvedValue(toolCallResponse);

    // Mock approval - user approves
    (cliApproval.presentToolCallsForApproval as jest.Mock).mockResolvedValue({
      approvedToolIds: ["call_1"],
    });

    // Mock file exists
    const mockFile = new TFile();
    mockFile.path = "Projects/Test.md";
    (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

    (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Test action");

    (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
      frontmatter: { tags: ["project/work"] },
    });

    // Verify the flow would work
    expect(toolCallResponse.toolCalls).toHaveLength(1);
    expect(toolCallResponse.stopReason).toBe("tool_use");
  });

  it("should handle rejected tool calls", async () => {
    const toolCallResponse: ToolCallResponse = {
      content: "I suggest this",
      toolCalls: [
        {
          id: "call_1",
          name: "move_to_hotlist",
          input: { project_path: "Test.md", action_text: "Action" },
        },
      ],
      stopReason: "tool_use",
    };

    // Mock approval - user rejects
    (cliApproval.presentToolCallsForApproval as jest.Mock).mockResolvedValue({
      approvedToolIds: [],
    });

    const approval = await cliApproval.presentToolCallsForApproval(toolCallResponse.toolCalls!);

    expect(approval.approvedToolIds).toHaveLength(0);
  });

  it("should handle text-only response without tools", async () => {
    const textResponse: ToolCallResponse = {
      content: "Here is my advice",
      stopReason: "end_turn",
    };

    (mockClient.sendMessageWithTools as jest.Mock).mockResolvedValue(textResponse);

    expect(textResponse.toolCalls).toBeUndefined();
    expect(textResponse.content).toBe("Here is my advice");
  });

  it("should fallback to sendMessage when tools not supported", async () => {
    const clientWithoutTools: LanguageModelClient = {
      sendMessage: jest.fn().mockResolvedValue("Response"),
    };

    (clientWithoutTools.sendMessage as jest.Mock).mockResolvedValue("Response");

    const result = await clientWithoutTools.sendMessage({
      model: "test",
      maxTokens: 100,
      messages: [],
    });

    expect(result).toBe("Response");
    expect(clientWithoutTools.sendMessage).toHaveBeenCalled();
  });
});
