import {
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolCallResponse,
  LanguageModelClient,
} from "../src/language-model";

describe("Tool Support Types", () => {
  it("should allow ToolDefinition with proper schema", () => {
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      input_schema: {
        type: "object",
        properties: {
          param1: { type: "string", description: "First parameter" },
        },
        required: ["param1"],
      },
    };

    expect(tool.name).toBe("test_tool");
    expect(tool.input_schema.properties).toBeDefined();
  });

  it("should allow ToolCall with id, name, and input", () => {
    const call: ToolCall = {
      id: "call_123",
      name: "test_tool",
      input: { param1: "value1" },
    };

    expect(call.id).toBe("call_123");
    expect(call.input.param1).toBe("value1");
  });

  it("should allow ToolResult with success", () => {
    const result: ToolResult = {
      tool_use_id: "call_123",
      content: "Success",
      is_error: false,
    };

    expect(result.tool_use_id).toBe("call_123");
    expect(result.is_error).toBe(false);
  });

  it("should allow ToolResult with error", () => {
    const result: ToolResult = {
      tool_use_id: "call_123",
      content: "Error occurred",
      is_error: true,
    };

    expect(result.is_error).toBe(true);
  });

  it("should allow ToolCallResponse with text only", () => {
    const response: ToolCallResponse = {
      content: "Here is some text",
      stopReason: "end_turn",
    };

    expect(response.content).toBe("Here is some text");
    expect(response.toolCalls).toBeUndefined();
  });

  it("should allow ToolCallResponse with tool calls", () => {
    const response: ToolCallResponse = {
      content: "I will use this tool",
      toolCalls: [
        {
          id: "call_1",
          name: "my_tool",
          input: { arg: "value" },
        },
      ],
      stopReason: "tool_use",
    };

    expect(response.toolCalls).toHaveLength(1);
    expect(response.stopReason).toBe("tool_use");
  });

  it("should allow optional sendMessageWithTools on client", () => {
    const mockClient: LanguageModelClient = {
      sendMessage: jest.fn(),
      sendMessageWithTools: jest.fn(),
    };

    expect(typeof mockClient.sendMessage).toBe("function");
    expect(typeof mockClient.sendMessageWithTools).toBe("function");
  });

  it("should allow client without sendMessageWithTools", () => {
    const mockClient: LanguageModelClient = {
      sendMessage: jest.fn(),
    };

    expect(typeof mockClient.sendMessage).toBe("function");
    expect(mockClient.sendMessageWithTools).toBeUndefined();
  });
});
