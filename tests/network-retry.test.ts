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
