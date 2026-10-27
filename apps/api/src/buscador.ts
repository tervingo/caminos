// Buscador de localidades: OpenRouteService y Nominatim (OpenStreetMap) a la vez, porque a cada uno
// le faltan pueblos que el otro tiene (ORS no conoce O Cebreiro). Nominatim exige identificarse, no más de una petición por segundo y no usarse para autocompletar:
// el editor solo busca al pulsar «Buscar».
import type { LugarGeo } from '@caminos/shared';
import { HttpError } from './errores.js';
import type { Buscador, Cerca } from './ors.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const AGENTE = 'NuestroCamino/1.0 (+https://encaminos.netlify.app)';
const PAISES = 'es,pt,fr,ad';

interface ResultadoNominatim {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

/** El pueblo o ciudad del resultado; si no lo hay, su nombre */
function nombreDe(r: ResultadoNominatim): string {
  const a = r.address ?? {};
  return r.name || a.village || a.town || a.city || a.hamlet || a.municipality || r.display_name.split(',')[0];
}

const aLugar = (r: ResultadoNominatim): LugarGeo => ({
  nombre: nombreDe(r),
  etiqueta: r.display_name,
  lat: Number(r.lat),
  lon: Number(r.lon),
});

export function createNominatim(fetchFn: typeof fetch = fetch): Buscador {
  async function pedir<T>(ruta: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${NOMINATIM}${ruta}`, {
        headers: { 'User-Agent': AGENTE, Accept: 'application/json', 'Accept-Language': 'es' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new HttpError(502, 'buscador', 'El buscador de localidades no responde');
    }
    if (res.status === 429) throw new HttpError(429, 'cupo-agotado', 'Demasiadas búsquedas seguidas; espera unos segundos');
    if (!res.ok) throw new HttpError(502, 'buscador', `Error del buscador de localidades (HTTP ${res.status})`);
    return (await res.json()) as T;
  }

  return {
    async buscar(texto, cerca) {
      const q = new URLSearchParams({ q: texto, format: 'jsonv2', limit: '6', countrycodes: PAISES, addressdetails: '1' });
      // Un recuadro de ~1° alrededor del punto: no excluye nada (bounded=0), solo da preferencia a lo de dentro
      if (cerca) q.set('viewbox', [cerca.lon - 1, cerca.lat + 1, cerca.lon + 1, cerca.lat - 1].join(','));
      return (await pedir<ResultadoNominatim[]>(`/search?${q}`)).map(aLugar);
    },
    async inverso(lat, lon) {
      // zoom 14: nivel de pueblo o barrio, no de calle
      const q = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', zoom: '14', addressdetails: '1' });
      const r = await pedir<ResultadoNominatim & { error?: string }>(`/reverse?${q}`);
      if (r.error) return null;
      const a = r.address ?? {};
      const nombre = a.village || a.town || a.city || a.hamlet || a.municipality || nombreDe(r);
      return { nombre, etiqueta: r.display_name, lat, lon };
    },
  };
}

const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros entre dos puntos */
export function metrosEntre(a: Cerca, b: Cerca): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Dos resultados son el mismo sitio si están muy cerca, o algo menos si se llaman igual (el municipio y su pueblo) */
const MISMO_SITIO_M = 1500;
const MISMO_NOMBRE_M = 5000;
const mismoSitio = (a: LugarGeo, b: LugarGeo) => {
  const m = metrosEntre(a, b);
  return m < MISMO_SITIO_M || (m < MISMO_NOMBRE_M && a.nombre.toLowerCase() === b.nombre.toLowerCase());
};
const MAX_RESULTADOS = 8;

/**
 * Busca en los dos a la vez y junta los resultados sin repetir sitios; con un punto de referencia,
 * los ordena por cercanía. Solo falla si fallan los dos. El inverso usa el principal y, si se agota
 * su cupo o falla el servicio, el otro.
 */
export function combinar(principal: Buscador | undefined, otro: Buscador): Buscador {
  if (!principal) return otro;
  return {
    async buscar(texto, cerca) {
      const respuestas = await Promise.allSettled([principal.buscar(texto, cerca), otro.buscar(texto, cerca)]);
      const listas = respuestas.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      if (listas.length === 0) throw (respuestas[0] as PromiseRejectedResult).reason;
      const juntos: LugarGeo[] = [];
      for (const lugar of listas.flat()) if (!juntos.some((l) => mismoSitio(l, lugar))) juntos.push(lugar);
      if (cerca) juntos.sort((a, b) => metrosEntre(cerca, a) - metrosEntre(cerca, b));
      return juntos.slice(0, MAX_RESULTADOS);
    },
    async inverso(lat, lon) {
      try {
        return await principal.inverso(lat, lon);
      } catch (err) {
        if (err instanceof HttpError && err.statusCode >= 429) return otro.inverso(lat, lon);
        throw err;
      }
    },
  };
}
