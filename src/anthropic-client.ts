import Anthropic from "@anthropic-ai/sdk";
import { APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk/error";
import { LanguageModelClient, LanguageModelRequest } from "./language-model";

export type MessageCreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming;
export type MessageResponse = Anthropic.Messages.Message;

type QueueTask<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

interface ResponseMeta {
  status?: number;
  headers?: Headers | Record<string, string>;
  timeout?: boolean;
}

interface RateLimiterConfig {
  capacity: number;
  rate: number;
  bucketSize: number;
  alpha: number;
  additiveStep: number;
  beta: number;
  rateStep: number;
  rateDrop: number;
  initialLatency: number;
  jitterMaxMs: number;
  backoffBaseMs: number;
  backoffCapMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  capacity: 3,
  rate: 1,
  bucketSize: 2,
  alpha: 0.05,
  additiveStep: 0.2,
  beta: 0.5,
  rateStep: 0.1,
  rateDrop: 0.5,
  initialLatency: 0.25,
  jitterMaxMs: 250,
  backoffBaseMs: 200,
  backoffCapMs: 5000,
};

export class RateLimitedAnthropicClient {
  private sdk: Anthropic;
  private readonly config: RateLimiterConfig;
  private tokens: number;
  private lastRefill: number;
  private inFlight = 0;
  private queue: Array<QueueTask<MessageResponse>> = [];
  private capacity: number;
  private rate: number;
  private successCount = 0;
  private ewmaLatency: number;
  private pauseUntil = 0;
  private retryCount = 0;
  private drainTimer: NodeJS.Timeout | null = null;
  private nextDrainTime = 0;

  constructor(apiKey: string, config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.capacity = this.config.capacity;
    this.rate = this.config.rate;
    this.tokens = this.config.bucketSize;
    this.lastRefill = Date.now();
    this.ewmaLatency = this.config.initialLatency;

    this.sdk = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async createMessage(params: MessageCreateParams): Promise<MessageResponse> {
    return new Promise<MessageResponse>((resolve, reject) => {
      this.queue.push({
        execute: () => this.sdk.messages.create(params),
        resolve,
        reject,
      });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    const now = Date.now();
    this.refillTokens(now);

    if (this.queue.length === 0) {
      return;
    }

    if (now < this.pauseUntil) {
      this.scheduleDrain(this.pauseUntil - now);
      return;
    }

    const maxConcurrent = Math.max(1, Math.floor(this.capacity));

    while (this.queue.length > 0 && this.tokens >= 1 && this.inFlight < maxConcurrent) {
      const task = this.queue.shift()!;
      this.tokens -= 1;
      this.inFlight += 1;
      this.dispatchTask(task);
    }

    if (this.queue.length > 0) {
      const delayForTokens = this.tokens >= 1 ? 50 : this.timeUntilNextToken();
      const delayForPause = this.pauseUntil > now ? this.pauseUntil - now : 0;
      const delay = Math.max(10, Math.max(delayForTokens, delayForPause));
      this.scheduleDrain(delay);
    }
  }

  private dispatchTask(task: QueueTask<MessageResponse>): void {
    const started = Date.now();

    task
      .execute()
      .then((response) => {
        const latency = (Date.now() - started) / 1000;
        this.onResponse({ status: 200 }, latency);
        task.resolve(response);
      })
      .catch((error) => {
        const latency = (Date.now() - started) / 1000;
        const meta = this.extractErrorMeta(error);
        this.onResponse(meta, latency);
        task.reject(error);
      })
      .finally(() => {
        this.inFlight = Math.max(0, this.inFlight - 1);
        this.drainQueue();
      });
  }

  private onResponse(meta: ResponseMeta, latencySeconds: number): void {
    const latency =
      Number.isFinite(latencySeconds) && latencySeconds > 0 ? latencySeconds : this.ewmaLatency;
    this.ewmaLatency = (1 - this.config.alpha) * this.ewmaLatency + this.config.alpha * latency;

    if (meta.status !== undefined && meta.status >= 200 && meta.status < 300) {
      this.retryCount = 0;
      this.successCount += 1;
      if (this.successCount >= this.capacity) {
        this.capacity += this.config.additiveStep;
        this.rate += this.config.rateStep;
        this.successCount = 0;
      }
      return;
    }

    this.handleError(meta);
  }

  private handleError(meta: ResponseMeta): void {
    this.successCount = 0;
    const status = meta.status;

    if (status === 429) {
      this.applyBackoffPenalty();
      this.retryCount = Math.min(this.retryCount + 1, 10);
      const retryAfterSeconds = this.parseRetryAfter(meta.headers);
      if (retryAfterSeconds !== null) {
        const delayMs = retryAfterSeconds * 1000 + this.jitter();
        this.pause(delayMs);
      } else {
        this.pause(this.expBackoffWithFullJitter());
      }
      return;
    }

    if (meta.timeout || status === undefined || (status >= 500 && status <= 599)) {
      this.applyBackoffPenalty();
      this.pause(this.expBackoffWithFullJitter());
      return;
    }

    // Other 4xx errors: do not increase; optionally apply tiny jitter to avoid thundering herd
    this.retryCount = 0;
    this.pause(50 + this.jitter() / 2);
  }

  private applyBackoffPenalty(): void {
    this.capacity = Math.max(1, this.capacity * this.config.beta);
    this.rate = Math.max(0.1, this.rate * this.config.rateDrop);
  }

  private parseRetryAfter(headers?: Headers | Record<string, string>): number | null {
    if (!headers) {
      return null;
    }

    let value: string | null = null;
    if (headers instanceof Headers) {
      value = headers.get("retry-after");
    } else {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === "retry-after") {
          value = headers[key];
          break;
        }
      }
    }

    if (!value) {
      return null;
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return Math.max(0, numeric);
    }

    const retryDate = Date.parse(value);
    if (!Number.isNaN(retryDate)) {
      const deltaSeconds = (retryDate - Date.now()) / 1000;
      return deltaSeconds > 0 ? deltaSeconds : 0;
    }

    return null;
  }

  private expBackoffWithFullJitter(): number {
    const attempt = this.retryCount;
    const backoff = Math.min(
      this.config.backoffCapMs,
      this.config.backoffBaseMs * Math.pow(2, attempt)
    );
    this.retryCount = Math.min(this.retryCount + 1, 10);
    return Math.random() * backoff;
  }

  private jitter(): number {
    return Math.random() * this.config.jitterMaxMs;
  }

  private pause(durationMs: number): void {
    const now = Date.now();
    this.pauseUntil = Math.max(this.pauseUntil, now + durationMs);
    this.scheduleDrain(durationMs);
  }

  private scheduleDrain(delayMs: number): void {
    const now = Date.now();
    const targetTime = now + Math.max(0, delayMs);

    if (this.drainTimer && this.nextDrainTime <= targetTime) {
      return;
    }

    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
    }

    this.nextDrainTime = targetTime;
    this.drainTimer = setTimeout(
      () => {
        this.drainTimer = null;
        this.nextDrainTime = 0;
        this.drainQueue();
      },
      Math.max(0, targetTime - now)
    );
  }

  private timeUntilNextToken(): number {
    if (this.rate <= 0) {
      return 1000;
    }
    const deficit = 1 - this.tokens;
    if (deficit <= 0) {
      return 0;
    }
    return Math.ceil((deficit / this.rate) * 1000);
  }

  private refillTokens(now: number): void {
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) {
      return;
    }
    this.lastRefill = now;
    this.tokens = Math.min(this.config.bucketSize, this.tokens + elapsed * this.rate);
  }

  private extractErrorMeta(error: unknown): ResponseMeta {
    const meta: ResponseMeta = {};

    if (error instanceof APIError) {
      meta.status = error.status;
      meta.headers = error.headers as Headers | Record<string, string> | undefined;
    }

    if (error instanceof APIConnectionTimeoutError) {
      meta.timeout = true;
    }

    if (typeof error === "object" && error !== null && meta.status === undefined) {
      const status = (error as { status?: number }).status;
      if (typeof status === "number") {
        meta.status = status;
      }
    }

    return meta;
  }
}

class AnthropicLanguageModelClient implements LanguageModelClient {
  constructor(private readonly client: RateLimitedAnthropicClient) {}

  async sendMessage(request: LanguageModelRequest): Promise<string> {
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

    const response = await this.client.createMessage({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: anthropicMessages,
      system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic Messages API");
    }

    return content.text;
  }
}

let sharedClient: RateLimitedAnthropicClient | null = null;
let sharedApiKey: string | null = null;
let sharedAdapter: AnthropicLanguageModelClient | null = null;

export function getAnthropicClient(apiKey: string): LanguageModelClient {
  if (!sharedClient || sharedApiKey !== apiKey) {
    sharedClient = new RateLimitedAnthropicClient(apiKey);
    sharedApiKey = apiKey;
    sharedAdapter = new AnthropicLanguageModelClient(sharedClient);
  }

  if (!sharedAdapter && sharedClient) {
    sharedAdapter = new AnthropicLanguageModelClient(sharedClient);
  }

  if (!sharedAdapter) {
    throw new Error("Failed to initialise Anthropic client");
  }

  return sharedAdapter;
}

export function resetSharedAnthropicClient(): void {
  sharedClient = null;
  sharedApiKey = null;
  sharedAdapter = null;
}
