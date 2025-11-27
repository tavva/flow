// ABOUTME: Tests for network error handling in language model clients
// ABOUTME: Verifies user-friendly error messages for network failures

import { OpenAICompatibleClient } from "../src/openai-compatible-client";
import { RateLimitedAnthropicClient } from "../src/anthropic-client";
import { generateFakeApiKey } from "./test-utils";
import { NetworkError } from "../src/errors";

// Mock fetch globally
global.fetch = jest.fn();

describe("Network Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("OpenAICompatibleClient", () => {
    it("should throw NetworkError for fetch failures", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Failed to fetch"));

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(NetworkError);
    });

    it("should throw NetworkError for network failures", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network request failed"));

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(NetworkError);
    });

    it("should throw NetworkError for timeout failures", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Request timeout"));

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(NetworkError);
    });

    it("should include original error message in NetworkError", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Invalid API key format"));

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow("Unable to reach the AI service: Invalid API key format");
    });

    it("should handle non-Error thrown values", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockRejectedValue("Unknown error");

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow("Unable to reach the AI service: Unknown error");
    });

    it("should handle HTTP error responses normally", async () => {
      const client = new OpenAICompatibleClient({
        apiKey: generateFakeApiKey(),
        baseUrl: "https://api.example.com/v1",
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: "Invalid API key" },
        }),
      });

      await expect(
        client.sendMessage({
          model: "test-model",
          maxTokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow("OpenAI-compatible API request failed with status 401: Invalid API key");
    });
  });

  describe("RateLimitedAnthropicClient", () => {
    it("should provide user-friendly error for network failures", async () => {
      // Mock the Anthropic SDK to throw network errors
      const mockCreate = jest.fn().mockRejectedValue(new Error("fetch failed"));

      const client = new RateLimitedAnthropicClient(generateFakeApiKey());
      // Replace the SDK's create method
      (client as any).sdk = {
        messages: {
          create: mockCreate,
        },
      };

      await expect(
        client.createMessage({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(
        "Network error: Unable to reach the AI service. Please check your internet connection and try again."
      );
    });

    it("should handle ECONNREFUSED errors", async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));

      const client = new RateLimitedAnthropicClient(generateFakeApiKey());
      (client as any).sdk = {
        messages: {
          create: mockCreate,
        },
      };

      await expect(
        client.createMessage({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(
        "Network error: Unable to reach the AI service. Please check your internet connection and try again."
      );
    });

    it("should handle ENOTFOUND errors", async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

      const client = new RateLimitedAnthropicClient(generateFakeApiKey());
      (client as any).sdk = {
        messages: {
          create: mockCreate,
        },
      };

      await expect(
        client.createMessage({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(
        "Network error: Unable to reach the AI service. Please check your internet connection and try again."
      );
    });

    it("should handle timeout errors", async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error("Request timeout exceeded"));

      const client = new RateLimitedAnthropicClient(generateFakeApiKey());
      (client as any).sdk = {
        messages: {
          create: mockCreate,
        },
      };

      await expect(
        client.createMessage({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(
        "Network error: Unable to reach the AI service. Please check your internet connection and try again."
      );
    });

    it("should preserve non-network error messages", async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error("Invalid model specified"));

      const client = new RateLimitedAnthropicClient(generateFakeApiKey());
      (client as any).sdk = {
        messages: {
          create: mockCreate,
        },
      };

      await expect(
        client.createMessage({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow("Invalid model specified");
    });
  });
});
