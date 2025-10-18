# CLI Tool Support - Task 1: Add Tool Types to Language Model Interface

**Goal:** Extend the language model interface with optional tool support types

**Architecture:** Add TypeScript interfaces for tool calling without breaking existing code. Use optional method to maintain backward compatibility.

**Tech Stack:** TypeScript interfaces

---

### Step 1: Write failing test for tool types

**File:** `tests/language-model.test.ts`

Create a new test file:

```typescript
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
```

### Step 2: Run test to verify it fails

Run: `npm test -- language-model.test.ts`

Expected: FAIL with "Cannot find module '../src/language-model' or its corresponding type declarations"

### Step 3: Add tool types to language-model.ts

**File:** `src/language-model.ts`

```typescript
export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface LanguageModelRequest {
  model: string;
  maxTokens: number;
  messages: ChatMessage[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ToolCallResponse {
  content?: string;
  toolCalls?: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

export interface LanguageModelClient {
  sendMessage(request: LanguageModelRequest): Promise<string>;

  sendMessageWithTools?(
    request: LanguageModelRequest,
    tools: ToolDefinition[]
  ): Promise<ToolCallResponse>;
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- language-model.test.ts`

Expected: PASS - all type checks compile and assertions pass

### Step 5: Run full test suite to ensure no regressions

Run: `npm test`

Expected: PASS - all existing tests still pass (backward compatible changes)

### Step 6: Commit

```bash
git add src/language-model.ts tests/language-model.test.ts
git commit -m "feat: add tool support types to language model interface"
```

---

## Acceptance Criteria

- [x] `ToolDefinition` type allows name, description, and JSON schema
- [x] `ToolCall` type captures id, name, and input parameters
- [x] `ToolResult` type captures result with optional error flag
- [x] `ToolCallResponse` type supports text response and/or tool calls
- [x] `sendMessageWithTools` is optional on `LanguageModelClient` interface
- [x] Existing code compiles without changes (backward compatible)
- [x] Test coverage ≥80%
