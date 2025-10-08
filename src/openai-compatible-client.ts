import { LanguageModelClient, LanguageModelRequest } from './language-model';

export interface OpenAICompatibleClientConfig {
        apiKey: string;
        baseUrl?: string;
        organization?: string;
        defaultHeaders?: Record<string, string>;
}

interface ChatCompletionResponse {
        choices: Array<{
                message?: {
                        content?: string | Array<{ type: 'text'; text: string }>;
                };
        }>;
        error?: {
                message?: string;
                type?: string;
                code?: string | number;
        };
}

export class OpenAICompatibleClient implements LanguageModelClient {
        private readonly apiKey: string;
        private readonly baseUrl: string;
        private readonly organization?: string;
        private defaultHeaders: Record<string, string>;

        constructor(config: OpenAICompatibleClientConfig) {
                this.apiKey = config.apiKey;
                this.baseUrl = config.baseUrl?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
                this.organization = config.organization;
                this.defaultHeaders = config.defaultHeaders ? { ...config.defaultHeaders } : {};

                if (this.baseUrl.includes('openrouter.ai')) {
                        this.defaultHeaders = {
                                'HTTP-Referer': 'https://github.com/FlowApp/flow-coach',
                                'X-Title': 'Flow GTD Coach',
                                ...this.defaultHeaders
                        };
                }
        }

        async sendMessage(request: LanguageModelRequest): Promise<string> {
                const body = JSON.stringify({
                        model: request.model,
                        max_tokens: request.maxTokens,
                        messages: request.messages
                });

                const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                        ...this.defaultHeaders
                };

                if (this.organization) {
                        headers['OpenAI-Organization'] = this.organization;
                }

                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers,
                        body
                });

                if (!response.ok) {
                        let errorMessage = `OpenAI-compatible API request failed with status ${response.status}`;
                        try {
                                const errorData = await response.json() as ChatCompletionResponse;
                                if (errorData?.error?.message) {
                                        errorMessage += `: ${errorData.error.message}`;
                                }
                        } catch (error) {
                                // ignore JSON parse errors, fall back to default message
                        }
                        throw new Error(errorMessage);
                }

                const data = await response.json() as ChatCompletionResponse;
                const choice = data.choices?.[0];
                const message = choice?.message;

                if (!message || message.content === undefined) {
                        throw new Error('OpenAI-compatible response did not include a message');
                }

                if (typeof message.content === 'string') {
                        return message.content;
                }

                const textContent = message.content
                        .filter(part => part.type === 'text')
                        .map(part => part.text)
                        .join('\n')
                        .trim();

                if (!textContent) {
                        throw new Error('OpenAI-compatible response did not include textual content');
                }

                return textContent;
        }
}

const clientCache = new Map<string, OpenAICompatibleClient>();

export function getOpenAICompatibleClient(config: OpenAICompatibleClientConfig): LanguageModelClient {
        const cacheKey = `${config.apiKey}::${config.baseUrl ?? 'https://api.openai.com/v1'}`;

        let client = clientCache.get(cacheKey);
        if (!client) {
                client = new OpenAICompatibleClient(config);
                clientCache.set(cacheKey, client);
        }

        return client;
}
