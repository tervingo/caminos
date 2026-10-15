// Buscador de localidades: OpenRouteService y, si falla o se agota su cupo, Nominatim (OpenStreetMap).
// Nominatim exige identificarse, no más de una petición por segundo y no usarse para autocompletar:
// el editor solo busca al pulsar «Buscar».
import type { LugarGeo } from '@caminos/shared';
import { HttpError } from './errores.js';
import type { Buscador } from './ors.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const AGENTE = 'NuestroCamino/1.0 (+https://santiagos.netlify.app)';
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
    async buscar(texto) {
      const q = new URLSearchParams({ q: texto, format: 'jsonv2', limit: '6', countrycodes: PAISES, addressdetails: '1' });
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

/** Usa el principal y, si falla por cupo o error del servicio, el de respaldo */
export function conRespaldo(principal: Buscador | undefined, respaldo: Buscador): Buscador {
  if (!principal) return respaldo;
  const probar = async <T>(uno: () => Promise<T>, otro: () => Promise<T>): Promise<T> => {
    try {
      return await uno();
    } catch (err) {
      if (err instanceof HttpError && err.statusCode >= 429) return otro();
      throw err;
    }
  };
  return {
    buscar: (texto) => probar(() => principal.buscar(texto), () => respaldo.buscar(texto)),
    inverso: (lat, lon) => probar(() => principal.inverso(lat, lon), () => respaldo.inverso(lat, lon)),
  };
}
