// ABOUTME: Configuration for deepeval evaluation framework
// ABOUTME: Defines test paths, metrics thresholds, and OpenRouter LLM provider settings
export default {
  testPath: "tests/coach-evaluation",
  metrics: {
    threshold: 0.7,
    providers: {
      evaluator: "openai",
      apiBase: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-sonnet-4.5",
      apiKey: process.env.OPENROUTER_API_KEY
    }
  }
};
