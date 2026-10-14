import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { Health } from '@caminos/shared';
import type { Config } from './config.js';
import { comprobarDb, createDb } from './db.js';
import { createR2 } from './r2.js';
import { pruebaCookieRoutes } from './routes/prueba-cookie.js';
import { pruebaSubidaRoutes } from './routes/prueba-subida.js';

export function buildApp(config: Config) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    // Render y el proxy de Netlify van delante: confiar en X-Forwarded-*
    trustProxy: true,
  });

  const db = createDb(config.DATABASE_URL);
  const r2 = createR2(config);
  app.addHook('onClose', async () => {
    await db?.end();
  });

  app.register(cookie);

  app.get('/api/health', async (): Promise<Health> => ({
    status: 'ok',
    service: 'caminos-api',
    time: new Date().toISOString(),
    db: await comprobarDb(db),
  }));

  app.register(pruebaCookieRoutes, { config });
  if (r2 && config.NODE_ENV !== 'production') {
    app.register(pruebaSubidaRoutes, { r2 });
  }

  return app;
}
