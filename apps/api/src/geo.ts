import type { BBox, LineString } from '@caminos/shared';

type Coord = [number, number]; // [lon, lat]

export function bboxDe(coords: Coord[]): BBox | null {
  if (coords.length === 0) return null;
  let [minLon, minLat] = coords[0];
  let [maxLon, maxLat] = coords[0];
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Une las trazas de las etapas y deja como mucho `maxPuntos`, conservando el primero y el último. */
export function rutaResumida(trazas: (LineString | null)[], maxPuntos = 40): LineString | null {
  const coords = trazas.flatMap((t) => t?.coordinates ?? []);
  if (coords.length < 2) return null;
  if (coords.length <= maxPuntos) return { type: 'LineString', coordinates: coords };
  const paso = (coords.length - 1) / (maxPuntos - 1);
  const resumen = Array.from({ length: maxPuntos }, (_, i) => coords[Math.round(i * paso)]);
  return { type: 'LineString', coordinates: resumen };
}
