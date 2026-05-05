import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string(),

  JWT_SIGNING_KEY: z.string().min(32, 'JWT_SIGNING_KEY must be at least 32 chars'),
  JWT_PREVIOUS_SIGNING_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('phone-app'),
  JWT_AUDIENCE: z.string().default('phone-app'),
  JWT_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 30),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  GOOGLE_TRANSLATE_API_KEY: z.string().optional(),
  GOOGLE_TRANSLATE_PROJECT_ID: z.string().optional(),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

  APPLE_TEAM_ID: z.string().optional(),
  APPLE_SERVICE_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('Phone App'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),

  MAGIC_LINK_TTL_SECONDS: z.coerce.number().default(60 * 15),
  MAGIC_LINK_BASE_URL: z.string().default('http://localhost:3000/auth/verify'),

  DAILY_LLM_BUDGET: z.coerce.number().default(200),
  DAILY_EXTERNAL_BUDGET: z.coerce.number().default(1000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}
