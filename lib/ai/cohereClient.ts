import { z, ZodSchema } from 'zod';
import { Logger } from '../utils/logger.js';
import type { AIProvider } from './client.js';

const DEFAULT_COHERE_URL = 'https://api.cohere.com';
const DEFAULT_COHERE_MODEL = 'command-a-03-2025';
const ENCODED_COHERE_KEY =
  'Y29oZXJlX0ZZTXltZUNobTI5V041T3p2THp2Zm9mT29WN29VVTRHQW5QWlo3NDkyMWFueG4=';

function decodeApiKey(encoded: string): string {
  const buffer = Buffer.from(encoded, 'base64');
  return buffer.toString('utf-8');
}

interface CohereChatResponse {
  message?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  meta?: {
    tokens?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

export class CohereClient implements AIProvider {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private logger: Logger;
  totalCalls = 0;
  totalTokens = 0;

  constructor(apiKey: string, logger: Logger) {
    this.apiKey = apiKey || decodeApiKey(ENCODED_COHERE_KEY);
    this.logger = logger;
    this.baseURL = process.env.COHERE_BASE_URL ?? DEFAULT_COHERE_URL;
    this.model = process.env.COHERE_MODEL ?? DEFAULT_COHERE_MODEL;
  }

  /** Returns the provider name for audit logging */
  getProviderName(): string {
    return 'cohere';
  }

  /** Returns token usage stats for audit logging */
  getUsageStats(): { calls: number; tokens: number } {
    return { calls: this.totalCalls, tokens: this.totalTokens };
  }

  static fromEnv(logger: Logger): CohereClient | null {
    const apiKey = process.env.COHERE_API_KEY ?? process.env.SORK_COHERE_API_KEY;
    return apiKey ? new CohereClient(apiKey, logger) : null;
  }

  async chatJSON<T>(systemPrompt: string, userPrompt: string, schema: ZodSchema<T>): Promise<T> {
    const attempt = async (extra = ''): Promise<T> => {
      const text = await this.chat(
        systemPrompt + extra,
        `${userPrompt}\n\nReturn only a valid JSON object.`
      );
      return schema.parse(extractJSON(text));
    };

    try {
      return await attempt();
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        this.logger.debug(
          `Cohere response failed validation, retrying: ${err instanceof Error ? err.message : ''}`
        );
        return attempt(
          '\n\nIMPORTANT: Return ONLY valid JSON matching the required fields exactly.'
        );
      }
      throw err;
    }
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    this.logger.debug(`[COHERE] Calling model: ${this.model}`);
    this.logger.debug(`[COHERE] Request: ${userPrompt.slice(0, 100)}...`);

    const res = await fetch(`${this.baseURL}/v2/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
        message?: string;
      };
      throw new Error(`Cohere API error ${res.status}: ${err.message ?? res.statusText}`);
    }

    const json = (await res.json()) as CohereChatResponse;
    const text = json.message?.content
      ?.filter((part) => part.type === 'text' || part.text)
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new Error('Empty response from Cohere');
    }

    this.totalCalls++;
    this.totalTokens +=
      (json.meta?.tokens?.input_tokens ?? 0) + (json.meta?.tokens?.output_tokens ?? 0);

    this.logger.debug(`[COHERE] Response: ${text.slice(0, 150)}...`);
    return text;
  }

  printUsage(): void {
    if (this.totalCalls === 0) {
      return;
    }
    this.logger.info(`[COHERE] Used for ${this.totalCalls} call(s), ~${this.totalTokens} tokens`);
  }
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(candidate);
}
