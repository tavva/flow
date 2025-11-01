import { createLanguageModelClient } from "../src/llm-factory";
import { PluginSettings, DEFAULT_SETTINGS } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

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
        anthropicApiKey: generateDeterministicFakeApiKey("anthropic-disabled"),
        openaiApiKey: generateDeterministicFakeApiKey("openai-disabled"),
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
        anthropicApiKey: generateDeterministicFakeApiKey("anthropic-enabled"),
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
        openaiApiKey: generateDeterministicFakeApiKey("openai-enabled"),
      };

      const client = createLanguageModelClient(settings);

      expect(client).not.toBeNull();
      expect(client).toHaveProperty("sendMessage");
    });
  });
});
