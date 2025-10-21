import { getAnthropicClient, resetSharedAnthropicClient } from "../src/anthropic-client";
import { LanguageModelRequest, ToolDefinition, ToolCallResponse } from "../src/language-model";

describe("AnthropicClient - Tool Support", () => {
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    resetSharedAnthropicClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should have sendMessageWithTools method", () => {
    const client = getAnthropicClient(mockApiKey);
    expect(client.sendMessageWithTools).toBeDefined();
    expect(typeof client.sendMessageWithTools).toBe("function");
  });

  it("should send tools in Anthropic format", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Response text" }],
      stop_reason: "end_turn",
    });

    // Mock the underlying SDK client
    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test message" }],
    };

    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "A test tool",
        input_schema: {
          type: "object",
          properties: {
            param: { type: "string", description: "A parameter" },
          },
          required: ["param"],
        },
      },
    ];

    await client.sendMessageWithTools!(request, tools);

    expect(mockCreateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            name: "test_tool",
            description: "A test tool",
            input_schema: {
              type: "object",
              properties: {
                param: { type: "string", description: "A parameter" },
              },
              required: ["param"],
            },
          },
        ],
      })
    );
  });

  it("should return text-only response when no tool calls", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Just text response" }],
      stop_reason: "end_turn",
    });

    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const tools: ToolDefinition[] = [];

    const response = await client.sendMessageWithTools!(request, tools);

    expect(response.content).toBe("Just text response");
    expect(response.toolCalls).toBeUndefined();
    expect(response.stopReason).toBe("end_turn");
  });

  it("should parse tool_use blocks from response", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [
        { type: "text", text: "I will use a tool" },
        {
          type: "tool_use",
          id: "toolu_123",
          name: "test_tool",
          input: { param: "value" },
        },
      ],
      stop_reason: "tool_use",
    });

    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Use tool" }],
    };

    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "Test",
        input_schema: { type: "object", properties: {}, required: [] },
      },
    ];

    const response = await client.sendMessageWithTools!(request, tools);

    expect(response.content).toBe("I will use a tool");
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0]).toEqual({
      id: "toolu_123",
      name: "test_tool",
      input: { param: "value" },
    });
    expect(response.stopReason).toBe("tool_use");
  });

  it("should parse multiple tool_use blocks", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [
        { type: "text", text: "Using multiple tools" },
        {
          type: "tool_use",
          id: "toolu_1",
          name: "tool_one",
          input: { a: 1 },
        },
        {
          type: "tool_use",
          id: "toolu_2",
          name: "tool_two",
          input: { b: 2 },
        },
      ],
      stop_reason: "tool_use",
    });

    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Multi tool" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.toolCalls).toHaveLength(2);
    expect(response.toolCalls![0].name).toBe("tool_one");
    expect(response.toolCalls![1].name).toBe("tool_two");
  });

  it("should handle system messages", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Response" }],
      stop_reason: "end_turn",
    });

    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User message" },
      ],
    };

    await client.sendMessageWithTools!(request, []);

    expect(mockCreateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "System prompt",
        messages: [{ role: "user", content: "User message" }],
      })
    );
  });

  it("should combine multiple text blocks", async () => {
    const client = getAnthropicClient(mockApiKey);

    const mockCreateMessage = jest.fn().mockResolvedValue({
      content: [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
      ],
      stop_reason: "end_turn",
    });

    (client as any).client.sdk.messages.create = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.content).toBe("First part\nSecond part");
  });
});
