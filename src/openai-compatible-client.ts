import {
  LanguageModelClient,
  LanguageModelRequest,
  ToolDefinition,
  ToolCallResponse,
  ToolCall,
} from "./language-model";

export interface OpenAICompatibleClientConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  defaultHeaders?: Record<string, string>;
}

interface ChatCompletionResponse {
  choices: Array<{
    message?: {
      content?: string | Array<{ type: "text"; text: string }> | null;
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

export class OpenAICompatibleClient implements LanguageModelClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization?: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
    this.organization = config.organization;
    this.defaultHeaders = config.defaultHeaders ? { ...config.defaultHeaders } : {};

    if (this.baseUrl.includes("openrouter.ai")) {
      this.defaultHeaders = {
        "HTTP-Referer": "https://github.com/FlowApp/flow-coach",
        "X-Title": "Flow GTD Coach",
        ...this.defaultHeaders,
      };
    }
  }

  async sendMessage(request: LanguageModelRequest): Promise<string> {
    const body = JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages,
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
      // Network-level errors (connection timeout, DNS failure, network unreachable)
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
        throw new Error(
          "Network error: Unable to reach the AI service. Please check your internet connection and try again."
        );
      }
      throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
      let errorMessage = `OpenAI-compatible API request failed with status ${response.status}`;
      try {
        const errorData = (await response.json()) as ChatCompletionResponse;
        if (errorData?.error?.message) {
          errorMessage += `: ${errorData.error.message}`;
        }
      } catch (error) {
        // ignore JSON parse errors, fall back to default message
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message || message.content === undefined) {
      throw new Error("OpenAI-compatible response did not include a message");
    }

    if (typeof message.content === "string") {
      return message.content;
    }

    const textContent = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!textContent) {
      throw new Error("OpenAI-compatible response did not include textual content");
    }

    return textContent;
  }

  async sendMessageWithTools(
    request: LanguageModelRequest,
    tools: ToolDefinition[]
  ): Promise<ToolCallResponse> {
    // Convert tools to OpenAI function format
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
      // Network-level errors (connection timeout, DNS failure, network unreachable)
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
        throw new Error(
          "Network error: Unable to reach the AI service. Please check your internet connection and try again."
        );
      }
      throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
      let errorMessage = `OpenAI-compatible API request failed with status ${response.status}`;
      try {
        const errorData = (await response.json()) as ChatCompletionResponse;
        if (errorData?.error?.message) {
          errorMessage += `: ${errorData.error.message}`;
        }
      } catch (error) {
        // ignore JSON parse errors, fall back to default message
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("OpenAI-compatible response did not include a message");
    }

    // Parse text content
    let textContent: string | undefined;
    if (typeof message.content === "string") {
      textContent = message.content;
    } else if (Array.isArray(message.content)) {
      const parts = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text);
      textContent = parts.length > 0 ? parts.join("\n") : undefined;
    }

    // Parse tool calls
    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    // Determine stop reason
    let stopReason: "end_turn" | "tool_use" | "max_tokens";
    if (choice.finish_reason === "tool_calls") {
      stopReason = "tool_use";
    } else if (choice.finish_reason === "length") {
      stopReason = "max_tokens";
    } else {
      stopReason = "end_turn";
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
    };
  }
}

const clientCache = new Map<string, OpenAICompatibleClient>();

export function getOpenAICompatibleClient(
  config: OpenAICompatibleClientConfig
): LanguageModelClient {
  const cacheKey = `${config.apiKey}::${config.baseUrl ?? "https://api.openai.com/v1"}`;

  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAICompatibleClient(config);
    clientCache.set(cacheKey, client);
  }

  return client;
}
