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

/**
 * Simplifica una línea con Douglas-Peucker. La tolerancia va en metros; a la escala de una
 * etapa basta con proyectar lon/lat a un plano local.
 */
export function simplificar(coords: Coord[], toleranciaM = 5): Coord[] {
  if (coords.length <= 2) return coords;
  const latMedia = (coords.reduce((s, [, lat]) => s + lat, 0) / coords.length) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(latMedia);
  const my = 110_540;
  const xy = coords.map(([lon, lat]) => [lon * mx, lat * my]);

  const conservar = new Uint8Array(coords.length);
  conservar[0] = conservar[coords.length - 1] = 1;
  const pila: [number, number][] = [[0, coords.length - 1]];
  while (pila.length > 0) {
    const [a, b] = pila.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    let maxDist = -1;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      // Distancia del punto al segmento a-b
      const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxDist) {
        maxDist = d;
        indice = i;
      }
    }
    if (maxDist > toleranciaM) {
      conservar[indice] = 1;
      pila.push([a, indice], [indice, b]);
    }
  }
  return coords.filter((_, i) => conservar[i]);
}
