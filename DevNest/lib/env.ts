import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  NEXTAUTH_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    }),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  GITLAB_CLIENT_ID: z.string().min(1),
  GITLAB_CLIENT_SECRET: z.string().min(1),

  EMAIL_SERVER_HOST: z.string().min(1),
  EMAIL_SERVER_PORT: z.coerce.number().int().positive(),
  EMAIL_SERVER_USER: z.string().default(""),
  EMAIL_SERVER_PASSWORD: z.string().default(""),
  EMAIL_FROM: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export type ParseEnvResult =
  | { ok: true; env: Env }
  | { ok: false; issues: { path: string; message: string }[] };

/**
 * Pure validator: returns success/failure without side effects. Tests use
 * this directly so they don't trigger `process.exit` on bad input.
 */
export function parseEnv(raw: unknown): ParseEnvResult {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { ok: true, env: parsed.data };
}

const result = parseEnv(process.env);

if (!result.ok) {
  const issues = result.issues
    .map((issue) => `  - ${issue.path}: ${issue.message}`)
    .join("\n");
  console.error(
    `\n[env] Invalid or missing environment variables:\n${issues}\n\n` +
      `See .env.example for required keys. Copy it to .env.local and fill in real values.\n`,
  );
  // Crash at boot so failures are not deferred to first request.
  process.exit(1);
}

export const env: Env = result.env;
