/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Plantilla de teselas, p. ej. https://tile.openstreetmap.org/{z}/{x}/{y}.png */
  readonly VITE_TILES_URL?: string;
  /** Atribución en HTML del proveedor de teselas */
  readonly VITE_TILES_ATTRIBUTION?: string;
}
