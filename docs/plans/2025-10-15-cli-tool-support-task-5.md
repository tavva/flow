# CLI Tool Support - Task 5: Add Tool Support to Anthropic Client

**Goal:** Implement `sendMessageWithTools` method in AnthropicLanguageModelClient

**Architecture:** Use Anthropic SDK's native tools API. Parse tool_use blocks from response.

**Tech Stack:** @anthropic-ai/sdk, TypeScript

---

### Step 1: Write failing test for Anthropic tool support

**File:** `tests/anthropic-client-tools.test.ts`

```typescript
import { getAnthropicClient, resetSharedAnthropicClient } from "../src/anthropic-client";
import {
  LanguageModelRequest,
  ToolDefinition,
  ToolCallResponse,
} from "../src/language-model";

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
    (client as any).client.client.createMessage = mockCreateMessage;

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

    (client as any).client.client.createMessage = mockCreateMessage;

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

    (client as any).client.client.createMessage = mockCreateMessage;

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

    (client as any).client.client.createMessage = mockCreateMessage;

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

    (client as any).client.client.createMessage = mockCreateMessage;

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

    (client as any).client.client.createMessage = mockCreateMessage;

    const request: LanguageModelRequest = {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1000,
      messages: [{ role: "user", content: "Test" }],
    };

    const response = await client.sendMessageWithTools!(request, []);

    expect(response.content).toBe("First part\nSecond part");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- anthropic-client-tools.test.ts`

Expected: FAIL - sendMessageWithTools is undefined

### Step 3: Implement sendMessageWithTools in AnthropicLanguageModelClient

**File:** `src/anthropic-client.ts`

Add the method to the `AnthropicLanguageModelClient` class after the `sendMessage` method:

```typescript
  async sendMessageWithTools(
    request: LanguageModelRequest,
    tools: ToolDefinition[]
  ): Promise<ToolCallResponse> {
    const systemMessages: string[] = [];
    const anthropicMessages = request.messages
      .filter((message) => {
        if (message.role === "system") {
          systemMessages.push(message.content);
          return false;
        }
        return true;
      })
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    // Convert tools to Anthropic format
    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    const response = await this.client.createMessage({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: anthropicMessages,
      system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
      tools: anthropicTools,
    });

    // Parse response for tool calls
    const textContent: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent.push(block.text);
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent.length > 0 ? textContent.join("\n") : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    };
  }
```

### Step 4: Add imports

**File:** `src/anthropic-client.ts`

Update the import from language-model:

```typescript
import { LanguageModelClient, LanguageModelRequest, ToolDefinition, ToolCallResponse, ToolCall } from "./language-model";
```

### Step 5: Run test to verify it passes

Run: `npm test -- anthropic-client-tools.test.ts`

Expected: PASS - all Anthropic tool tests pass

### Step 6: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 7: Commit

```bash
git add src/anthropic-client.ts tests/anthropic-client-tools.test.ts
git commit -m "feat: add tool support to Anthropic client"
```

---

## Acceptance Criteria

- [x] `sendMessageWithTools` method exists on Anthropic client
- [x] Converts tool definitions to Anthropic format
- [x] Sends tools parameter in API call
- [x] Parses text blocks from response
- [x] Parses tool_use blocks from response
- [x] Handles multiple tool calls in one response
- [x] Handles system messages correctly
- [x] Returns correct stopReason
- [x] Test coverage ≥80%
