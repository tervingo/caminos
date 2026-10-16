// Utilidades geográficas sin dependencia de Leaflet. GeoJSON usa [lon, lat]; Leaflet, [lat, lon].
import type { BBox, Etapa, LineString, TramoDetalle } from '@caminos/shared';

export type LatLon = [number, number];
/** [[sur, oeste], [norte, este]] */
export type Limites = [LatLon, LatLon];

/** Vista de la Península Ibérica (con Baleares y el sur de Francia justo en el borde) */
export const PENINSULA: Limites = [
  [35.9, -9.6],
  [43.9, 3.4],
];

/** Desde este zoom se ven lugares, fotos y etapas numeradas; por debajo, marcadores de año */
export const ZOOM_DETALLE = 9;

/** Zoom al que se acerca el mapa al pulsar «Ver en el mapa» */
export const ZOOM_FOCO = 14;

export const aLatLon = (linea: LineString): LatLon[] => linea.coordinates.map(([lon, lat]) => [lat, lon]);

export function limitesDeBbox([minLon, minLat, maxLon, maxLat]: BBox): Limites {
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

export function limitesDePuntos(puntos: LatLon[]): Limites | null {
  if (puntos.length === 0) return null;
  let [sur, oeste] = puntos[0];
  let [norte, este] = puntos[0];
  for (const [lat, lon] of puntos) {
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
    oeste = Math.min(oeste, lon);
    este = Math.max(este, lon);
  }
  return [
    [sur, oeste],
    [norte, este],
  ];
}

/** Recuadro de todo lo que se pinta del tramo: etapas, lugares y fotos con posición */
export function limitesTramo(tramo: TramoDetalle): Limites | null {
  const puntos: LatLon[] = [
    ...tramo.etapas.flatMap((e) => [...puntosEtapa(e), ...puntosSitios(e)]),
    ...tramo.lugares.map((l): LatLon => [l.lat, l.lon]),
    ...tramo.fotos.flatMap((f): LatLon[] => (f.lat !== null && f.lon !== null ? [[f.lat, f.lon]] : [])),
  ];
  if (tramo.bbox) puntos.push(...limitesDeBbox(tramo.bbox));
  return limitesDePuntos(puntos);
}

/** Puntos de la línea principal de una etapa: el recorrido a pie, la ruta o, si no, origen, paradas y destino */
export function puntosEtapa(etapa: Etapa): LatLon[] {
  if (etapa.trazaPie && etapa.trazaPie.coordinates.length > 0) return aLatLon(etapa.trazaPie);
  if (etapa.traza && etapa.traza.coordinates.length > 0) return aLatLon(etapa.traza);
  return [etapa.origen, ...etapa.via, etapa.destino].flatMap((p): LatLon[] => (p ? [[p.lat, p.lon]] : []));
}

const puntosSitios = (etapa: Etapa): LatLon[] => etapa.sitios.map((s): LatLon => [s.lat, s.lon]);

/** Recuadro de la etapa: su ruta y sus sitios de interés */
export function limitesEtapa(etapa: Etapa): Limites | null {
  // El bbox guardado es el de la ruta por carretera: con recorrido a pie se usa este
  const ruta = etapa.bbox && !etapa.trazaPie ? limitesDeBbox(etapa.bbox) : puntosEtapa(etapa);
  return limitesDePuntos([...ruta, ...puntosSitios(etapa)]);
}

export function inicioEtapa(etapa: Etapa): LatLon | null {
  return puntosEtapa(etapa)[0] ?? null;
}

export function finEtapa(etapa: Etapa): LatLon | null {
  return puntosEtapa(etapa).at(-1) ?? null;
}

/** Punto central de una línea (para colocar la etiqueta del año) */
export function puntoMedio(puntos: LatLon[]): LatLon | null {
  return puntos[Math.floor(puntos.length / 2)] ?? null;
}

export function nivelVista(zoom: number): string {
  if (zoom < 7) return 'Península';
  if (zoom < ZOOM_DETALLE) return 'Región';
  if (zoom < 10) return 'Zona';
  if (zoom < 13) return 'Tramo';
  return 'Detalle';
}

/** Separación en píxeles para marcadores que caen en el mismo punto (como en el mock-up) */
const DESPLAZAMIENTOS: [number, number][] = [
  [-20, -20],
  [20, -20],
  [-20, 20],
  [20, 20],
  [0, -34],
  [0, 34],
];

/** Devuelve una función que asigna a cada punto un desplazamiento distinto si se repite */
export function separador() {
  const vistos = new Map<string, number>();
  return ([lat, lon]: LatLon): [number, number] => {
    const clave = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const n = vistos.get(clave) ?? 0;
    vistos.set(clave, n + 1);
    return DESPLAZAMIENTOS[n % DESPLAZAMIENTOS.length];
  };
}
