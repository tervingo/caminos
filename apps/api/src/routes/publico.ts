import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { Camino, TramoDetalle, TramoResumen } from '@caminos/shared';
import type { Db } from '../db/index.js';
import { caminos, etapas, fotos, tramos } from '../db/schema.js';
import { noEncontrado } from '../errores.js';
import { rutaResumida } from '../geo.js';
import { cabecera, columnasCamino, detallePublico } from '../lecturas.js';

export const publicoRoutes: FastifyPluginAsync<{ db: Db; assetsUrl: string }> = async (app, { db, assetsUrl }) => {
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
        ...cabecera(assetsUrl, tramo, camino, propias.length, portada),
        ruta: rutaResumida(propias.map((e) => e.traza)),
      };
    });
  });

  // Los borradores solo los ve el autor con sesión (vista previa desde el editor)
  app.get<{ Params: { slug: string } }>('/api/tramos/:slug', async (req): Promise<TramoDetalle> => {
    const [fila] = await db
      .select({ tramo: tramos, camino: columnasCamino })
      .from(tramos)
      .innerJoin(caminos, eq(tramos.caminoId, caminos.id))
      .where(eq(tramos.slug, req.params.slug));
    const visible =
      fila &&
      (fila.tramo.estado === 'publicado' ||
        (await req.jwtVerify().then(
          () => true,
          () => false,
        )));
    if (!visible) throw noEncontrado('No existe ese tramo');
    return detallePublico(db, assetsUrl, fila.tramo, fila.camino);
  });
};
