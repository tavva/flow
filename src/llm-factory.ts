import { LanguageModelClient } from "./language-model";
import { getAnthropicClient } from "./anthropic-client";
import { getOpenAICompatibleClient } from "./openai-compatible-client";
import { PluginSettings } from "./types";
import { ConfigurationError } from "./errors";

export function createLanguageModelClient(settings: PluginSettings): LanguageModelClient | null {
  // When AI is disabled, return null instead of throwing errors
  if (!settings.aiEnabled) {
    return null;
  }

  if (settings.llmProvider === "openai-compatible") {
    if (!settings.openaiApiKey) {
      throw new ConfigurationError("OpenAI-compatible API key is not set");
    }

    return getOpenAICompatibleClient({
      apiKey: settings.openaiApiKey,
      baseUrl: settings.openaiBaseUrl,
      defaultHeaders: {},
    });
  }

  if (!settings.anthropicApiKey) {
    throw new ConfigurationError("Anthropic API key is not set");
  }

  return getAnthropicClient(settings.anthropicApiKey);
}

export function getModelForSettings(settings: PluginSettings): string {
  return settings.llmProvider === "openai-compatible"
    ? settings.openaiModel || "gpt-4o-mini"
    : settings.anthropicModel;
}
