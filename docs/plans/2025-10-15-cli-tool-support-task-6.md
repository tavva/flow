# CLI Tool Support - Task 6: Add Tool Support to OpenAI Compatible Client

**Goal:** Implement `sendMessageWithTools` method in OpenAICompatibleClient

**Architecture:** Use OpenAI's function calling API. Parse tool_calls from response message.

**Tech Stack:** fetch API, OpenAI chat completions format

---

### Step 1: Write failing test for OpenAI tool support

**File:** `tests/openai-client-tools.test.ts`

```typescript
import { getOpenAICompatibleClient } from "../src/openai-compatible-client";
import {
  LanguageModelRequest,
  ToolDefinition,
} from "../src/language-model";

// Mock fetch
global.fetch = jest.fn();

describe("OpenAICompatibleClient - Tool Support", () => {
  const mockConfig = {
    apiKey: "test-key",
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

    await expect(client.sendMessageWithTools!(request, [])).rejects.toThrow(
      "Network error"
    );
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
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- openai-client-tools.test.ts`

Expected: FAIL - sendMessageWithTools is undefined

### Step 3: Implement sendMessageWithTools in OpenAICompatibleClient

**File:** `src/openai-compatible-client.ts`

Add to the imports at top:

```typescript
import { LanguageModelClient, LanguageModelRequest, ToolDefinition, ToolCallResponse, ToolCall } from "./language-model";
```

Add the method to the `OpenAICompatibleClient` class after the `sendMessage` method:

```typescript
  async sendMessageWithTools(
    request: LanguageModelRequest,
    tools: ToolDefinition[]
  ): Promise<ToolCallResponse> {
    // Convert tools to OpenAI format
    const openaiTools = tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    const body = JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages,
      tools: openaiTools,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.defaultHeaders,
    };

    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body,
      });
    } catch (error) {
      // Network-level errors
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("timeout")
      ) {
        throw new Error(
          "Network error: Unable to reach the AI service. Please check your internet connection and try again."
        );
      }
      throw new Error(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response.ok) {
      let errorMessage = `OpenAI-compatible API request failed with status ${response.status}`;
      try {
        const errorData = (await response.json()) as ChatCompletionResponse;
        if (errorData?.error?.message) {
          errorMessage += `: ${errorData.error.message}`;
        }
      } catch (error) {
        // ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("OpenAI-compatible response did not include a message");
    }

    // Parse tool calls if present
    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    // Parse content
    let content: string | undefined;
    if (typeof message.content === "string") {
      content = message.content || undefined;
    } else if (Array.isArray(message.content)) {
      const textParts = message.content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      content = textParts || undefined;
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    };
  }
```

### Step 4: Update ChatCompletionResponse interface

**File:** `src/openai-compatible-client.ts`

Update the `ChatCompletionResponse` interface to include tool_calls:

```typescript
interface ChatCompletionResponse {
  choices: Array<{
    message?: {
      content?: string | Array<{ type: "text"; text: string }>;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}
```

### Step 5: Run test to verify it passes

Run: `npm test -- openai-client-tools.test.ts`

Expected: PASS - all OpenAI tool tests pass

### Step 6: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 7: Commit

```bash
git add src/openai-compatible-client.ts tests/openai-client-tools.test.ts
git commit -m "feat: add tool support to OpenAI compatible client"
```

---

## Acceptance Criteria

- [x] `sendMessageWithTools` method exists on OpenAI client
- [x] Converts tool definitions to OpenAI function format
- [x] Sends tools parameter in API call
- [x] Parses string and array content formats
- [x] Parses tool_calls from response message
- [x] Handles multiple tool calls in one response
- [x] Handles null content with tool calls
- [x] Returns correct stopReason ("tool_use" for tool_calls)
- [x] Network error handling
- [x] Test coverage ≥80%
