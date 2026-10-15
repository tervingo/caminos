// Tests del editor contra un PostgreSQL real, con dobles de R2 y OpenRouteService.
// ¡Ojo! Borran por completo la base de TEST_DATABASE_URL.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { type TramoEditor, tramoAdminSchema, tramoDetalleSchema, tramoEditorSchema } from '@caminos/shared';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { conectar, migrar, type Conexion } from '../src/db/index.js';
import { usuarios } from '../src/db/schema.js';
import type { Ors } from '../src/ors.js';
import type { R2 } from '../src/r2.js';
import { sembrar } from '../src/db/semilla.js';

const url = process.env.TEST_DATABASE_URL;
const ORIGEN = 'http://localhost:5173';

/** R2 en memoria: lo «subido» se apunta a mano en `objetos` */
function r2Falso() {
  const objetos = new Map<string, { tamano: number; contentType: string | null }>();
  const r2: R2 = {
    bucket: 'pruebas',
    firmarSubida: async (key) => `https://r2.test/${key}?firma=1`,
    cabecera: async (key) => objetos.get(key) ?? null,
    borrar: async (keys) => {
      for (const k of keys) objetos.delete(k);
    },
  };
  return { r2, objetos };
}

const orsFalso: Ors = {
  // Línea recta con un punto intermedio desviado, 12,345 km y desnivel
  ruta: async (puntos) => ({
    coordenadas: [puntos[0], [(puntos[0][0] + puntos.at(-1)![0]) / 2, puntos[0][1] + 0.05], puntos.at(-1)!],
    metros: 12_345,
    subida: 321.4,
    bajada: 98.6,
  }),
  buscar: async (texto) => [{ nombre: texto, etiqueta: `${texto}, Cantabria, España`, lat: 43.2, lon: -4.6 }],
  inverso: async (lat, lon) => ({ nombre: 'Potes', etiqueta: 'Potes, Cantabria, España', lat, lon }),
};

