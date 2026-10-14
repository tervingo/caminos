import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  time: z.string(),
  db: z.enum(['ok', 'error', 'sin-configurar']),
});

export type Health = z.infer<typeof healthSchema>;

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof errorSchema>;

// Prueba de cookie de la fase 0 (temporal)
export const cookiePruebaSchema = z.object({
  recibida: z.boolean(),
  valor: z.string().nullable(),
});

export type CookiePrueba = z.infer<typeof cookiePruebaSchema>;
