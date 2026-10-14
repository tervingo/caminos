import { inArray, sql } from 'drizzle-orm';
import type { LineString } from '@caminos/shared';
import { bboxDe } from '../geo.js';
import type { Db } from './index.js';
import { caminos, etapas, lugares, notas, tramos } from './schema.js';
import { caminosSemilla, localidades, tramosSemilla } from './semilla-datos.js';

/**
 * Carga los tramos de ejemplo. Es repetible: borra y vuelve a crear solo esos tramos
 * (por slug) y actualiza los caminos; no toca ningún otro dato.
 */
export async function sembrar(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    const filasCaminos = await tx
      .insert(caminos)
      .values(caminosSemilla)
      .onConflictDoUpdate({
        target: caminos.slug,
        set: { nombre: sql`excluded.nombre`, color: sql`excluded.color` },
      })
      .returning();
    const idCamino = new Map(filasCaminos.map((c) => [c.slug, c.id]));

    await tx.delete(tramos).where(
      inArray(
        tramos.slug,
        tramosSemilla.map((t) => t.slug),
      ),
    );

    for (const t of tramosSemilla) {
      const trazas: LineString[] = t.etapas.map((e) => ({
        type: 'LineString',
        coordinates: e.puntos.map(([lat, lon]) => [lon, lat]),
      }));
      const coordsLugares = t.lugares.map((l) => {
        const [lat, lon] = localidades[l.localidad];
        return [lon, lat] as [number, number];
      });

      const [tramo] = await tx
        .insert(tramos)
        .values({
          slug: t.slug,
          anio: t.anio,
          caminoId: idCamino.get(t.camino)!,
          titulo: t.titulo,
          resumen: t.resumen,
          fechaInicio: t.fechaInicio,
          fechaFin: t.fechaFin,
          estado: 'publicado',
          kmTotal: t.etapas.reduce((suma, e) => suma + e.km, 0),
          desnivelPosTotal: t.desnivelPos,
          bbox: bboxDe([...trazas.flatMap((tr) => tr.coordinates), ...coordsLugares]),
        })
        .returning({ id: tramos.id });

      const filasEtapas = await tx
        .insert(etapas)
        .values(
          t.etapas.map((e, i) => {
            const [origen, destino] = e.titulo.split(' → ');
            const primero = e.puntos[0];
            const ultimo = e.puntos[e.puntos.length - 1];
            return {
              tramoId: tramo.id,
              posicion: i + 1,
              titulo: e.titulo,
              fecha: e.fecha,
              origen,
              origenLat: primero[0],
              origenLon: primero[1],
              destino,
              destinoLat: ultimo[0],
              destinoLon: ultimo[1],
              notas: e.notas,
              km: e.km,
              traza: trazas[i],
              trazaOrigen: 'manual' as const,
              bbox: bboxDe(trazas[i].coordinates),
            };
          }),
        )
        .returning({ id: etapas.id, origen: etapas.origen, destino: etapas.destino });

      // Cada lugar cuelga de la etapa que termina (o, si no, empieza) en su localidad
      const etapaDe = (localidad: string) =>
        (filasEtapas.find((e) => e.destino === localidad) ?? filasEtapas.find((e) => e.origen === localidad))?.id ??
        null;

      await tx.insert(lugares).values(
        t.lugares.map((l) => {
          const [lat, lon] = localidades[l.localidad];
          return { ...l, tramoId: tramo.id, etapaId: etapaDe(l.localidad), lat, lon };
        }),
      );
      await tx.insert(notas).values(t.notas.map((n) => ({ ...n, tramoId: tramo.id })));
    }
  });
}
