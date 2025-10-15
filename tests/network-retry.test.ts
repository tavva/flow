import { withRetry, RetryOptions, isRetryableError } from "../src/network-retry";

describe("withRetry", () => {
  it("should return result on first successful attempt", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");
    const options: RetryOptions = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 };

    const result = await withRetry(mockFn, options);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue("success");
    const options: RetryOptions = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 };

    const result = await withRetry(mockFn, options);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});

describe("isRetryableError", () => {
  it("should identify network errors as retryable", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("Network error occurred"))).toBe(true);
    expect(isRetryableError(new Error("timeout exceeded"))).toBe(true);
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableError(new Error("ENOTFOUND"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
  });

  it("should identify non-network errors as non-retryable", () => {
    expect(isRetryableError(new Error("Invalid API key"))).toBe(false);
    expect(isRetryableError(new Error("Validation failed"))).toBe(false);
    expect(isRetryableError(new Error("Unauthorized"))).toBe(false);
  });
});
