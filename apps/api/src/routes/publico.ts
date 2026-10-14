import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { Camino, Etapa, Foto, Lugar, Nota, Punto, TramoDetalle, TramoResumen } from '@caminos/shared';
import type { Db } from '../db/index.js';
import { caminos, etapas, fotos, lugares, notas, tramos } from '../db/schema.js';
import { noEncontrado } from '../errores.js';
import { rutaResumida } from '../geo.js';

type FilaFoto = typeof fotos.$inferSelect;
type FilaTramo = typeof tramos.$inferSelect;

const columnasCamino = { slug: caminos.slug, nombre: caminos.nombre, color: caminos.color };

function punto(nombre: string | null, lat: number | null, lon: number | null): Punto | null {
  return lat !== null && lon !== null ? { nombre, lat, lon } : null;
}

export const publicoRoutes: FastifyPluginAsync<{ db: Db; assetsUrl: string }> = async (app, { db, assetsUrl }) => {
  const aFoto = (f: FilaFoto): Foto => ({
    id: f.id,
    etapaId: f.etapaId,
    urlGrande: `${assetsUrl}/${f.keyGrande}`,
    urlMini: `${assetsUrl}/${f.keyMini}`,
    ancho: f.ancho,
    alto: f.alto,
    pie: f.pie,
    tomadaEn: f.tomadaEn?.toISOString() ?? null,
    lat: f.mostrarPosicion ? f.lat : null,
    lon: f.mostrarPosicion ? f.lon : null,
    orden: f.orden,
  });

  const cabecera = (t: FilaTramo, camino: Camino, numEtapas: number, portada: FilaFoto | undefined) => ({
    slug: t.slug,
    anio: t.anio,
    camino,
    titulo: t.titulo,
    resumen: t.resumen,
    fechaInicio: t.fechaInicio,
    fechaFin: t.fechaFin,
    kmTotal: t.kmTotal,
    desnivelPosTotal: t.desnivelPosTotal,
    numEtapas,
    bbox: t.bbox,
    portada: portada ? aFoto(portada) : null,
  });

  app.get('/api/caminos', async (): Promise<Camino[]> =>
    db.select(columnasCamino).from(caminos).orderBy(asc(caminos.nombre)),
  );

  app.get('/api/tramos', async (): Promise<TramoResumen[]> => {
    const filas = await db
      .select({ tramo: tramos, camino: columnasCamino })
      .from(tramos)
      .innerJoin(caminos, eq(tramos.caminoId, caminos.id))
      .where(eq(tramos.estado, 'publicado'))
      .orderBy(desc(tramos.anio), asc(tramos.slug));
    if (filas.length === 0) return [];

    const ids = filas.map((f) => f.tramo.id);
    const idsPortada = filas.map((f) => f.tramo.portadaFotoId).filter((id): id is string => id !== null);
    const [trazas, filasPortada] = await Promise.all([
      db
        .select({ tramoId: etapas.tramoId, traza: etapas.traza })
        .from(etapas)
        .where(inArray(etapas.tramoId, ids))
        .orderBy(asc(etapas.tramoId), asc(etapas.posicion)),
      idsPortada.length > 0 ? db.select().from(fotos).where(inArray(fotos.id, idsPortada)) : [],
    ]);
    const porTramo = Map.groupBy(trazas, (e) => e.tramoId);
    const portadas = new Map(filasPortada.map((f) => [f.id, f]));

    return filas.map(({ tramo, camino }) => {
      const propias = porTramo.get(tramo.id) ?? [];
      const portada = tramo.portadaFotoId ? portadas.get(tramo.portadaFotoId) : undefined;
      return {
        ...cabecera(tramo, camino, propias.length, portada),
        ruta: rutaResumida(propias.map((e) => e.traza)),
      };
    });
  });

  app.get<{ Params: { slug: string } }>('/api/tramos/:slug', async (req): Promise<TramoDetalle> => {
    const [fila] = await db
      .select({ tramo: tramos, camino: columnasCamino })
      .from(tramos)
      .innerJoin(caminos, eq(tramos.caminoId, caminos.id))
      .where(and(eq(tramos.slug, req.params.slug), eq(tramos.estado, 'publicado')));
    if (!fila) throw noEncontrado('No existe ese tramo');
    const { tramo, camino } = fila;

    const [filasEtapas, filasLugares, filasFotos, filasNotas] = await Promise.all([
      db.select().from(etapas).where(eq(etapas.tramoId, tramo.id)).orderBy(asc(etapas.posicion)),
      db.select().from(lugares).where(eq(lugares.tramoId, tramo.id)).orderBy(asc(lugares.tipo), asc(lugares.nombre)),
      db.select().from(fotos).where(eq(fotos.tramoId, tramo.id)).orderBy(asc(fotos.orden)),
      db.select().from(notas).where(eq(notas.tramoId, tramo.id)).orderBy(asc(notas.fecha)),
    ]);
    const portada = filasFotos.find((f) => f.id === tramo.portadaFotoId);

    return {
      ...cabecera(tramo, camino, filasEtapas.length, portada),
      etapas: filasEtapas.map(
        (e): Etapa => ({
          id: e.id,
          posicion: e.posicion,
          titulo: e.titulo,
          fecha: e.fecha,
          origen: punto(e.origen, e.origenLat, e.origenLon),
          destino: punto(e.destino, e.destinoLat, e.destinoLon),
          via: e.via ?? [],
          notas: e.notas,
          km: e.km,
          desnivelPos: e.desnivelPos,
          desnivelNeg: e.desnivelNeg,
          traza: e.traza,
          trazaOrigen: e.trazaOrigen,
          bbox: e.bbox,
        }),
      ),
      lugares: filasLugares.map(
        (l): Lugar => ({
          id: l.id,
          etapaId: l.etapaId,
          tipo: l.tipo,
          nombre: l.nombre,
          localidad: l.localidad,
          lat: l.lat,
          lon: l.lon,
          precio: l.precio,
          nota: l.nota,
          url: l.url,
        }),
      ),
      fotos: filasFotos.map(aFoto),
      notas: filasNotas.map((n): Nota => ({ id: n.id, etapaId: n.etapaId, fecha: n.fecha, texto: n.texto })),
    };
  });
};
