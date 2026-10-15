// Marcadores divIcon con el aspecto del mock-up D.
import L from 'leaflet';

export type Capa = 'etapas' | 'dormir' | 'comer' | 'ver' | 'fotos' | 'otros';

export const CAPAS: { id: Capa; label: string; color: string }[] = [
  { id: 'etapas', label: 'Etapas', color: '#1E4D3A' },
  { id: 'dormir', label: 'Dormir', color: '#7AA7FF' },
  { id: 'comer', label: 'Comer', color: '#6FD08C' },
  { id: 'ver', label: 'Qué ver', color: '#FFC857' },
  { id: 'fotos', label: 'Fotos', color: '#F28DB2' },
  { id: 'otros', label: 'Otros años', color: '#B9B3A5' },
];

export const COLOR_CAPA = Object.fromEntries(CAPAS.map((c) => [c.id, c.color])) as Record<Capa, string>;

export const ACENTO = '#E2AE2D';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ESCAPES[c]);

interface Opciones {
  glifo: string;
  /** Nombre accesible del marcador */
  etiqueta: string;
  fondo: string;
  texto: string;
  activo?: boolean;
  /** Diámetro, o alto si es una pastilla */
  tam: number;
  /** Ancho de la pastilla; si falta, es un círculo */
  ancho?: number;
  /** Desplazamiento en píxeles respecto al punto */
  desplazamiento?: [number, number];
}

export function icono({ glifo, etiqueta, fondo, texto, activo = false, tam, ancho = tam, desplazamiento = [0, 0] }: Opciones) {
  const [dx, dy] = desplazamiento;
  return L.divIcon({
    className: 'marcador-mapa',
    iconSize: [ancho, tam],
    iconAnchor: [ancho / 2 - dx, tam / 2 - dy],
    popupAnchor: [dx, dy - tam / 2],
    html:
      `<span class="marcador-mapa__cuerpo" style="background:${fondo};color:${texto};border-color:${activo ? ACENTO : '#fff'}">` +
      `<span aria-hidden="true">${escapar(glifo)}</span><span class="sr-only">${escapar(etiqueta)}</span></span>`,
  });
}
