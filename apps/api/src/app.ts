import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { ApiError, Health } from '@caminos/shared';
import { COOKIE_SESION, comprobarOrigen } from './auth.js';
import type { Config } from './config.js';
import { type Conexion, comprobarDb } from './db/index.js';
import { HttpError } from './errores.js';
import { createOrs, type Ors } from './ors.js';
import { createR2, type R2 } from './r2.js';
import { adminRoutes } from './routes/admin/index.js';
import { authRoutes } from './routes/auth.js';
import { publicoRoutes } from './routes/publico.js';

const error = (code: string, message: string, details?: unknown): ApiError => ({ error: { code, message, details } });

/** Servicios externos; los tests pasan dobles en lugar de los reales */
export interface Servicios {
  r2?: R2;
  ors?: Ors;
}

export function buildApp(
  config: Config,
  conexion?: Conexion,
  servicios: Servicios = { r2: createR2(config), ors: createOrs(config.ORS_API_KEY) },
) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    // Render y el proxy de Netlify van delante: confiar en X-Forwarded-*
    trustProxy: true,
  });

  app.register(helmet);
  app.register(cookie);
  app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: COOKIE_SESION, signed: false },
  });
  app.register(rateLimit, { global: false });
  app.addHook('onRequest', comprobarOrigen(config.origenesPermitidos));

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.statusCode).send(err.toJSON());
    const status = err.statusCode ?? 500;
    if (status === 429) return reply.code(429).send(error('demasiados-intentos', 'Demasiados intentos; espera un minuto'));
    if (status < 500) return reply.code(status).send(error(err.code ?? 'peticion-incorrecta', err.message));
    req.log.error(err);
    return reply.code(500).send(error('error-interno', 'Error interno del servidor'));
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send(error('no-encontrado', 'No encontrado')));

  app.get('/api/health', async (): Promise<Health> => ({
    status: 'ok',
    service: 'caminos-api',
    time: new Date().toISOString(),
    db: await comprobarDb(conexion?.pool),
  }));

  if (conexion) {
    app.register(publicoRoutes, { db: conexion.db, assetsUrl: config.PUBLIC_ASSETS_URL });
    app.register(authRoutes, { db: conexion.db, secure: config.NODE_ENV === 'production' });
    app.register(adminRoutes, { db: conexion.db, assetsUrl: config.PUBLIC_ASSETS_URL, ...servicios });
  }

  return app;
}
