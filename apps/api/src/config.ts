import { z } from 'zod';

/** Una variable vacía (VAR=) cuenta como no definida */
const vacioComoAusente = (v: unknown) => (v === '' ? undefined : v);
const opcional = z.preprocess(vacioComoAusente, z.string().optional());
const conDefecto = (valor: string, base = z.string()) => z.preprocess(vacioComoAusente, base.default(valor));

const SECRETO_DESARROLLO = 'solo-para-desarrollo-local-no-usar-en-produccion';

const envSchema = z
  .object({
    NODE_ENV: z.preprocess(vacioComoAusente, z.enum(['development', 'production', 'test']).default('development')),
    PORT: z.preprocess(vacioComoAusente, z.coerce.number().int().positive().default(3000)),
    HOST: conDefecto('0.0.0.0'),
    /** Orígenes desde los que se aceptan escrituras (separados por comas) */
    ALLOWED_ORIGIN: conDefecto('http://localhost:5173,https://santiagos.netlify.app'),
    DATABASE_URL: opcional,
    JWT_SECRET: opcional,
    PUBLIC_ASSETS_URL: conDefecto('https://caminos-fotos.j4alonso.workers.dev', z.string().url()),
    R2_ACCOUNT_ID: opcional,
    R2_ACCESS_KEY_ID: opcional,
    R2_SECRET_ACCESS_KEY: opcional,
    R2_BUCKET: opcional,
  })
  .transform((env, ctx) => {
    if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'En producción hace falta un JWT_SECRET de 32 caracteres o más',
      });
      return z.NEVER;
    }
    return {
      ...env,
      JWT_SECRET: env.JWT_SECRET ?? SECRETO_DESARROLLO,
      origenesPermitidos: env.ALLOWED_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      PUBLIC_ASSETS_URL: env.PUBLIC_ASSETS_URL.replace(/\/+$/, ''),
    };
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}
