// Conversión de filas de la base a las formas del API, compartida por la parte pública y el editor.
import { asc, eq } from 'drizzle-orm';
import type { Camino, Etapa, Foto, FotoEditor, Lugar, Nota, Punto, TramoDetalle, TramoEditor } from '@caminos/shared';
import type { Db } from './db/index.js';
import { caminos, etapas, fotos, lugares, notas, tramos } from './db/schema.js';

export type FilaFoto = typeof fotos.$inferSelect;
export type FilaTramo = typeof tramos.$inferSelect;
export type FilaEtapa = typeof etapas.$inferSelect;

export const columnasCamino = { slug: caminos.slug, nombre: caminos.nombre, color: caminos.color };

function punto(nombre: string | null, lat: number | null, lon: number | null): Punto | null {
  return lat !== null && lon !== null ? { nombre, lat, lon } : null;
}

export function aFoto(assetsUrl: string, f: FilaFoto): Foto {
  return {
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
  };
}

/** En el editor la foto conserva su posición aunque el público no la vea */
export function aFotoEditor(assetsUrl: string, f: FilaFoto): FotoEditor {
  return { ...aFoto(assetsUrl, f), lat: f.lat, lon: f.lon, mostrarPosicion: f.mostrarPosicion };
}

export function aEtapa(e: FilaEtapa): Etapa {
  return {
    id: e.id,
    tipo: e.tipo,
    posicion: e.posicion,
    titulo: e.titulo,
    fecha: e.fecha,
    origen: punto(e.origen, e.origenLat, e.origenLon),
    destino: punto(e.destino, e.destinoLat, e.destinoLon),
    via: e.via ?? [],
    notas: e.notas,
    km: e.km,
    // La ida y la vuelta nunca muestran desnivel (aunque se calculara antes de esta regla)
    desnivelPos: e.tipo === 'camino' ? e.desnivelPos : null,
    desnivelNeg: e.tipo === 'camino' ? e.desnivelNeg : null,
    traza: e.traza,
    trazaOrigen: e.trazaOrigen,
    bbox: e.bbox,
    trazaPie: e.trazaPie,
    kmPie: e.kmPie,
    trazaPieFuente: e.trazaPieFuente,
    sitios: e.sitios.map((s) => ({ ...s, fotoId: s.fotoId ?? null })),
  };
}

export function cabecera(assetsUrl: string, t: FilaTramo, camino: Camino, numEtapas: number, portada: FilaFoto | undefined) {
  return {
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
    portada: portada ? aFoto(assetsUrl, portada) : null,
  };
}

async function contenido(db: Db, tramoId: string) {
  const [filasEtapas, filasLugares, filasFotos, filasNotas] = await Promise.all([
    db.select().from(etapas).where(eq(etapas.tramoId, tramoId)).orderBy(asc(etapas.posicion)),
    db.select().from(lugares).where(eq(lugares.tramoId, tramoId)).orderBy(asc(lugares.tipo), asc(lugares.nombre)),
    db.select().from(fotos).where(eq(fotos.tramoId, tramoId)).orderBy(asc(fotos.orden)),
    db.select().from(notas).where(eq(notas.tramoId, tramoId)).orderBy(asc(notas.fecha)),
  ]);
  const todas = filasEtapas.map(aEtapa);
  return {
    // La ida y la vuelta van aparte: no cuentan como etapas del Camino
    etapas: todas.filter((e) => e.tipo === 'camino'),
    ida: todas.find((e) => e.tipo === 'ida') ?? null,
    vuelta: todas.find((e) => e.tipo === 'vuelta') ?? null,
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
        valoracion: l.valoracion,
        nota: l.nota,
        url: l.url,
        fotoId: l.fotoId,
      }),
    ),
    filasFotos,
    notas: filasNotas.map((n): Nota => ({ id: n.id, etapaId: n.etapaId, fecha: n.fecha, texto: n.texto })),
  };
}

export async function detallePublico(db: Db, assetsUrl: string, tramo: FilaTramo, camino: Camino): Promise<TramoDetalle> {
  const { filasFotos, ...resto } = await contenido(db, tramo.id);
  const portada = filasFotos.find((f) => f.id === tramo.portadaFotoId);
  return {
    ...cabecera(assetsUrl, tramo, camino, resto.etapas.length, portada),
    ...resto,
    fotos: filasFotos.map((f) => aFoto(assetsUrl, f)),
  };
}

export async function detalleEditor(db: Db, assetsUrl: string, tramo: FilaTramo, camino: Camino): Promise<TramoEditor> {
  const { filasFotos, ...resto } = await contenido(db, tramo.id);
  const portada = filasFotos.find((f) => f.id === tramo.portadaFotoId);
  return {
    ...cabecera(assetsUrl, tramo, camino, resto.etapas.length, portada),
    ...resto,
    id: tramo.id,
    estado: tramo.estado,
    portadaFotoId: tramo.portadaFotoId,
    fotos: filasFotos.map((f) => aFotoEditor(assetsUrl, f)),
  };
}
