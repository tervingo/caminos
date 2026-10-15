import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ApiError } from './lib/api';
import { router } from './router';
import './styles.css';

// Tras un despliegue, una pestaña abierta pide trozos de la versión anterior que ya no existen:
// se recarga una vez para traer la nueva (y no en bucle si el fallo es otro)
window.addEventListener('vite:preloadError', (evento) => {
  const ahora = Date.now();
  let ultima: number;
  try {
    ultima = Number(sessionStorage.getItem('caminos:recarga') ?? 0);
    sessionStorage.setItem('caminos:recarga', String(ahora));
  } catch {
    // Sin almacenamiento de sesión no hay forma de evitar el bucle: no se recarga
    return;
  }
  if (ahora - ultima > 10_000) {
    evento.preventDefault();
    window.location.reload();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      // Un 404 no se arregla reintentando
      retry: (fallos, error) => !(error instanceof ApiError && error.status < 500) && fallos < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
