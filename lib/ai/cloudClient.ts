import { z, ZodSchema } from 'zod';
import { Logger } from '../utils/logger.js';

const DEFAULT_CLOUD_URL = 'https://sork-back.onrender.com';

/**
 * Cloud client — used when the user's API key starts with sork_live_.
 * Calls SORK Cloud's /api/ai/chat endpoint.
 * The model name and provider are handled server-side and never revealed here.
 */
export class CloudClient {
  private apiKey: string;
  private cloudUrl: string;
  private logger: Logger;
  totalCalls = 0;
  totalTokens = 0;

  constructor(apiKey: string, logger: Logger) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.cloudUrl = process.env.SORK_CLOUD_URL ?? DEFAULT_CLOUD_URL;
  }

  async chatJSON<T>(systemPrompt: string, userPrompt: string, schema: ZodSchema<T>): Promise<T> {
    const attempt = async (extra = ''): Promise<T> => {
      const res = await this.post('/api/ai/chat', {
        system: systemPrompt + extra,
        user: userPrompt,
        temperature: 0.2,
        maxTokens: 4096,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        throw new Error(`SORK Cloud API error ${res.status}: ${err.error ?? res.statusText}`);
      }

      const json = (await res.json()) as unknown;
      this.totalCalls++;
      return schema.parse(json);
    };

    try {
      return await attempt();
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        this.logger.debug('Cloud response failed schema, retrying');
        return attempt(
          '\n\nIMPORTANT: Return ONLY valid JSON matching the requested schema exactly.'
        );
      }
      throw err;
    }
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await this.post('/api/ai/chat', {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.2,
      maxTokens: 4096,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      throw new Error(`SORK Cloud API error ${res.status}: ${err.error ?? res.statusText}`);
    }

    const json = (await res.json()) as unknown;
    this.totalCalls++;
    if (typeof json === 'string') {
      return json;
    }
    if (json && typeof json === 'object' && 'raw' in (json as object)) {
      return String((json as { raw: unknown }).raw);
    }
    return JSON.stringify(json);
  }

  printUsage(): void {
    if (this.totalCalls === 0) {
      return;
    }
    this.logger.info(`Cloud API: ${this.totalCalls} call(s)`);
  }

  private post(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    return fetch(`${this.cloudUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  }
}
