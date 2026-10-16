// Recorrido a pie de una etapa a partir de tracks GPX del Camino (p. ej. los del CNIG, uno por etapa
// de la FEAACS): se unen en una red, se busca el punto más cercano al origen y al destino de la etapa
// y se toma el camino más corto entre ambos por esa red.

export type LatLon = [number, number];
type Coord = [number, number]; // [lon, lat], como en GeoJSON

const R = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros (haversine) */
export function distancia([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Puntos a menos de ~10 m se consideran el mismo (une tracks que se tocan o se solapan) */
const clave = ([lat, lon]: LatLon) => `${Math.round(lat * 1e4)},${Math.round(lon * 1e4)}`;
/** Huecos entre el final de un track y otro que se salvan */
const HUECO_MAX = 150;

export interface Red {
  pos: LatLon[];
  ady: [number, number][][]; // vecino, metros
}

export function construirRed(tracks: LatLon[][]): Red {
  const indice = new Map<string, number>();
  const pos: LatLon[] = [];
  const ady: [number, number][][] = [];
  const nodo = (p: LatLon) => {
    const k = clave(p);
    let n = indice.get(k);
    if (n === undefined) {
      n = pos.length;
      indice.set(k, n);
      pos.push(p);
      ady.push([]);
    }
    return n;
  };
  const unir = (a: number, b: number) => {
    if (a === b) return;
    const d = distancia(pos[a], pos[b]);
    ady[a].push([b, d]);
    ady[b].push([a, d]);
  };

  const extremos: { nodo: number; track: number }[] = [];
  const trackDe: number[] = [];
  tracks.forEach((track, t) => {
    let anterior: number | null = null;
    for (const p of track) {
      const n = nodo(p);
      trackDe[n] ??= t;
      if (anterior !== null) unir(anterior, n);
      anterior = n;
    }
    if (track.length > 0) extremos.push({ nodo: nodo(track[0]), track: t }, { nodo: nodo(track.at(-1)!), track: t });
  });

  // Ficheros consecutivos que no acaban justo donde empieza el siguiente: se une cada extremo
  // con el punto más cercano de otro track si está a menos de HUECO_MAX
  for (const e of extremos) {
    let mejor = -1;
    let md = HUECO_MAX;
    for (let n = 0; n < pos.length; n++) {
      if (trackDe[n] === e.track) continue;
      const d = distancia(pos[e.nodo], pos[n]);
      if (d < md) {
        md = d;
        mejor = n;
      }
    }
    if (mejor >= 0) unir(e.nodo, mejor);
  }
  return { pos, ady };
}

function masCercano(red: Red, p: LatLon): { nodo: number; metros: number } {
  let nodo = -1;
  let metros = Infinity;
  red.pos.forEach((q, n) => {
    const d = distancia(p, q);
    if (d < metros) {
      metros = d;
      nodo = n;
    }
  });
  return { nodo, metros };
}

/** Dijkstra con montículo binario: las redes de varios ficheros tienen miles de puntos */
function caminoMasCorto(red: Red, origen: number, destino: number): number[] | null {
  const dist = new Float64Array(red.pos.length).fill(Infinity);
  const previo = new Int32Array(red.pos.length).fill(-1);
  const monticulo: [number, number][] = [];
  const meter = (x: [number, number]) => {
    monticulo.push(x);
    for (let i = monticulo.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (monticulo[p][0] <= monticulo[i][0]) break;
      [monticulo[p], monticulo[i]] = [monticulo[i], monticulo[p]];
      i = p;
    }
  };
  const sacar = () => {
    const cima = monticulo[0];
    const ultimo = monticulo.pop()!;
    if (monticulo.length > 0) {
      monticulo[0] = ultimo;
      for (let i = 0; ; ) {
        const [a, b] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (a < monticulo.length && monticulo[a][0] < monticulo[m][0]) m = a;
        if (b < monticulo.length && monticulo[b][0] < monticulo[m][0]) m = b;
        if (m === i) break;
        [monticulo[m], monticulo[i]] = [monticulo[i], monticulo[m]];
        i = m;
      }
    }
    return cima;
  };

  dist[origen] = 0;
  meter([0, origen]);
  while (monticulo.length > 0) {
    const [d, u] = sacar();
    if (u === destino) break;
    if (d > dist[u]) continue;
    for (const [v, w] of red.ady[u]) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        previo[v] = u;
        meter([d + w, v]);
      }
    }
  }
  if (dist[destino] === Infinity) return null;
  const camino: number[] = [];
  for (let n = destino; n !== -1; n = previo[n]) camino.push(n);
  return camino.reverse();
}

/** Douglas-Peucker en metros (proyección local), para no guardar miles de puntos */
export function simplificar(coords: Coord[], toleranciaM = 5): Coord[] {
  if (coords.length <= 2) return coords;
  const lat0 = rad(coords.reduce((s, [, lat]) => s + lat, 0) / coords.length);
  const xy = coords.map(([lon, lat]) => [lon * 111_320 * Math.cos(lat0), lat * 110_540]);
  const conservar = new Uint8Array(coords.length);
  conservar[0] = conservar[coords.length - 1] = 1;
  const pila: [number, number][] = [[0, coords.length - 1]];
  while (pila.length > 0) {
    const [a, b] = pila.pop()!;
    const [ax, ay] = xy[a];
    const [dx, dy] = [xy[b][0] - ax, xy[b][1] - ay];
    const largo2 = dx * dx + dy * dy;
    let max = -1;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / largo2));
      const d = Math.hypot(xy[i][0] - (ax + t * dx), xy[i][1] - (ay + t * dy));
      if (d > max) {
        max = d;
        indice = i;
      }
    }
    if (max > toleranciaM) {
      conservar[indice] = 1;
      pila.push([a, indice], [indice, b]);
    }
  }
  return coords.filter((_, i) => conservar[i]);
}

export type ResultadoPie =
  | { ok: true; coordenadas: Coord[]; metros: number; aOrigen: number; aDestino: number }
  | { ok: false; motivo: 'lejos' | 'sin-conexion'; aOrigen: number; aDestino: number };

/** Origen o destino a más de esto del track: la etapa no está en esos ficheros */
export const LEJOS_MAX = 3000;

/** Recorta de la red el recorrido entre el origen y el destino de una etapa */
export function recortar(red: Red, origen: LatLon, destino: LatLon): ResultadoPie {
  const a = masCercano(red, origen);
  const b = masCercano(red, destino);
  const base = { aOrigen: Math.round(a.metros), aDestino: Math.round(b.metros) };
  if (a.nodo < 0 || a.metros > LEJOS_MAX || b.metros > LEJOS_MAX) return { ok: false, motivo: 'lejos', ...base };
  const camino = caminoMasCorto(red, a.nodo, b.nodo);
  if (!camino || camino.length < 2) return { ok: false, motivo: 'sin-conexion', ...base };
  let metros = 0;
  for (let i = 1; i < camino.length; i++) metros += distancia(red.pos[camino[i - 1]], red.pos[camino[i]]);
  const coordenadas = simplificar(camino.map((n): Coord => [red.pos[n][1], red.pos[n][0]]));
  return { ok: true, coordenadas, metros, ...base };
}
