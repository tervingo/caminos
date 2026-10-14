import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { loginSchema, type Usuario } from '@caminos/shared';
import { COOKIE_SESION, DURACION_SESION_S, comprobarPassword, requiereAutor } from '../auth.js';
import type { Db } from '../db/index.js';
import { usuarios } from '../db/schema.js';
import { HttpError } from '../errores.js';

export const authRoutes: FastifyPluginAsync<{ db: Db; secure: boolean }> = async (app, { db, secure }) => {
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply): Promise<Usuario> => {
      const datos = loginSchema.safeParse(req.body);
      if (!datos.success) {
        throw new HttpError(400, 'datos-invalidos', 'Email o contraseña con formato incorrecto');
      }
      const { email, password } = datos.data;

      const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email));
      const valida = await comprobarPassword(usuario?.passwordHash, password);
      if (!usuario || !valida) {
        throw new HttpError(401, 'credenciales-incorrectas', 'Email o contraseña incorrectos');
      }

      const token = await reply.jwtSign({ sub: usuario.id, email: usuario.email }, { expiresIn: DURACION_SESION_S });
      reply.setCookie(COOKIE_SESION, token, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: DURACION_SESION_S,
      });
      return { email: usuario.email };
    },
  );

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_SESION, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', { preHandler: requiereAutor }, async (req): Promise<Usuario> => ({
    email: req.user.email,
  }));
};
