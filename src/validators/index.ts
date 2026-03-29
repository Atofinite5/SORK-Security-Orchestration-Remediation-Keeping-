import { z } from 'zod';

/**
 * Environment Variable Validation Schema
 * Validates all environment variables at startup
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Add your env vars here
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Throws ZodError if validation fails
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw error;
  }
}

/**
 * Generic API Response Validator
 * Use this for validating API responses
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

/**
 * Validate API responses with proper error messages
 */
export function validateApiResponse(data: unknown): ApiResponse {
  try {
    return apiResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Invalid API response: ${messages}`);
    }
    throw error;
  }
}
