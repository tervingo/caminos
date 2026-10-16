import { createBrowserRouter } from 'react-router';
import { FotosPage } from './routes/FotosPage';
import { Home } from './routes/Home';
import { Layout } from './routes/Layout';
import { NotFound, RouteError } from './routes/NotFound';
import { TripPage } from './routes/TripPage';

// El editor solo lo usa el autor: se descarga aparte para no pesar en la web pública
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tramos/:slug', element: <TripPage /> },
      { path: 'tramos/:slug/fotos', element: <FotosPage /> },
      { path: 'admin/login', lazy: async () => ({ Component: (await import('./routes/admin/Login')).AdminLogin }) },
      {
        path: 'admin',
        lazy: async () => ({ Component: (await import('./routes/admin/RequiereAutor')).RequiereAutor }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('./routes/admin/AdminHome')).AdminHome }) },
          { path: 'tramos/:id', lazy: async () => ({ Component: (await import('./routes/admin/EditorTramo')).EditorTramo }) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
