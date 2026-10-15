import { and, asc, eq, max, ne } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import {
  calcularRutaSchema,
  etapaCambiosSchema,
  etapaEntradaSchema,
  ordenEtapasSchema,
  type Punto,
  type TramoEditor,
} from '@caminos/shared';
import { etapas } from '../../db/schema.js';
import { HttpError, idValido, noEncontrado, validar } from '../../errores.js';
import { bboxDe, simplificar } from '../../geo.js';
import { cargarTramo, type OpcionesAdmin, recalcularTramo, tramoEditor, type Tx } from './comun.js';

type Params = { Params: { id: string } };

/** Columnas de origen y destino a partir de los puntos del formulario */
function columnasPuntos(datos: { origen?: Punto | null; destino?: Punto | null }) {
  return {
    ...(datos.origen !== undefined && {
      origen: datos.origen?.nombre ?? null,
      origenLat: datos.origen?.lat ?? null,
      origenLon: datos.origen?.lon ?? null,
    }),
    ...(datos.destino !== undefined && {
      destino: datos.destino?.nombre ?? null,
      destinoLat: datos.destino?.lat ?? null,
      destinoLon: datos.destino?.lon ?? null,
    }),
  };
}

/** Vuelve a numerar las etapas 1, 2, 3… en el orden dado (la restricción única es diferida) */
async function numerar(tx: Tx, ids: string[]) {
  for (const [i, id] of ids.entries()) await tx.update(etapas).set({ posicion: i + 1 }).where(eq(etapas.id, id));
}

export const etapasAdmin: FastifyPluginAsync<OpcionesAdmin> = async (app, { db, assetsUrl, ors }) => {
  const cargarEtapa = async (id: string) => {
    const [etapa] = await db.select().from(etapas).where(eq(etapas.id, idValido(id, 'No existe esa etapa')));
    if (!etapa) throw noEncontrado('No existe esa etapa');
    return etapa;
  };

  app.post<Params>('/api/admin/tramos/:id/etapas', async (req, reply): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const datos = validar(etapaEntradaSchema, req.body);
    const [{ ultima }] = await db.select({ ultima: max(etapas.posicion) }).from(etapas).where(eq(etapas.tramoId, tramo.id));
    await db.insert(etapas).values({
      tramoId: tramo.id,
      posicion: (ultima ?? 0) + 1,
      titulo: datos.titulo,
      fecha: datos.fecha ?? null,
      ...columnasPuntos(datos),
      via: datos.via ?? [],
      notas: datos.notas ?? null,
      km: datos.km ?? null,
      desnivelPos: datos.desnivelPos ?? null,
      desnivelNeg: datos.desnivelNeg ?? null,
    });
    await recalcularTramo(db, tramo.id);
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/etapas/:id', async (req): Promise<TramoEditor> => {
    const etapa = await cargarEtapa(req.params.id);
    const datos = validar(etapaCambiosSchema, req.body);
    const { origen, destino, via, ...resto } = datos;
    // Si cambian los puntos, la ruta por carretera deja de valer hasta recalcularla
    const cambianPuntos = origen !== undefined || destino !== undefined || via !== undefined;
    const invalidarRuta = cambianPuntos && etapa.trazaOrigen !== 'gpx';
    await db
      .update(etapas)
      .set({
        ...resto,
        ...columnasPuntos({ origen, destino }),
        ...(via !== undefined && { via }),
        ...(invalidarRuta && { traza: null, bbox: null, trazaOrigen: 'carretera' as const }),
      })
      .where(eq(etapas.id, etapa.id));
    await recalcularTramo(db, etapa.tramoId);
    return tramoEditor(db, assetsUrl, etapa.tramoId);
  });

  app.delete<Params>('/api/admin/etapas/:id', async (req): Promise<TramoEditor> => {
    const etapa = await cargarEtapa(req.params.id);
    await db.transaction(async (tx) => {
      await tx.delete(etapas).where(eq(etapas.id, etapa.id));
      const restantes = await tx
        .select({ id: etapas.id })
        .from(etapas)
        .where(and(eq(etapas.tramoId, etapa.tramoId), ne(etapas.id, etapa.id)))
        .orderBy(asc(etapas.posicion));
      await numerar(
        tx,
        restantes.map((e) => e.id),
      );
      await recalcularTramo(tx, etapa.tramoId);
    });
    return tramoEditor(db, assetsUrl, etapa.tramoId);
  });

  app.put<Params>('/api/admin/tramos/:id/etapas/orden', async (req): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const { ids } = validar(ordenEtapasSchema, req.body);
    const actuales = await db.select({ id: etapas.id }).from(etapas).where(eq(etapas.tramoId, tramo.id));
    const mismas = ids.length === actuales.length && new Set(ids).size === ids.length && actuales.every((e) => ids.includes(e.id));
    if (!mismas) throw new HttpError(400, 'orden-incompleto', 'El orden debe incluir todas las etapas del tramo, una vez cada una');
    await db.transaction((tx) => numerar(tx, ids));
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.post<Params>('/api/admin/etapas/:id/calcular-ruta', async (req): Promise<TramoEditor> => {
    if (!ors) throw new HttpError(503, 'rutas-sin-configurar', 'Falta la clave de OpenRouteService (ORS_API_KEY)');
    const etapa = await cargarEtapa(req.params.id);
    const { perfil } = validar(calcularRutaSchema, req.body ?? {});
    if (etapa.origenLat === null || etapa.origenLon === null || etapa.destinoLat === null || etapa.destinoLon === null) {
      throw new HttpError(400, 'faltan-puntos', 'La etapa necesita origen y destino');
    }

    const puntos: [number, number][] = [
      [etapa.origenLon, etapa.origenLat],
      ...(etapa.via ?? []).map((p): [number, number] => [p.lon, p.lat]),
      [etapa.destinoLon, etapa.destinoLat],
    ];
    const ruta = await ors.ruta(puntos, perfil);
    const coordenadas = simplificar(ruta.coordenadas);

    await db
      .update(etapas)
      .set({
        traza: { type: 'LineString', coordinates: coordenadas },
        trazaOrigen: 'carretera',
        bbox: bboxDe(coordenadas),
        km: Math.round(ruta.metros / 10) / 100,
        desnivelPos: ruta.subida === null ? null : Math.round(ruta.subida),
        desnivelNeg: ruta.bajada === null ? null : Math.round(ruta.bajada),
      })
      .where(eq(etapas.id, etapa.id));
    await recalcularTramo(db, etapa.tramoId);
    return tramoEditor(db, assetsUrl, etapa.tramoId);
  });
};
