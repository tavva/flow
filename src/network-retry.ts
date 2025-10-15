// ABOUTME: Generic retry utility with exponential backoff for handling transient failures.
// ABOUTME: Provides configurable retry logic with jitter and user feedback callbacks.

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  onRetry?: (attempt: number, delayMs: number) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === options.maxAttempts - 1) {
        throw error;
      }

      const delayMs = calculateDelay(attempt, options);

      if (onRetry) {
        onRetry(attempt + 1, delayMs);
      }

      await sleep(delayMs);
    }
  }
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  const jitteredDelay = cappedDelay * (0.5 + Math.random() * 0.5);
  return jitteredDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("network");
}
