import { and, asc, eq, max, ne } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import {
  calcularRutaSchema,
  etapaCambiosSchema,
  etapaEntradaSchema,
  ordenEtapasSchema,
  recorridoPieSchema,
  type Perfil,
  perfilDe,
  type Punto,
  type TramoEditor,
} from '@caminos/shared';
import { etapas } from '../../db/schema.js';
import { HttpError, idValido, noEncontrado, validar } from '../../errores.js';
import { bboxDe, simplificar } from '../../geo.js';
import { cargarTramo, comprobarFotos, type OpcionesAdmin, recalcularTramo, tramoEditor, type Tx } from './comun.js';

type Params = { Params: { id: string } };

/** La ida y la vuelta quedan fuera de la numeración 1, 2, 3… de las etapas del Camino */
const POSICION_VIAJE = { ida: 0, vuelta: -1 } as const;

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
    const tipo = datos.tipo ?? 'camino';
    let posicion: number;
    if (tipo === 'camino') {
      const [{ ultima }] = await db.select({ ultima: max(etapas.posicion) }).from(etapas).where(eq(etapas.tramoId, tramo.id));
      posicion = Math.max(ultima ?? 0, 0) + 1;
    } else {
      const [ya] = await db.select({ id: etapas.id }).from(etapas).where(and(eq(etapas.tramoId, tramo.id), eq(etapas.tipo, tipo)));
      if (ya) throw new HttpError(409, 'viaje-repetido', `Este tramo ya tiene ${tipo === 'ida' ? 'ida' : 'vuelta'}`);
      posicion = POSICION_VIAJE[tipo];
    }
    await comprobarFotos(db, tramo.id, (datos.sitios ?? []).map((s) => s.fotoId));
    await db.insert(etapas).values({
      tramoId: tramo.id,
      tipo,
      posicion,
      titulo: datos.titulo,
      fecha: datos.fecha ?? null,
      ...columnasPuntos(datos),
      via: datos.via ?? [],
      notas: datos.notas ?? null,
      km: datos.km ?? null,
      desnivelPos: datos.desnivelPos ?? null,
      desnivelNeg: datos.desnivelNeg ?? null,
      sitios: datos.sitios ?? [],
    });
    await recalcularTramo(db, tramo.id);
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/etapas/:id', async (req): Promise<TramoEditor> => {
    const etapa = await cargarEtapa(req.params.id);
    const datos = validar(etapaCambiosSchema, req.body);
    const { origen, destino, via, ...resto } = datos;
    await comprobarFotos(db, etapa.tramoId, (datos.sitios ?? []).map((s) => s.fotoId));
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
        .where(and(eq(etapas.tramoId, etapa.tramoId), ne(etapas.id, etapa.id), eq(etapas.tipo, 'camino')))
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
    const actuales = await db
      .select({ id: etapas.id })
      .from(etapas)
      .where(and(eq(etapas.tramoId, tramo.id), eq(etapas.tipo, 'camino')));
    const mismas = ids.length === actuales.length && new Set(ids).size === ids.length && actuales.every((e) => ids.includes(e.id));
    if (!mismas) throw new HttpError(400, 'orden-incompleto', 'El orden debe incluir todas las etapas del tramo, una vez cada una');
    await db.transaction((tx) => numerar(tx, ids));
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  /** Perfil de una línea con las altitudes de ORS; sin ORS, o si falla, no hay perfil (no es motivo para no guardar) */
  const perfilDeLinea = async (coords: [number, number][], log: { warn: (o: object, m: string) => void }): Promise<Perfil | null> => {
    if (!ors || coords.length < 2) return null;
    try {
      return perfilDe(await ors.altitudes(coords));
    } catch (err) {
      log.warn({ err }, 'No se pudo calcular el perfil de altitud');
      return null;
    }
  };
  /** El desnivel de una etapa sale de su perfil cuando lo hay, para que cifras y gráfico coincidan */
  const columnasPerfil = (perfil: Perfil | null) => ({
    perfil,
    ...(perfil && { desnivelPos: perfil.subida, desnivelNeg: perfil.bajada }),
  });

  // Recalcula el perfil de todas las etapas del Camino (las que ya existían o las que no lo tienen)
  app.post<Params>('/api/admin/tramos/:id/perfiles', async (req): Promise<TramoEditor> => {
    if (!ors) throw new HttpError(503, 'rutas-sin-configurar', 'Falta la clave de OpenRouteService (ORS_API_KEY)');
    const { tramo } = await cargarTramo(db, req.params.id);
    const filas = await db
      .select({ id: etapas.id, traza: etapas.traza, trazaPie: etapas.trazaPie, perfil: etapas.perfil })
      .from(etapas)
      .where(and(eq(etapas.tramoId, tramo.id), eq(etapas.tipo, 'camino')));
    for (const e of filas) {
      // Un perfil con las altitudes medidas del GPX es mejor que el del terreno: no se sustituye
      if (e.trazaPie && e.perfil?.origen === 'gpx') continue;
      const linea = e.trazaPie ?? e.traza;
      if (!linea) continue;
      const perfil = await perfilDeLinea(linea.coordinates, req.log);
      if (perfil) await db.update(etapas).set(columnasPerfil(perfil)).where(eq(etapas.id, e.id));
    }
    await recalcularTramo(db, tramo.id);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  // Recorridos a pie recortados en el navegador de los GPX subidos (p. ej. del CNIG)
  app.put<Params>('/api/admin/tramos/:id/recorrido-pie', { bodyLimit: 5 * 1024 * 1024 }, async (req): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const { fuente, etapas: cambios } = validar(recorridoPieSchema, req.body);
    const propias = await db
      .select({ id: etapas.id, traza: etapas.traza })
      .from(etapas)
      .where(and(eq(etapas.tramoId, tramo.id), eq(etapas.tipo, 'camino')));
    const porId = new Map(propias.map((e) => [e.id, e]));
    if (!cambios.every((c) => porId.has(c.id))) throw new HttpError(400, 'etapa-ajena', 'Alguna etapa no es del Camino de este tramo');

    // El perfil sigue a la línea principal: el del GPX si trae altitudes; si no, el del terreno del
    // recorrido a pie o, si este se quita, el de la ruta por carretera
    const perfiles = new Map<string, Perfil | null>();
    for (const c of cambios) {
      if (c.traza && c.perfil) {
        perfiles.set(c.id, c.perfil);
        continue;
      }
      const linea = c.traza ?? porId.get(c.id)!.traza;
      perfiles.set(c.id, linea ? await perfilDeLinea(linea.coordinates, req.log) : null);
    }

    await db.transaction(async (tx) => {
      for (const c of cambios) {
        await tx
          .update(etapas)
          .set({
            trazaPie: c.traza ? { type: 'LineString', coordinates: c.traza.coordinates } : null,
            kmPie: c.traza ? c.km : null,
            trazaPieFuente: c.traza ? fuente : null,
            ...columnasPerfil(perfiles.get(c.id) ?? null),
          })
          .where(eq(etapas.id, c.id));
      }
      await recalcularTramo(tx, tramo.id);
    });
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
    // La ida y la vuelta solo se ven en la vista de la península: basta con mucho menos detalle
    const coordenadas = simplificar(ruta.coordenadas, etapa.tipo === 'camino' ? 5 : 150);

    await db
      .update(etapas)
      .set({
        traza: { type: 'LineString', coordinates: coordenadas },
        trazaOrigen: 'carretera',
        bbox: bboxDe(coordenadas),
        km: Math.round(ruta.metros / 10) / 100,
        // El desnivel y el perfil de un viaje en coche (la ida o la vuelta) no dicen nada; si la etapa
        // tiene recorrido a pie, su perfil y su desnivel son los de ese recorrido y no se tocan
        ...(etapa.tipo !== 'camino'
          ? { desnivelPos: null, desnivelNeg: null, perfil: null }
          : !etapa.trazaPie && columnasPerfil(perfilDe(ruta.conAltitud))),
      })
      .where(eq(etapas.id, etapa.id));
    await recalcularTramo(db, etapa.tramoId);
    return tramoEditor(db, assetsUrl, etapa.tramoId);
  });
};
