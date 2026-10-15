import { createBrowserRouter } from 'react-router';
import { Home } from './routes/Home';
import { Layout } from './routes/Layout';
import { NotFound, RouteError } from './routes/NotFound';
import { TripPage } from './routes/TripPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tramos/:slug', element: <TripPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
