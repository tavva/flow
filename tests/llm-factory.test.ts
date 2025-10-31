import { createLanguageModelClient } from "../src/llm-factory";
import { PluginSettings, DEFAULT_SETTINGS } from "../src/types";

describe("createLanguageModelClient", () => {
  describe("when AI is disabled", () => {
    it("should return null when aiEnabled is false", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: false,
      };

      const client = createLanguageModelClient(settings);

      expect(client).toBeNull();
    });

    it("should return null even when API keys are set", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: false,
        anthropicApiKey: "sk-ant-test-key",
        openaiApiKey: "sk-or-test-key",
      };

      const client = createLanguageModelClient(settings);

      expect(client).toBeNull();
    });
  });

  describe("when AI is enabled", () => {
    it("should throw error for Anthropic provider without API key", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        llmProvider: "anthropic",
        anthropicApiKey: "",
      };

      expect(() => createLanguageModelClient(settings)).toThrow("Anthropic API key is not set");
    });

    it("should throw error for OpenAI-compatible provider without API key", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        llmProvider: "openai-compatible",
        openaiApiKey: "",
      };

      expect(() => createLanguageModelClient(settings)).toThrow(
        "OpenAI-compatible API key is not set"
      );
    });

    it("should create Anthropic client when API key is set", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        llmProvider: "anthropic",
        anthropicApiKey: "sk-ant-test-key-12345678901234567890",
      };

      const client = createLanguageModelClient(settings);

      expect(client).not.toBeNull();
      expect(client).toHaveProperty("sendMessage");
    });

    it("should create OpenAI-compatible client when API key is set", () => {
      const settings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        llmProvider: "openai-compatible",
        openaiApiKey: "sk-or-test-key",
      };

      const client = createLanguageModelClient(settings);

      expect(client).not.toBeNull();
      expect(client).toHaveProperty("sendMessage");
    });
  });
});
