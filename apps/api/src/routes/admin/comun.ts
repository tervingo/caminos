import { and, eq, isNotNull } from 'drizzle-orm';
import type { TramoEditor } from '@caminos/shared';
import type { Db } from '../../db/index.js';
import { caminos, etapas, fotos, lugares, tramos } from '../../db/schema.js';
import { HttpError, idValido, noEncontrado } from '../../errores.js';
import { bboxDe } from '../../geo.js';
import { columnasCamino, detalleEditor } from '../../lecturas.js';
import type { Buscador, Ors } from '../../ors.js';
import type { R2 } from '../../r2.js';

export interface OpcionesAdmin {
  db: Db;
  assetsUrl: string;
  r2?: R2;
  ors?: Ors;
  buscador: Buscador;
}

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Ejecutor = Db | Tx;

type Coord = [number, number];

export async function cargarTramo(db: Ejecutor, id: string) {
  const [fila] = await db
    .select({ tramo: tramos, camino: columnasCamino })
    .from(tramos)
    .innerJoin(caminos, eq(tramos.caminoId, caminos.id))
    .where(eq(tramos.id, idValido(id, 'No existe ese tramo')));
  if (!fila) throw noEncontrado('No existe ese tramo');
  return fila;
}

/** El tramo completo tal como lo ve el editor; lo devuelven todas las escrituras */
export async function tramoEditor(db: Db, assetsUrl: string, id: string): Promise<TramoEditor> {
  const { tramo, camino } = await cargarTramo(db, id);
  return detalleEditor(db, assetsUrl, tramo, camino);
}

/** Una etapa asignada a un lugar, foto o nota debe ser del mismo tramo */
export async function comprobarEtapa(db: Ejecutor, tramoId: string, etapaId: string | null | undefined) {
  if (!etapaId) return;
  const [etapa] = await db
    .select({ id: etapas.id })
    .from(etapas)
    .where(and(eq(etapas.id, etapaId), eq(etapas.tramoId, tramoId)));
  if (!etapa) throw new HttpError(400, 'etapa-ajena', 'Esa etapa no es de este tramo');
}

/**
 * Recalcula los totales del tramo a partir de sus etapas (km y desnivel) y el recuadro
 * de todo lo que se pinta en el mapa. Si ninguna etapa tiene desnivel, conserva el del tramo.
 */
export async function recalcularTramo(db: Ejecutor, tramoId: string): Promise<void> {
  // La ida y la vuelta en coche no cuentan para km, desnivel ni el recuadro del tramo
  const filasEtapas = await db
    .select()
    .from(etapas)
    .where(and(eq(etapas.tramoId, tramoId), eq(etapas.tipo, 'camino')));
  const filasLugares = await db.select({ lat: lugares.lat, lon: lugares.lon }).from(lugares).where(eq(lugares.tramoId, tramoId));
  const filasFotos = await db
    .select({ lat: fotos.lat, lon: fotos.lon })
    .from(fotos)
    .where(and(eq(fotos.tramoId, tramoId), isNotNull(fotos.lat), isNotNull(fotos.lon)));

  const coords: Coord[] = [];
  for (const e of filasEtapas) {
    if (e.traza) coords.push(...e.traza.coordinates);
    else {
      if (e.origenLat !== null && e.origenLon !== null) coords.push([e.origenLon, e.origenLat]);
      for (const p of e.via ?? []) coords.push([p.lon, p.lat]);
      if (e.destinoLat !== null && e.destinoLon !== null) coords.push([e.destinoLon, e.destinoLat]);
    }
    coords.push(...e.sitios.map((p): Coord => [p.lon, p.lat]));
  }
  coords.push(...filasLugares.map((l): Coord => [l.lon, l.lat]));
  coords.push(...filasFotos.map((f): Coord => [f.lon!, f.lat!]));

  const conDesnivel = filasEtapas.filter((e) => e.desnivelPos !== null);
  const kmTotal = Math.round(filasEtapas.reduce((s, e) => s + (e.km ?? 0), 0) * 100) / 100;

  await db
    .update(tramos)
    .set({
      kmTotal,
      bbox: bboxDe(coords),
      actualizadoEn: new Date(),
      ...(conDesnivel.length > 0 && { desnivelPosTotal: conDesnivel.reduce((s, e) => s + e.desnivelPos!, 0) }),
    })
    .where(eq(tramos.id, tramoId));
}

/** 'Camino del Norte' → 'camino-del-norte' */
export function slugDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ¿Es un error de clave única de Postgres? (Drizzle lo envuelve en `cause`) */
export function esDuplicado(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}
