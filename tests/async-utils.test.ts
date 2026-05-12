// ABOUTME: Tests helpers for intentionally fire-and-forget async work.
// ABOUTME: Ensures rejected promises are handled consistently.

import { runAsync, wrapAsyncEvent } from "../src/async-utils";

describe("async-utils", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs rejected fire-and-forget work with context", async () => {
    const error = new Error("boom");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    runAsync(Promise.reject(error), "failed task");
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith("failed task", error);
  });

  it("wraps async event handlers without returning their promise", async () => {
    const error = new Error("event failed");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const event = new Event("click");

    const wrapped = wrapAsyncEvent(async (receivedEvent: Event) => {
      expect(receivedEvent).toBe(event);
      throw error;
    }, "failed event");

    expect(wrapped(event)).toBeUndefined();
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith("failed event", error);
  });
});
