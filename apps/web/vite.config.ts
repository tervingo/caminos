import { Agent } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // La caché de dependencias va fuera de Dropbox: dentro, Dropbox o el antivirus bloquean la carpeta
  // mientras Vite la renombra (EBUSY) y la web de desarrollo sale en blanco
  cacheDir: join(tmpdir(), 'caminos-vite'),
  // El mapa y el editor se cargan aparte; sin esto, Vite reoptimiza al abrirlos por primera vez en desarrollo
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet', 'react-hook-form', '@hookform/resolvers/zod', 'exifr', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },
  server: {
    port: 5173,
    proxy: {
      // Sin reutilizar conexiones: evita los ECONNRESET del proxy que dejaban peticiones colgadas
      '/api': { target: 'http://localhost:3000', agent: new Agent({ keepAlive: false }) },
    },
  },
});
