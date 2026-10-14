// Prueba de la fase 0: ¿llega bien una cookie httpOnly a través del proxy de Netlify?
// Temporal: se borrará cuando exista el login real (fase 1).
import type { FastifyPluginAsync } from 'fastify';
import type { CookiePrueba } from '@caminos/shared';
import type { Config } from '../config.js';

const NOMBRE = 'prueba_cookie';

export const pruebaCookieRoutes: FastifyPluginAsync<{ config: Config }> = async (app, { config }) => {
  const opciones = {
    path: '/',
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 10 * 60,
  };

  app.post('/api/prueba/cookie', async (_req, reply): Promise<CookiePrueba> => {
    const valor = new Date().toISOString();
    reply.setCookie(NOMBRE, valor, opciones);
    return { recibida: false, valor };
  });

  app.get('/api/prueba/cookie', async (req): Promise<CookiePrueba> => {
    const valor = req.cookies[NOMBRE] ?? null;
    return { recibida: valor !== null, valor };
  });

  app.delete('/api/prueba/cookie', async (_req, reply): Promise<CookiePrueba> => {
    reply.clearCookie(NOMBRE, { path: '/' });
    return { recibida: false, valor: null };
  });
};
