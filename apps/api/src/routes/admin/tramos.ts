import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import {
  type Camino,
  caminoEntradaSchema,
  type TramoAdmin,
  tramoCambiosSchema,
  type TramoEditor,
  tramoEntradaSchema,
} from '@caminos/shared';
import { caminos, etapas, fotos, tramos } from '../../db/schema.js';
import { HttpError, validar } from '../../errores.js';
import { cabecera, columnasCamino } from '../../lecturas.js';
import { cargarTramo, esDuplicado, type OpcionesAdmin, slugDe, tramoEditor } from './comun.js';

type Params = { Params: { id: string } };

function comprobarFechas(inicio: string | null | undefined, fin: string | null | undefined) {
  if (inicio && fin && fin < inicio) {
    throw new HttpError(400, 'datos-invalidos', 'La fecha de fin es anterior a la de inicio', [
      { campo: 'fechaFin', mensaje: 'Anterior a la fecha de inicio' },
    ]);
  }
}

export const tramosAdmin: FastifyPluginAsync<OpcionesAdmin> = async (app, { db, assetsUrl, r2 }) => {
  const idCamino = async (slug: string) => {
    const [camino] = await db.select({ id: caminos.id }).from(caminos).where(eq(caminos.slug, slug));
    if (!camino) throw new HttpError(400, 'camino-desconocido', 'Ese Camino no existe');
    return camino.id;
  };

  app.post('/api/admin/caminos', async (req, reply): Promise<Camino> => {
    const { nombre, color } = validar(caminoEntradaSchema, req.body);
    const slug = slugDe(nombre.replace(/^camino\s+/i, '')) || slugDe(nombre);
    try {
      const [camino] = await db.insert(caminos).values({ slug, nombre, color }).returning(columnasCamino);
      reply.code(201);
      return camino;
    } catch (err) {
      if (esDuplicado(err)) throw new HttpError(409, 'camino-repetido', 'Ya existe un Camino con ese nombre');
      throw err;
    }
  });

  app.get('/api/admin/tramos', async (): Promise<TramoAdmin[]> => {
    const filas = await db
      .select({ tramo: tramos, camino: columnasCamino })
      .from(tramos)
      .innerJoin(caminos, eq(tramos.caminoId, caminos.id))
      .orderBy(desc(tramos.anio), asc(tramos.slug));
    if (filas.length === 0) return [];
    const ids = filas.map((f) => f.tramo.id);
    const idsPortada = filas.map((f) => f.tramo.portadaFotoId).filter((id): id is string => id !== null);
    const [cuentas, portadas] = await Promise.all([
      db.select({ tramoId: etapas.tramoId, n: count() }).from(etapas).where(inArray(etapas.tramoId, ids)).groupBy(etapas.tramoId),
      idsPortada.length > 0 ? db.select().from(fotos).where(inArray(fotos.id, idsPortada)) : [],
    ]);
    const numEtapas = new Map(cuentas.map((c) => [c.tramoId, c.n]));
    return filas.map(({ tramo, camino }) => ({
      ...cabecera(assetsUrl, tramo, camino, numEtapas.get(tramo.id) ?? 0, portadas.find((f) => f.id === tramo.portadaFotoId)),
      id: tramo.id,
      estado: tramo.estado,
      actualizadoEn: tramo.actualizadoEn.toISOString(),
    }));
  });

  app.get<Params>('/api/admin/tramos/:id', async (req): Promise<TramoEditor> => tramoEditor(db, assetsUrl, req.params.id));

  app.post('/api/admin/tramos', async (req, reply): Promise<TramoEditor> => {
    const datos = validar(tramoEntradaSchema, req.body);
    comprobarFechas(datos.fechaInicio, datos.fechaFin);
    const caminoId = await idCamino(datos.camino);

    // Sin slug, se usa año-camino y, si ya existe, año-camino-2, -3…
    const base = datos.slug ?? `${datos.anio}-${datos.camino}`;
    const usados = new Set(
      (await db.select({ slug: tramos.slug }).from(tramos)).map((t) => t.slug).filter((s) => s === base || s.startsWith(`${base}-`)),
    );
    if (datos.slug && usados.has(base)) throw new HttpError(409, 'slug-repetido', 'Ya hay un tramo con esa dirección');
    let slug = base;
    for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;

    const [tramo] = await db
      .insert(tramos)
      .values({
        slug,
        anio: datos.anio,
        caminoId,
        titulo: datos.titulo,
        resumen: datos.resumen ?? null,
        fechaInicio: datos.fechaInicio ?? null,
        fechaFin: datos.fechaFin ?? null,
      })
      .returning({ id: tramos.id });
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/tramos/:id', async (req): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const datos = validar(tramoCambiosSchema, req.body);
    comprobarFechas(
      datos.fechaInicio === undefined ? tramo.fechaInicio : datos.fechaInicio,
      datos.fechaFin === undefined ? tramo.fechaFin : datos.fechaFin,
    );
    if (datos.portadaFotoId) {
      const [foto] = await db.select({ tramoId: fotos.tramoId }).from(fotos).where(eq(fotos.id, datos.portadaFotoId));
      if (foto?.tramoId !== tramo.id) throw new HttpError(400, 'foto-ajena', 'Esa foto no es de este tramo');
    }

    const { camino, ...resto } = datos;
    try {
      await db
        .update(tramos)
        .set({ ...resto, ...(camino && { caminoId: await idCamino(camino) }), actualizadoEn: new Date() })
        .where(eq(tramos.id, tramo.id));
    } catch (err) {
      if (esDuplicado(err)) throw new HttpError(409, 'slug-repetido', 'Ya hay un tramo con esa dirección');
      throw err;
    }
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  for (const [ruta, estado] of [
    ['publicar', 'publicado'],
    ['despublicar', 'borrador'],
  ] as const) {
    app.post<Params>(`/api/admin/tramos/:id/${ruta}`, async (req): Promise<TramoEditor> => {
      const { tramo } = await cargarTramo(db, req.params.id);
      await db.update(tramos).set({ estado, actualizadoEn: new Date() }).where(eq(tramos.id, tramo.id));
      return tramoEditor(db, assetsUrl, tramo.id);
    });
  }

  // Borra el tramo con todo lo suyo (cascada) y sus fotos del almacenamiento
  app.delete<Params>('/api/admin/tramos/:id', async (req, reply) => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const claves = await db.select({ grande: fotos.keyGrande, mini: fotos.keyMini }).from(fotos).where(eq(fotos.tramoId, tramo.id));
    await db.delete(tramos).where(eq(tramos.id, tramo.id));
    await r2?.borrar(claves.flatMap((c) => [c.grande, c.mini])).catch((err) => req.log.error(err, 'No se pudieron borrar las fotos de R2'));
    return reply.code(204).send();
  });
};
