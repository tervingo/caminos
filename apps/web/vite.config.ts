import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El mapa se carga de forma diferida; sin esto, Vite reoptimiza al abrirlo por primera vez en desarrollo
  optimizeDeps: { include: ['leaflet', 'react-leaflet'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
