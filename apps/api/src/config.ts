import { z } from 'zod';

const opcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: opcional,
  R2_ACCOUNT_ID: opcional,
  R2_ACCESS_KEY_ID: opcional,
  R2_SECRET_ACCESS_KEY: opcional,
  R2_BUCKET: opcional,
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}
