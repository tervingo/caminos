// Perfil de altitud de una etapa a partir de su línea con altitud ([lon, lat, altitud]).
// Lo usan el navegador (altitudes de un GPX) y el servidor (altitudes del terreno de ORS).
import type { OrigenPerfil, Perfil } from './index.js';

type Coord3 = [number, number, number];

const R = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;
function metros([lon1, lat1]: Coord3, [lon2, lat2]: Coord3): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Variaciones menores que esto no suman desnivel (ruido del modelo de altitud) */
const UMBRAL_M = 3;
/** Puntos que se guardan: de sobra para dibujar el perfil y moverse por él */
const PUNTOS_MAX = 300;

/** Subida y bajada acumuladas con histéresis: solo cuentan los cambios que superan el umbral */
export function desniveles(altitudes: number[], umbral = UMBRAL_M): { subida: number; bajada: number } {
  let subida = 0;
  let bajada = 0;
  let referencia = altitudes[0] ?? 0;
  for (const a of altitudes) {
    const d = a - referencia;
    if (d >= umbral) {
      subida += d;
      referencia = a;
    } else if (d <= -umbral) {
      bajada -= d;
      referencia = a;
    }
  }
  return { subida: Math.round(subida), bajada: Math.round(bajada) };
}

export function perfilDe(coords: Coord3[], origen: OrigenPerfil = 'terreno'): Perfil | null {
  if (coords.length < 2) return null;
  const km: number[] = [0];
  for (let i = 1; i < coords.length; i++) km.push(km[i - 1] + metros(coords[i - 1], coords[i]) / 1000);
  const total = km.at(-1)!;
  if (total === 0) return null;

  // Muestreo a distancia constante (más puntos donde la línea es más densa no aportan al dibujo)
  const n = Math.min(PUNTOS_MAX, coords.length);
  const puntos: Perfil['puntos'] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const objetivo = (total * k) / (n - 1);
    while (j < km.length - 1 && km[j + 1] <= objetivo) j++;
    const [lon, lat, alt] = coords[j];
    puntos.push([Math.round(km[j] * 1000) / 1000, Math.round(alt), lat, lon]);
  }
  puntos[puntos.length - 1] = [Math.round(total * 1000) / 1000, Math.round(coords.at(-1)![2]), coords.at(-1)![1], coords.at(-1)![0]];

  const altitudes = coords.map((c) => c[2]);
  return {
    origen,
    puntos,
    ...desniveles(altitudes),
    minima: Math.round(Math.min(...altitudes)),
    maxima: Math.round(Math.max(...altitudes)),
  };
}
