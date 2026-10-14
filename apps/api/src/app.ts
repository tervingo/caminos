import Fastify from 'fastify';
import type { Health } from '@caminos/shared';
import type { Config } from './config.js';

export function buildApp(config: Config) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  app.get('/api/health', async (): Promise<Health> => ({
    status: 'ok',
    service: 'caminos-api',
    time: new Date().toISOString(),
  }));

  return app;
}
