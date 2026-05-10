import OpenAI from 'openai';
import { z, ZodSchema } from 'zod';
import { resolveAIConfig } from '../config/index.js';
import { Logger } from '../utils/logger.js';
import { CloudClient } from './cloudClient.js';
import { CohereClient } from './cohereClient.js';

/**
 * Common interface for both direct (BYOK) and cloud-managed AI calls.
 * Agents use this type — they don't know or care which backend is running.
 */
export interface AIProvider {
  chatJSON<T>(system: string, user: string, schema: ZodSchema<T>): Promise<T>;
  chat(system: string, user: string): Promise<string>;
  printUsage(): void;
  /** Returns the provider name for audit logging */
  getProviderName?(): string;
  /** Returns token usage stats for audit logging */
  getUsageStats?(): { calls: number; tokens: number };
}

export { CloudClient };

/**
 * Direct BYOK client — calls the AI provider (NVIDIA / any OpenAI-compatible endpoint) directly.
 * Used when apiKey does NOT start with sork_live_.
 */
export class AIClient implements AIProvider {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private logger: Logger;
  totalTokens = 0;
  totalCalls = 0;

  private constructor(
    apiKey: string,
    baseURL: string,
    model: string,
    temperature: number,
    maxTokens: number,
    logger: Logger
  ) {
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.logger = logger;
    this.openai = new OpenAI({ apiKey, baseURL });
  }

  /**
   * Returns the appropriate AI provider based on the configured key:
   *   sork_live_*  →  CloudClient  (calls SORK Cloud, model hidden server-side)
   *   anything else → AIClient     (calls provider directly, BYOK)
   * Returns null if no key is configured.
   */
  static async create(logger: Logger): Promise<AIProvider | null> {
    const config = await resolveAIConfig();
    const cohereFallback = CohereClient.fromEnv(logger);

    if (!config) {
      return cohereFallback;
    }

    const primary = config.apiKey.startsWith('sork_live_')
      ? new CloudClient(config.apiKey, logger)
      : new AIClient(
          config.apiKey,
          config.baseURL,
          config.model,
          config.temperature ?? 0.2,
          config.maxTokens ?? 4096,
          logger
        );

    return cohereFallback ? new FallbackAIProvider(primary, cohereFallback, logger) : primary;
  }

  async chatJSON<T>(systemPrompt: string, userPrompt: string, schema: ZodSchema<T>): Promise<T> {
    const attempt = async (extra = ''): Promise<T> => {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt + extra },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      this.totalCalls++;
      this.totalTokens += response.usage?.total_tokens ?? 0;

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI provider');
      }

      const json = extractJSON(content);
      return schema.parse(json);
    };

    try {
      return await attempt();
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        this.logger.debug(
          `AI response failed validation, retrying: ${err instanceof Error ? err.message : ''}`
        );
        return attempt(
          '\n\nIMPORTANT: Return ONLY valid JSON matching the required fields exactly.'
        );
      }
      throw err;
    }
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    this.totalCalls++;
    this.totalTokens += response.usage?.total_tokens ?? 0;

    return response.choices[0]?.message?.content ?? '';
  }

  printUsage(): void {
    if (this.totalCalls === 0) {
      return;
    }
    this.logger.info(`AI usage: ${this.totalCalls} call(s), ~${this.totalTokens} tokens`);
  }
}

class FallbackAIProvider implements AIProvider {
  private _providerName: string;
  constructor(
    private primary: AIProvider,
    private fallback: AIProvider,
    private logger: Logger
  ) {
    this._providerName = 'primary+cohere-fallback';
  }

  getProviderName(): string {
    return this._providerName;
  }

  getUsageStats(): { calls: number; tokens: number } {
    const primaryStats = this.primary.getUsageStats?.() ?? { calls: 0, tokens: 0 };
    const fallbackStats = this.fallback.getUsageStats?.() ?? { calls: 0, tokens: 0 };
    return {
      calls: primaryStats.calls + fallbackStats.calls,
      tokens: primaryStats.tokens + fallbackStats.tokens,
    };
  }

  async chatJSON<T>(system: string, user: string, schema: ZodSchema<T>): Promise<T> {
    try {
      return await this.primary.chatJSON(system, user, schema);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.info(`[FALLBACK] Primary provider failed: ${errMsg}`);
      this.logger.info(`[FALLBACK] Switching to Cohere for this request...`);
      // Log to audit trail via console for now - will be captured byKeeperAgent later
      console.log(`[AUDIT] Using Cohere fallback for ${system.slice(0, 50)}...`);
      return this.fallback.chatJSON(system, user, schema);
    }
  }

  async chat(system: string, user: string): Promise<string> {
    try {
      return await this.primary.chat(system, user);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.info(`[FALLBACK] Primary provider failed: ${errMsg}`);
      this.logger.info(`[FALLBACK] Switching to Cohere for this request...`);
      // Log to audit trail via console for now - will be captured byKeeperAgent later
      console.log(`[AUDIT] Using Cohere fallback for ${system.slice(0, 50)}...`);
      return this.fallback.chat(system, user);
    }
  }

  printUsage(): void {
    this.primary.printUsage();
    this.fallback.printUsage();
  }
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(candidate);
}

export function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:[a-z]+)?\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : text.trim();
}
