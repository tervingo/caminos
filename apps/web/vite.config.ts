import { Agent } from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El mapa y el editor se cargan aparte; sin esto, Vite reoptimiza al abrirlos por primera vez en desarrollo
  optimizeDeps: { include: ['leaflet', 'react-leaflet', 'react-hook-form', '@hookform/resolvers/zod', 'exifr'] },
  server: {
    port: 5173,
    proxy: {
      // Sin reutilizar conexiones: evita los ECONNRESET del proxy que dejaban peticiones colgadas
      '/api': { target: 'http://localhost:3000', agent: new Agent({ keepAlive: false }) },
    },
  },
});
