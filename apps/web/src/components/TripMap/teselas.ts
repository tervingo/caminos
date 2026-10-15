// Proveedor de teselas, configurable sin tocar código (VITE_TILES_URL y VITE_TILES_ATTRIBUTION).
export const TESELAS = import.meta.env.VITE_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATRIBUCION =
  import.meta.env.VITE_TILES_ATTRIBUTION ||
  '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>';
