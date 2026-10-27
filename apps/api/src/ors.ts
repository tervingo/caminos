// Cliente de OpenRouteService: rutas por carretera (con desnivel) y buscador de localidades.
// La clave solo vive en el servidor.
import type { LugarGeo, PerfilRuta } from '@caminos/shared';
import { HttpError } from './errores.js';

type Coord = [number, number]; // [lon, lat]

type Coord3 = [number, number, number]; // [lon, lat, altitud]

export interface RutaCalculada {
  coordenadas: Coord[];
  /** Las mismas coordenadas con su altitud, para el perfil */
  conAltitud: Coord3[];
  metros: number;
  /** Desnivel acumulado, si el servicio lo devuelve */
  subida: number | null;
  bajada: number | null;
}

/** Punto de referencia para que salgan antes las localidades cercanas */
export interface Cerca {
  lat: number;
  lon: number;
}

/** Buscador de localidades por nombre y por punto */
export interface Buscador {
  buscar(texto: string, cerca?: Cerca): Promise<LugarGeo[]>;
  inverso(lat: number, lon: number): Promise<LugarGeo | null>;
}

export interface Ors extends Buscador {
  ruta(puntos: Coord[], perfil: PerfilRuta): Promise<RutaCalculada>;
  /** Altitud de cada punto de una línea (modelo del terreno) */
  altitudes(coords: Coord[]): Promise<Coord3[]>;
}

/** Puntos por petición que admite el servicio de altitudes */
const ALTITUDES_MAX = 2000;

const BASE = 'https://api.openrouteservice.org';
// Los Caminos de la península y su arranque en Francia
const PAISES = 'ESP,PRT,FRA,AND';

interface FeatureGeo {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; label?: string; locality?: string };
}

const aLugar = (f: FeatureGeo): LugarGeo => ({
  nombre: f.properties.locality ?? f.properties.name ?? f.properties.label ?? 'Sin nombre',
  etiqueta: f.properties.label ?? f.properties.name ?? '',
  lat: f.geometry.coordinates[1],
  lon: f.geometry.coordinates[0],
});

export function createOrs(apiKey: string | undefined, fetchFn: typeof fetch = fetch): Ors | undefined {
  if (!apiKey) return undefined;

  async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${BASE}${ruta}`, {
        ...init,
        headers: {
          Authorization: apiKey!,
          Accept: 'application/json, application/geo+json',
          'Accept-Language': 'es',
          ...init.headers,
        },
        // Por debajo de los 26 s a los que corta el proxy de Netlify; ORS a veces tarda bastante
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new HttpError(502, 'servicio-rutas', 'OpenRouteService no responde');
    }
    if (res.ok) return (await res.json()) as T;

    const cuerpo = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } | string } | null;
    // Cupo agotado: 403 «Quota exceeded» (diario) o 429 (por minuto)
    if (res.status === 403 || res.status === 429) {
      throw new HttpError(429, 'cupo-agotado', 'Se ha agotado el cupo de OpenRouteService; prueba más tarde', cuerpo?.error);
    }
    const error = typeof cuerpo?.error === 'object' ? cuerpo.error : undefined;
    // 2004: distancia excesiva; 2009/2010: sin carretera cerca de algún punto
    if (res.status === 404 || error?.code === 2010 || error?.code === 2009) {
      throw new HttpError(422, 'ruta-imposible', 'No hay una ruta por carretera entre esos puntos', error);
    }
    throw new HttpError(502, 'servicio-rutas', `Error de OpenRouteService (HTTP ${res.status})`, cuerpo?.error);
  }

  return {
    async ruta(puntos, perfil) {
      const datos = await pedir<{
        features: { geometry: { coordinates: number[][] }; properties: { summary?: { distance?: number }; ascent?: number; descent?: number } }[];
      }>(`/v2/directions/${perfil}/geojson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: puntos,
          elevation: true,
          instructions: false,
          // Las localidades no siempre caen sobre una carretera: se busca la más cercana en 5 km
          radiuses: puntos.map(() => 5000),
        }),
      });
      const ruta = datos.features[0];
      if (!ruta) throw new HttpError(422, 'ruta-imposible', 'No hay una ruta por carretera entre esos puntos');
      return {
        coordenadas: ruta.geometry.coordinates.map(([lon, lat]) => [lon, lat]),
        conAltitud: ruta.geometry.coordinates.map(([lon, lat, alt]) => [lon, lat, alt ?? 0]),
        metros: ruta.properties.summary?.distance ?? 0,
        subida: ruta.properties.ascent ?? null,
        bajada: ruta.properties.descent ?? null,
      };
    },

    async altitudes(coords) {
      const resultado: Coord3[] = [];
      for (let i = 0; i < coords.length; i += ALTITUDES_MAX) {
        const datos = await pedir<{ geometry: { coordinates: Coord3[] } }>('/elevation/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format_in: 'geojson',
            format_out: 'geojson',
            geometry: { type: 'LineString', coordinates: coords.slice(i, i + ALTITUDES_MAX) },
          }),
        });
        resultado.push(...datos.geometry.coordinates);
      }
      return resultado;
    },

    async buscar(texto, cerca) {
      const q = new URLSearchParams({ text: texto, size: '6', 'boundary.country': PAISES });
      if (cerca) {
        q.set('focus.point.lat', String(cerca.lat));
        q.set('focus.point.lon', String(cerca.lon));
      }
      const datos = await pedir<{ features: FeatureGeo[] }>(`/geocode/search?${q}`);
      return datos.features.map(aLugar);
    },

    async inverso(lat, lon) {
      // Solo poblaciones: el punto de una etapa se nombra por su pueblo, no por el bar de al lado
      const q = new URLSearchParams({
        'point.lat': String(lat),
        'point.lon': String(lon),
        size: '1',
        layers: 'locality,localadmin,borough,neighbourhood',
      });
      const datos = await pedir<{ features: FeatureGeo[] }>(`/geocode/reverse?${q}`);
      return datos.features[0] ? { ...aLugar(datos.features[0]), lat, lon } : null;
    },
  };
}
