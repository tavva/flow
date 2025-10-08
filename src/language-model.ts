export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
        role: ChatMessageRole;
        content: string;
}

export interface LanguageModelRequest {
        model: string;
        maxTokens: number;
        messages: ChatMessage[];
}

export interface LanguageModelClient {
        sendMessage(request: LanguageModelRequest): Promise<string>;
}
