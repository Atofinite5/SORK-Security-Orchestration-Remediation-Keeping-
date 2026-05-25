import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const CONFIG_DIR = path.join(os.homedir(), '.sork');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Default AI endpoint. NVIDIA NIM hosts the model — users bring their own key.
 * More providers (Claude, Groq, etc.) will be added in future releases.
 */
export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const DEFAULT_MODEL = 'minimaxai/minimax-m2.7';
export const KEY_SIGNUP_URL = 'https://sorkcloud.space';

const aiSchema = z.object({
  apiKey: z.string().min(1),
  baseURL: z.string().url().default(DEFAULT_BASE_URL),
  model: z.string().min(1).default(DEFAULT_MODEL),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().default(8192),
});

const configSchema = z.object({
  ai: aiSchema.optional(),
});

export type AIConfig = z.infer<typeof aiSchema>;
export type SorkUserConfig = z.infer<typeof configSchema>;

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export async function loadConfig(): Promise<SorkUserConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return configSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function saveConfig(config: SorkUserConfig): Promise<void> {
  await ensureConfigDir();
  configSchema.parse(config);
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Resolve effective AI config: env overrides > config file > defaults.
 * Returns null if no API key is available anywhere.
 */
export async function resolveAIConfig(): Promise<AIConfig | null> {
  const config = await loadConfig();
  const envKey = process.env.SORK_API_KEY;
  const envBase = process.env.SORK_BASE_URL;
  const envModel = process.env.SORK_MODEL;

  const apiKey = envKey ?? config.ai?.apiKey;
  if (!apiKey) {
    return null;
  }

  return aiSchema.parse({
    apiKey,
    baseURL: envBase ?? config.ai?.baseURL ?? DEFAULT_BASE_URL,
    model: envModel ?? config.ai?.model ?? DEFAULT_MODEL,
    temperature: config.ai?.temperature ?? 0.2,
    maxTokens: config.ai?.maxTokens ?? 8192,
  });
}

/**
 * Save just an API key. Other fields use the defaults.
 * This is the primary onboarding path: `sork config set-key <KEY>`.
 */
export function isCloudKey(apiKey: string): boolean {
  return apiKey.startsWith('sork_live_');
}

export async function setApiKey(apiKey: string): Promise<AIConfig> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }

  if (!isCloudKey(trimmed)) {
    throw new Error(
      `Only SORK Cloud license keys are accepted by the CLI.\n` +
        `  Expected format: sork_live_*\n\n` +
        `  Get a free license key:  ${KEY_SIGNUP_URL}\n\n` +
        `  Want to use your own AI provider (Groq / NVIDIA / Cohere / OpenAI)?\n` +
        `  Add them at:  ${KEY_SIGNUP_URL}/dashboard?view=keys\n` +
        `  Your CLI scans will automatically route through your BYOK quota.`
    );
  }

  const existing = (await loadConfig()).ai;
  const next: AIConfig = aiSchema.parse({
    apiKey: trimmed,
    baseURL: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    temperature: existing?.temperature ?? 0.2,
    maxTokens: existing?.maxTokens ?? 8192,
  });
  await saveConfig({ ai: next });
  return next;
}

export async function setConfigValue(key: keyof AIConfig, value: string | number): Promise<void> {
  const config = await loadConfig();
  if (!config.ai && key !== 'apiKey') {
    throw new Error('Set the API key first: sork config set-key <YOUR_KEY>');
  }
  const current: AIConfig =
    config.ai ??
    aiSchema.parse({
      apiKey: '',
      baseURL: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
    });
  const next = { ...current, [key]: value } as AIConfig;
  await saveConfig({ ai: aiSchema.parse(next) });
}

export function configFilePath(): string {
  return CONFIG_FILE;
}

export function redactKey(key: string): string {
  if (!key) {
    return '(unset)';
  }
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
