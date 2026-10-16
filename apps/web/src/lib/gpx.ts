// Lectura de GPX en el navegador (DOMParser): tracks (trkseg/trkpt) y rutas (rte/rtept), GPX 1.0 o 1.1.
import type { LatLon } from './recorridoPie';

/** Cada segmento de track o ruta como lista de puntos [lat, lon] */
export function leerGpx(texto: string): LatLon[][] {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('No es un GPX válido');
  const puntos = (padre: Element, etiqueta: string): LatLon[] =>
    [...padre.getElementsByTagNameNS('*', etiqueta)].flatMap((p): LatLon[] => {
      const lat = Number(p.getAttribute('lat'));
      const lon = Number(p.getAttribute('lon'));
      return Number.isFinite(lat) && Number.isFinite(lon) ? [[lat, lon]] : [];
    });
  const segmentos = [
    ...[...doc.getElementsByTagNameNS('*', 'trkseg')].map((s) => puntos(s, 'trkpt')),
    ...[...doc.getElementsByTagNameNS('*', 'rte')].map((r) => puntos(r, 'rtept')),
  ].filter((s) => s.length >= 2);
  if (segmentos.length === 0) throw new Error('El GPX no tiene ningún track ni ruta');
  return segmentos;
}

/** Atribución si los ficheros parecen del CNIG / FEAACS (por su nombre o sus metadatos) */
export function pareceCnig(nombre: string, texto: string): boolean {
  // Los ficheros del CNIG se llaman «Camino Francés - ES01c-05a-puente-la-reina-estella»
  return /cnig|feaacs|ign\.es|^camin(o|ho)s? .+ - [a-z]{2}\d/i.test(nombre) || /cnig|feaacs|instituto geogr/i.test(texto.slice(0, 3000));
}

export const FUENTE_CNIG = '© FEAACS / CNIG (CC BY 4.0)';
