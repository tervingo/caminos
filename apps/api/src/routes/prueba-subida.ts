// Prueba de la fase 0: firma una subida directa a R2.
// Solo fuera de producción (no hay login todavía). Temporal: la sustituye /api/admin/uploads/firmar.
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { R2 } from '../r2.js';

export const pruebaSubidaRoutes: FastifyPluginAsync<{ r2: R2 }> = async (app, { r2 }) => {
  app.post('/api/prueba/subida', async () => {
    const key = `pruebas/${randomUUID()}.txt`;
    const url = await r2.firmarSubida(key, 'text/plain');
    return { key, url };
  });
};
