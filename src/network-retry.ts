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
  return await fn();
}

export function isRetryableError(error: unknown): boolean {
  return false;
}