describe.skipIf(!url)('editor (API de autor)', () => {
  let conexion: Conexion;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;
  const { r2, objetos } = r2Falso();

  const pedir = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', ruta: string, payload?: object) =>
    app.inject({ method, url: ruta, headers: { origin: ORIGEN }, cookies: { sesion: cookie }, ...(payload && { payload }) });
  const editor = async (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', ruta: string, payload?: object): Promise<TramoEditor> => {
    const res = await pedir(method, ruta, payload);
    expect(res.statusCode, res.body).toBeLessThan(300);
    return tramoEditorSchema.parse(res.json());
  };

  beforeAll(async () => {
    conexion = conectar(url!);
    await conexion.db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
    await migrar(conexion.db);
    await sembrar(conexion.db);
    await conexion.db.insert(usuarios).values({ email: 'autor@ejemplo.com', passwordHash: await hashPassword('una contraseña larga') });
    app = buildApp(loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGIN: ORIGEN }), conexion, { r2, ors: orsFalso });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: ORIGEN },
      payload: { email: 'autor@ejemplo.com', password: 'una contraseña larga' },
    });
    cookie = login.cookies.find((c) => c.name === 'sesion')!.value;
  });

  afterAll(async () => {
    await app?.close();
    await conexion?.pool.end();
  });

  it('exige sesión', async () => {
    expect((await app.inject('/api/admin/tramos')).statusCode).toBe(401);
    const sinSesion = await app.inject({ method: 'POST', url: '/api/admin/tramos', headers: { origin: ORIGEN }, payload: {} });
    expect(sinSesion.statusCode).toBe(401);
  });

  it('lista todos los tramos, también los borradores', async () => {
    const res = await pedir('GET', '/api/admin/tramos');
    const tramos = tramoAdminSchema.array().parse(res.json());
    expect(tramos).toHaveLength(4);
    expect(tramos[0]).toMatchObject({ slug: '2026-lebaniego', estado: 'publicado', numEtapas: 3 });
  });

  it('responde 404 a ids que no son uuid', async () => {
    expect((await pedir('GET', '/api/admin/tramos/no-es-un-id')).statusCode).toBe(404);
    expect((await pedir('PATCH', '/api/admin/etapas/123', { titulo: 'x' })).statusCode).toBe(404);
  });

  describe('un tramo nuevo de principio a fin', () => {
    let tramo: TramoEditor;

    it('crea un Camino nuevo y rechaza el repetido', async () => {
      const res = await pedir('POST', '/api/admin/caminos', { nombre: 'Camino del Norte', color: '#2F7D6B' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ slug: 'del-norte', nombre: 'Camino del Norte', color: '#2F7D6B' });
      expect((await pedir('POST', '/api/admin/caminos', { nombre: 'Camino del Norte', color: '#000000' })).statusCode).toBe(409);
    });

    it('crea el tramo como borrador, con slug automático', async () => {
      tramo = await editor('POST', '/api/admin/tramos', {
        anio: 2027,
        camino: 'del-norte',
        titulo: 'Irún → San Sebastián',
        resumen: '',
        fechaInicio: '2027-09-10',
        fechaFin: '',
      });
      expect(tramo).toMatchObject({ slug: '2027-del-norte', estado: 'borrador', resumen: null, fechaFin: null, kmTotal: 0 });

      const otro = await editor('POST', '/api/admin/tramos', { anio: 2027, camino: 'del-norte', titulo: 'Otro' });
      expect(otro.slug).toBe('2027-del-norte-2');
      expect((await pedir('POST', '/api/admin/tramos', { anio: 2027, camino: 'del-norte', titulo: 'x', slug: '2027-del-norte' })).statusCode).toBe(409);
      expect((await pedir('DELETE', `/api/admin/tramos/${otro.id}`)).statusCode).toBe(204);
    });

    it('valida los datos', async () => {
      const malas = await pedir('PATCH', `/api/admin/tramos/${tramo.id}`, { fechaFin: '2027-09-01' });
      expect(malas.statusCode).toBe(400);
      expect(malas.json().error.details).toEqual([{ campo: 'fechaFin', mensaje: 'Anterior a la fecha de inicio' }]);
      const camino = await pedir('PATCH', `/api/admin/tramos/${tramo.id}`, { camino: 'no-existe' });
      expect(camino.json().error.code).toBe('camino-desconocido');
      expect((await pedir('POST', '/api/admin/tramos', { anio: 'dos mil', titulo: '' })).json().error.code).toBe('datos-invalidos');
    });

    it('el borrador no es público, pero el autor puede previsualizarlo', async () => {
      const lista = await app.inject('/api/tramos');
      expect(lista.json().map((t: { slug: string }) => t.slug)).not.toContain('2027-del-norte');
      expect((await app.inject('/api/tramos/2027-del-norte')).statusCode).toBe(404);
      const previa = await app.inject({ url: '/api/tramos/2027-del-norte', cookies: { sesion: cookie } });
      expect(previa.statusCode).toBe(200);
    });

    it('añade etapas, calcula la ruta por carretera y suma los totales', async () => {
      const irun = { nombre: 'Irún', lat: 43.338, lon: -1.789 };
      const pasaia = { nombre: 'Pasaia', lat: 43.325, lon: -1.921 };
      const donosti = { nombre: 'San Sebastián', lat: 43.318, lon: -1.981 };
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/etapas`, { titulo: 'Irún → Pasaia', fecha: '2027-09-10', origen: irun, destino: pasaia });
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/etapas`, { titulo: 'Pasaia → San Sebastián', origen: pasaia, destino: donosti, km: 7 });
      expect(tramo.etapas.map((e) => e.posicion)).toEqual([1, 2]);
      expect(tramo.kmTotal).toBe(7);

      const [primera] = tramo.etapas;
      tramo = await editor('POST', `/api/admin/etapas/${primera.id}/calcular-ruta`, { perfil: 'foot-walking' });
      expect(tramo.etapas[0]).toMatchObject({ km: 12.35, desnivelPos: 321, desnivelNeg: 99, trazaOrigen: 'carretera' });
      expect(tramo.etapas[0].traza?.coordinates).toHaveLength(3);
      expect(tramo.kmTotal).toBe(19.35);
      expect(tramo.desnivelPosTotal).toBe(321);
      expect(tramo.bbox).not.toBeNull();
    });

    it('al cambiar los puntos, la ruta queda pendiente de recalcular', async () => {
      const etapa = tramo.etapas[0];
      tramo = await editor('PATCH', `/api/admin/etapas/${etapa.id}`, { via: [{ nombre: 'Jaizkibel', lat: 43.36, lon: -1.85 }] });
      expect(tramo.etapas[0]).toMatchObject({ traza: null, km: 12.35, via: [{ nombre: 'Jaizkibel' }] });
      // Solo cambiar las notas no toca la ruta
      tramo = await editor('POST', `/api/admin/etapas/${etapa.id}/calcular-ruta`, {});
      tramo = await editor('PATCH', `/api/admin/etapas/${etapa.id}`, { notas: 'Por el monte' });
      expect(tramo.etapas[0].traza).not.toBeNull();
    });

    it('guarda los sitios de interés de una etapa sin tocar su ruta, y amplían el recuadro', async () => {
      const etapa = tramo.etapas[0];
      const antes = tramo.bbox!;
      tramo = await editor('PATCH', `/api/admin/etapas/${etapa.id}`, {
        sitios: [
          { nombre: 'Monte Jaizkibel', localidad: 'Hondarribia', lat: 43.5, lon: -1.85, nota: '' },
          { nombre: 'Santuario de Guadalupe', localidad: '', lat: 43.35, lon: -1.82 },
        ],
      });
      expect(tramo.etapas[0].sitios).toEqual([
        { nombre: 'Monte Jaizkibel', localidad: 'Hondarribia', lat: 43.5, lon: -1.85, nota: null },
        { nombre: 'Santuario de Guadalupe', localidad: null, lat: 43.35, lon: -1.82, nota: null },
      ]);
      expect(tramo.etapas[0].traza).not.toBeNull();
      expect(tramo.bbox![3]).toBe(43.5);
      expect(tramo.bbox![3]).toBeGreaterThan(antes[3]);
      const publico = tramoDetalleSchema.parse((await app.inject({ url: '/api/tramos/2027-del-norte', cookies: { sesion: cookie } })).json());
      expect(publico.etapas[0].sitios).toHaveLength(2);
      expect((await pedir('PATCH', `/api/admin/etapas/${etapa.id}`, { sitios: [{ nombre: '', lat: 1, lon: 1 }] })).statusCode).toBe(400);
    });

    it('la ida y la vuelta en coche van aparte y no cuentan en los totales ni en el recuadro', async () => {
      const antes = { km: tramo.kmTotal, desnivel: tramo.desnivelPosTotal, bbox: tramo.bbox, etapas: tramo.etapas.map((e) => e.id) };
      const barcelona = { nombre: 'Barcelona', lat: 41.39, lon: 2.17 };
      const irun = { nombre: 'Irún', lat: 43.338, lon: -1.789 };
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/etapas`, { tipo: 'ida', titulo: 'Barcelona → Irún', origen: barcelona, destino: irun });
      tramo = await editor('POST', `/api/admin/etapas/${tramo.ida!.id}/calcular-ruta`, {});
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/etapas`, { tipo: 'vuelta', titulo: 'San Sebastián → Barcelona' });
      expect(tramo.ida).toMatchObject({ tipo: 'ida', km: 12.35, titulo: 'Barcelona → Irún', desnivelPos: null, desnivelNeg: null });
      expect(tramo.vuelta).toMatchObject({ tipo: 'vuelta' });
      expect(tramo.etapas.map((e) => e.id)).toEqual(antes.etapas);
      expect(tramo.numEtapas).toBe(antes.etapas.length);
      expect({ km: tramo.kmTotal, desnivel: tramo.desnivelPosTotal, bbox: tramo.bbox }).toEqual({ km: antes.km, desnivel: antes.desnivel, bbox: antes.bbox });

      expect((await pedir('POST', `/api/admin/tramos/${tramo.id}/etapas`, { tipo: 'ida', titulo: 'Otra' })).statusCode).toBe(409);
      // Una etapa no cambia de tipo
      expect((await pedir('PATCH', `/api/admin/etapas/${tramo.ida!.id}`, { tipo: 'camino' })).statusCode).toBe(400);
      // El orden solo afecta a las etapas del Camino
      tramo = await editor('PUT', `/api/admin/tramos/${tramo.id}/etapas/orden`, { ids: [...antes.etapas].reverse() });
      expect(tramo.etapas.map((e) => e.posicion)).toEqual([1, 2]);
      tramo = await editor('DELETE', `/api/admin/etapas/${tramo.vuelta!.id}`);
      tramo = await editor('PUT', `/api/admin/tramos/${tramo.id}/etapas/orden`, { ids: antes.etapas });
      expect(tramo.vuelta).toBeNull();
      expect(tramo.ida).not.toBeNull();
    });

    it('no calcula rutas sin origen y destino', async () => {
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/etapas`, { titulo: 'Sin puntos' });
      const res = await pedir('POST', `/api/admin/etapas/${tramo.etapas[2].id}/calcular-ruta`, {});
      expect(res.json().error.code).toBe('faltan-puntos');
    });

    it('reordena y borra etapas, renumerando', async () => {
      const [a, b, c] = tramo.etapas.map((e) => e.id);
      expect((await pedir('PUT', `/api/admin/tramos/${tramo.id}/etapas/orden`, { ids: [a, b] })).statusCode).toBe(400);
      tramo = await editor('PUT', `/api/admin/tramos/${tramo.id}/etapas/orden`, { ids: [c, a, b] });
      expect(tramo.etapas.map((e) => e.id)).toEqual([c, a, b]);
      tramo = await editor('DELETE', `/api/admin/etapas/${c}`);
      expect(tramo.etapas.map((e) => [e.id, e.posicion])).toEqual([
        [a, 1],
        [b, 2],
      ]);
    });

    it('añade, cambia y borra lugares y notas', async () => {
      const ajena = (await pedir('GET', '/api/admin/tramos')).json().find((t: { slug: string }) => t.slug === '2023-frances').id;
      const etapaAjena = tramoEditorSchema.parse((await pedir('GET', `/api/admin/tramos/${ajena}`)).json()).etapas[0].id;
      const lugar = { tipo: 'comer', nombre: 'Sidrería', localidad: 'Pasaia', lat: 43.325, lon: -1.921, precio: 2, url: '' };
      expect((await pedir('POST', `/api/admin/tramos/${tramo.id}/lugares`, { ...lugar, etapaId: etapaAjena })).json().error.code).toBe('etapa-ajena');

      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/lugares`, { ...lugar, etapaId: tramo.etapas[0].id });
      expect(tramo.lugares[0]).toMatchObject({ nombre: 'Sidrería', url: null, etapaId: tramo.etapas[0].id });
      tramo = await editor('PATCH', `/api/admin/lugares/${tramo.lugares[0].id}`, { nota: 'Txuleta' });
      expect(tramo.lugares[0]).toMatchObject({ nota: 'Txuleta', etapaId: tramo.etapas[0].id });

      // Dormir y comer van siempre con etapa, y «qué ver» ya no es un tipo de lugar (son sitios de interés)
      const sinEtapa = await pedir('PATCH', `/api/admin/lugares/${tramo.lugares[0].id}`, { etapaId: null });
      expect(sinEtapa.statusCode).toBe(400);
      expect(sinEtapa.json().error.details.map((d: { campo: string }) => d.campo)).toEqual(['etapaId']);
      expect((await pedir('POST', `/api/admin/tramos/${tramo.id}/lugares`, { ...lugar, tipo: 'dormir' })).statusCode).toBe(400);
      const queVer = await pedir('POST', `/api/admin/tramos/${tramo.id}/lugares`, { ...lugar, tipo: 'ver', etapaId: tramo.etapas[0].id });
      expect(queVer.json().error.details.map((d: { campo: string }) => d.campo)).toEqual(['tipo']);

      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/notas`, { texto: 'Lluvia todo el día', fecha: '2027-09-11' });
      expect(tramo.notas).toHaveLength(1);
      tramo = await editor('DELETE', `/api/admin/notas/${tramo.notas[0].id}`);
      expect(tramo.notas).toHaveLength(0);
      tramo = await editor('DELETE', `/api/admin/lugares/${tramo.lugares[0].id}`);
      expect(tramo.lugares).toHaveLength(0);
    });

    it('registra fotos ya subidas, comprobándolas en R2', async () => {
      const firmar = async () => (await pedir('POST', `/api/admin/tramos/${tramo.id}/fotos/firmar`)).json();
      const firma = await firmar();
      expect(firma.subidas.map((s: { variante: string }) => s.variante)).toEqual(['grande', 'mini']);
      const claves = [`fotos/${tramo.id}/${firma.id}-grande.webp`, `fotos/${tramo.id}/${firma.id}-mini.webp`];
      expect(firma.subidas[0].url).toContain(claves[0]);

      const foto = { id: firma.id, ancho: 2000, alto: 1500, tomadaEn: '2027-09-10T10:00:00+02:00', lat: 43.33, lon: -1.85, pie: 'Faro' };
      // Sin subir todavía
      expect((await pedir('POST', `/api/admin/tramos/${tramo.id}/fotos`, foto)).json().error.code).toBe('foto-invalida');

      objetos.set(claves[0], { tamano: 400_000, contentType: 'image/webp' });
      objetos.set(claves[1], { tamano: 40_000, contentType: 'image/webp' });
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/fotos`, foto);
      expect(tramo.fotos[0]).toMatchObject({ pie: 'Faro', lat: 43.33, mostrarPosicion: true, orden: 0 });
      expect(tramo.portadaFotoId).toBe(firma.id);

      // Una foto que no es WebP se rechaza y se borra
      const mala = await firmar();
      const clavesMala = [`fotos/${tramo.id}/${mala.id}-grande.webp`, `fotos/${tramo.id}/${mala.id}-mini.webp`];
      objetos.set(clavesMala[0], { tamano: 400_000, contentType: 'image/jpeg' });
      objetos.set(clavesMala[1], { tamano: 40_000, contentType: 'image/webp' });
      expect((await pedir('POST', `/api/admin/tramos/${tramo.id}/fotos`, { ...foto, id: mala.id })).statusCode).toBe(422);
      expect(clavesMala.some((k) => objetos.has(k))).toBe(false);
    });

    it('oculta al público la posición de una foto si se pide', async () => {
      tramo = await editor('PATCH', `/api/admin/fotos/${tramo.fotos[0].id}`, { mostrarPosicion: false });
      expect(tramo.fotos[0].lat).toBe(43.33);
      const publico = tramoDetalleSchema.parse((await app.inject({ url: '/api/tramos/2027-del-norte', cookies: { sesion: cookie } })).json());
      expect(publico.fotos[0]).toMatchObject({ lat: null, lon: null });
    });

    it('publica y despublica', async () => {
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/publicar`);
      expect(tramo.estado).toBe('publicado');
      expect((await app.inject('/api/tramos/2027-del-norte')).statusCode).toBe(200);
      tramo = await editor('POST', `/api/admin/tramos/${tramo.id}/despublicar`);
      expect((await app.inject('/api/tramos/2027-del-norte')).statusCode).toBe(404);
    });

    it('borra el tramo con sus fotos del almacenamiento', async () => {
      expect(objetos.size).toBe(2);
      expect((await pedir('DELETE', `/api/admin/tramos/${tramo.id}`)).statusCode).toBe(204);
      expect(objetos.size).toBe(0);
      expect((await pedir('GET', `/api/admin/tramos/${tramo.id}`)).statusCode).toBe(404);
    });
  });

  it('busca localidades sin exponer la clave de ORS', async () => {
    const res = await pedir('GET', '/api/admin/geo/buscar?q=Potes');
    expect(res.json()[0]).toMatchObject({ nombre: 'Potes', etiqueta: 'Potes, Cantabria, España' });
    expect((await pedir('GET', '/api/admin/geo/buscar?q=P')).statusCode).toBe(400);
    expect((await pedir('GET', '/api/admin/geo/inverso?lat=43.15&lon=-4.62')).json().nombre).toBe('Potes');
  });
});
