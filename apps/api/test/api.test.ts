// Tests contra un PostgreSQL real. Se saltan si no hay TEST_DATABASE_URL.
// ¡Ojo! Borran por completo la base indicada: nunca la apuntes a producción.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { tramoDetalleSchema, tramoResumenSchema, errorSchema } from '@caminos/shared';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { conectar, migrar, type Conexion } from '../src/db/index.js';
import { usuarios } from '../src/db/schema.js';
import { sembrar } from '../src/db/semilla.js';

const url = process.env.TEST_DATABASE_URL;
const ORIGEN = 'http://localhost:5173';

describe.skipIf(!url)('API con base de datos', () => {
  let conexion: Conexion;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    conexion = conectar(url!);
    await conexion.db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
    await migrar(conexion.db);
    await sembrar(conexion.db);
    await sembrar(conexion.db); // la semilla es repetible
    await conexion.db.insert(usuarios).values({ email: 'autor@ejemplo.com', passwordHash: await hashPassword('una contraseña larga') });
    app = buildApp(loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGIN: ORIGEN }), conexion);
  });

  afterAll(async () => {
    await app?.close();
    await conexion?.pool.end();
  });

  describe('lectura pública', () => {
    it('lista los caminos', async () => {
      const res = await app.inject('/api/caminos');
      expect(res.json().map((c: { slug: string }) => c.slug).sort()).toEqual(['frances', 'lebaniego', 'portugues']);
    });

    it('lista los cuatro tramos de ejemplo, del más reciente al más antiguo', async () => {
      const res = await app.inject('/api/tramos');
      expect(res.statusCode).toBe(200);
      const tramos = res.json().map((t: unknown) => tramoResumenSchema.parse(t));
      expect(tramos.map((t) => t.slug)).toEqual(['2026-lebaniego', '2025-portugues', '2024-frances', '2023-frances']);
      const lebaniego = tramos[0];
      expect(lebaniego).toMatchObject({ kmTotal: 44, numEtapas: 3, camino: { slug: 'lebaniego' } });
      expect(lebaniego.ruta?.coordinates.length).toBeGreaterThan(1);
      expect(lebaniego.bbox).toHaveLength(4);
    });

    it('devuelve el detalle de un tramo', async () => {
      const res = await app.inject('/api/tramos/2023-frances');
      const tramo = tramoDetalleSchema.parse(res.json());
      expect(tramo.etapas.map((e) => e.titulo)).toEqual([
        'Saint-Jean → Roncesvalles',
        'Roncesvalles → Zubiri',
        'Zubiri → Pamplona',
      ]);
      expect(tramo.etapas[0].origen).toEqual({ nombre: 'Saint-Jean', lat: 43.163, lon: -1.238 });
      expect(tramo.etapas[0].traza?.coordinates[0]).toEqual([-1.238, 43.163]);
      expect(tramo.lugares).toHaveLength(5);
      expect(tramo.notas).toHaveLength(2);
    });

    it('responde 404 con la forma de error común', async () => {
      const res = await app.inject('/api/tramos/no-existe');
      expect(res.statusCode).toBe(404);
      expect(errorSchema.parse(res.json()).error.code).toBe('no-encontrado');
    });

    it('no muestra los tramos en borrador', async () => {
      await conexion.db.execute(sql`update tramos set estado = 'borrador' where slug = '2024-frances'`);
      const lista = await app.inject('/api/tramos');
      expect(lista.json().map((t: { slug: string }) => t.slug)).not.toContain('2024-frances');
      expect((await app.inject('/api/tramos/2024-frances')).statusCode).toBe(404);
      await conexion.db.execute(sql`update tramos set estado = 'publicado' where slug = '2024-frances'`);
    });
  });

  describe('acceso del autor', () => {
    const login = (password: string, origin: string | null = ORIGEN) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: origin ? { origin } : {},
        payload: { email: 'Autor@Ejemplo.com', password },
      });

    it('sin sesión, /me responde 401', async () => {
      expect((await app.inject('/api/auth/me')).statusCode).toBe(401);
    });

    it('rechaza escrituras sin Origin o de otro origen', async () => {
      expect((await login('una contraseña larga', null)).statusCode).toBe(403);
      expect((await login('una contraseña larga', 'https://otro.example')).statusCode).toBe(403);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const res = await login('incorrecta');
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('credenciales-incorrectas');
    });

    it('inicia sesión con cookie httpOnly, la reconoce y la cierra', async () => {
      const res = await login('una contraseña larga');
      expect(res.statusCode).toBe(200);
      const cookie = res.cookies.find((c) => c.name === 'sesion');
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

      const me = await app.inject({ url: '/api/auth/me', cookies: { sesion: cookie!.value } });
      expect(me.json()).toEqual({ email: 'autor@ejemplo.com' });

      const salida = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: ORIGEN } });
      expect(salida.statusCode).toBe(204);
      expect(salida.cookies.find((c) => c.name === 'sesion')?.value).toBe('');
    });

    it('limita los intentos de login', async () => {
      // Ya van 2 intentos válidos en este minuto (los rechazados por Origin no llegan a contar)
      const codigos = [];
      for (let i = 0; i < 4; i++) codigos.push((await login('incorrecta')).statusCode);
      expect(codigos).toEqual([401, 401, 401, 429]);
    });
  });
});
