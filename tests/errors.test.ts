// tests/errors.test.ts
import {
  FlowError,
  NetworkError,
  FileNotFoundError,
  ConfigurationError,
  ValidationError,
  LLMResponseError,
  isNetworkError,
  isRetryableError,
} from "../src/errors";

describe("Error Type Hierarchy", () => {
  describe("FlowError (base class)", () => {
    it("should be an instance of Error", () => {
      const error = new FlowError("test message");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FlowError);
    });

    it("should have correct name", () => {
      const error = new FlowError("test");
      expect(error.name).toBe("FlowError");
    });

    it("should preserve message", () => {
      const error = new FlowError("specific message");
      expect(error.message).toBe("specific message");
    });

    it("should support optional cause", () => {
      const cause = new Error("original error");
      const error = new FlowError("wrapped error", { cause });
      expect(error.cause).toBe(cause);
    });
  });

  describe("NetworkError", () => {
    it("should extend FlowError", () => {
      const error = new NetworkError("connection failed");
      expect(error).toBeInstanceOf(FlowError);
      expect(error).toBeInstanceOf(NetworkError);
    });

    it("should have correct name", () => {
      const error = new NetworkError("test");
      expect(error.name).toBe("NetworkError");
    });

    it("should be identifiable via isNetworkError", () => {
      const networkError = new NetworkError("connection failed");
      const genericError = new Error("connection failed");

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(genericError)).toBe(false);
    });

    it("should be retryable by default", () => {
      const error = new NetworkError("timeout");
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe("FileNotFoundError", () => {
    it("should extend FlowError", () => {
      const error = new FileNotFoundError("missing.md");
      expect(error).toBeInstanceOf(FlowError);
      expect(error).toBeInstanceOf(FileNotFoundError);
    });

    it("should have correct name", () => {
      const error = new FileNotFoundError("test.md");
      expect(error.name).toBe("FileNotFoundError");
    });

    it("should store the file path", () => {
      const error = new FileNotFoundError("Projects/Test.md");
      expect(error.filePath).toBe("Projects/Test.md");
    });

    it("should generate descriptive message", () => {
      const error = new FileNotFoundError("Projects/Test.md");
      expect(error.message).toBe("File not found: Projects/Test.md");
    });

    it("should not be retryable", () => {
      const error = new FileNotFoundError("test.md");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("ConfigurationError", () => {
    it("should extend FlowError", () => {
      const error = new ConfigurationError("API key missing");
      expect(error).toBeInstanceOf(FlowError);
      expect(error).toBeInstanceOf(ConfigurationError);
    });

    it("should have correct name", () => {
      const error = new ConfigurationError("test");
      expect(error.name).toBe("ConfigurationError");
    });

    it("should not be retryable", () => {
      const error = new ConfigurationError("invalid config");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("should extend FlowError", () => {
      const error = new ValidationError("invalid input");
      expect(error).toBeInstanceOf(FlowError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should have correct name", () => {
      const error = new ValidationError("test");
      expect(error.name).toBe("ValidationError");
    });

    it("should optionally store field name", () => {
      const error = new ValidationError("must be positive", "priority");
      expect(error.field).toBe("priority");
    });

    it("should not be retryable", () => {
      const error = new ValidationError("bad data");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("LLMResponseError", () => {
    it("should extend FlowError", () => {
      const error = new LLMResponseError("invalid JSON response");
      expect(error).toBeInstanceOf(FlowError);
      expect(error).toBeInstanceOf(LLMResponseError);
    });

    it("should have correct name", () => {
      const error = new LLMResponseError("test");
      expect(error.name).toBe("LLMResponseError");
    });

    it("should not be retryable (bad response won't change)", () => {
      const error = new LLMResponseError("malformed JSON");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("GTDResponseValidationError (backward compatibility)", () => {
    // This ensures existing code using GTDResponseValidationError still works
    it("should be exported and extend LLMResponseError", async () => {
      const { GTDResponseValidationError } = await import("../src/errors");
      const error = new GTDResponseValidationError("invalid GTD response");
      expect(error).toBeInstanceOf(LLMResponseError);
      expect(error).toBeInstanceOf(FlowError);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for NetworkError", () => {
      expect(isRetryableError(new NetworkError("timeout"))).toBe(true);
    });

    it("should return false for FileNotFoundError", () => {
      expect(isRetryableError(new FileNotFoundError("test.md"))).toBe(false);
    });

    it("should return false for ConfigurationError", () => {
      expect(isRetryableError(new ConfigurationError("bad config"))).toBe(false);
    });

    it("should return false for ValidationError", () => {
      expect(isRetryableError(new ValidationError("bad input"))).toBe(false);
    });

    it("should return false for LLMResponseError", () => {
      expect(isRetryableError(new LLMResponseError("bad response"))).toBe(false);
    });

    it("should return false for generic Error", () => {
      expect(isRetryableError(new Error("something"))).toBe(false);
    });

    it("should return false for non-Error values", () => {
      expect(isRetryableError("string error")).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError(42)).toBe(false);
    });

    // Legacy behavior: string matching for generic errors that haven't been migrated yet
    it("should return true for generic Error with network-like message (legacy support)", () => {
      expect(isRetryableError(new Error("fetch failed"))).toBe(true);
      expect(isRetryableError(new Error("Network timeout"))).toBe(true);
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isRetryableError(new Error("ENOTFOUND"))).toBe(true);
      expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
      expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
    });
  });
});
