import { getOpenAICompatibleClient } from "../src/openai-compatible-client";
import { LanguageModelRequest, ToolDefinition } from "../src/language-model";
import { generateDeterministicFakeApiKey } from "./test-utils";
import { NetworkError } from "../src/errors";

// Mock fetch
global.fetch = jest.fn();

describe("OpenAICompatibleClient - Tool Support", () => {
  const mockConfig = {
    apiKey: generateDeterministicFakeApiKey("openai-client-tools"),
    baseUrl: "https://api.openai.com/v1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have sendMessageWithTools method", () => {
    const client = getOpenAICompatibleClient(mockConfig);
    expect(client.sendMessageWithTools).toBeDefined();
    expect(typeof client.sendMessageWithTools).toBe("function");
  });

  it("should send tools in OpenAI format", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: "Response" },
            finish_reason: "stop",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "A test tool",
        input_schema: {
          type: "object",
          properties: {
            param: { type: "string", description: "Parameter" },
          },
          required: ["param"],
        },
      },
    ];

    await client.sendMessageWithTools!(request, tools);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"tools"'),
      })
    );

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]).toEqual({
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string", description: "Parameter" },
          },
          required: ["param"],
        },
      },
    });
  });

  it("should return text-only response when no tool calls", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: "Just text" },
            finish_reason: "stop",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.content).toBe("Just text");
    expect(response.toolCalls).toBeUndefined();
    expect(response.stopReason).toBe("end_turn");
  });

  it("should parse tool_calls from response", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "I will call a tool",
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function",
                  function: {
                    name: "test_tool",
                    arguments: '{"param":"value"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
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

    expect(response.content).toBe("I will call a tool");
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0]).toEqual({
      id: "call_abc123",
      name: "test_tool",
      input: { param: "value" },
    });
    expect(response.stopReason).toBe("tool_use");
  });

  it("should parse multiple tool calls", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "tool_one",
                    arguments: '{"a":1}',
                  },
                },
                {
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "tool_two",
                    arguments: '{"b":2}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Multi" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.toolCalls).toHaveLength(2);
    expect(response.toolCalls![0].name).toBe("tool_one");
    expect(response.toolCalls![1].name).toBe("tool_two");
  });

  it("should handle array content format", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "First" },
                { type: "text", text: "Second" },
              ],
            },
            finish_reason: "stop",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.content).toBe("First\nSecond");
  });

  it("should handle null content with tool calls", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "test",
                    arguments: "{}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.content).toBeUndefined();
    expect(response.toolCalls).toHaveLength(1);
  });

  it("should handle network errors", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network timeout"));

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    await expect(client.sendMessageWithTools!(request, [])).rejects.toThrow(NetworkError);
  });

  it("should handle API errors", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: "Internal server error" },
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    await expect(client.sendMessageWithTools!(request, [])).rejects.toThrow(
      "OpenAI-compatible API request failed"
    );
  });

  it("should handle malformed JSON in tool arguments", async () => {
    const client = getOpenAICompatibleClient(mockConfig);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Using tool",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "test_tool",
                    arguments: "not valid json{",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    });

    const request: LanguageModelRequest = {
      model: "gpt-4",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    await expect(client.sendMessageWithTools!(request, [])).rejects.toThrow(
      "Failed to parse tool arguments for test_tool"
    );
  });
});
