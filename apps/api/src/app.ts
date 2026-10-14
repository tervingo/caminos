import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { Health } from '@caminos/shared';
import type { Config } from './config.js';
import { pruebaCookieRoutes } from './routes/prueba-cookie.js';

export function buildApp(config: Config) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    // Render y el proxy de Netlify van delante: confiar en X-Forwarded-*
    trustProxy: true,
  });

  app.register(cookie);

  app.get('/api/health', async (): Promise<Health> => ({
    status: 'ok',
    service: 'caminos-api',
    time: new Date().toISOString(),
  }));

  app.register(pruebaCookieRoutes, { config });

  return app;
}
