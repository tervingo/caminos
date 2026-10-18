// Tipos del mapa, aparte para no arrastrar Leaflet al paquete principal.
import type { TramoDetalle, TramoResumen } from '@caminos/shared';

export type Vista = 'peninsula' | 'tramo';

/** Elemento que hay que enseñar en el mapa; `vez` cambia en cada petición para repetir la misma */
export interface Foco {
  tipo: 'lugar' | 'foto';
  id: string;
  vez: number;
}

export interface TripMapProps {
  tramo: TramoDetalle;
  /** Los demás tramos publicados, con su ruta resumida */
  otros: TramoResumen[];
  /** Índice de la etapa elegida */
  etapa: number | null;
  onEtapa: (indice: number | null) => void;
  /** Vista con la que se abre el mapa */
  vista: Vista;
  onVista: (vista: Vista) => void;
  foco: Foco | null;
  /** Punto que se señala en el mapa (p. ej. el que se recorre en el perfil de altitud) */
  marcador?: [number, number] | null;
}
