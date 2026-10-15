import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { CONTENEDOR } from '../components/ui';

export function NotFound({ mensaje = 'No encontramos esa página.' }: { mensaje?: string }) {
  return (
    <section className={`${CONTENEDOR} py-24`}>
      <title>Página no encontrada · Nuestro Camino</title>
      <p className="text-[13px] font-semibold uppercase tracking-[.12em] text-bosque">Fuera del camino</p>
      <h1 className="mt-4 mb-6 font-serif text-5xl font-medium">{mensaje}</h1>
      <Link to="/" className="font-semibold text-bosque">
        ← Volver a los años
      </Link>
    </section>
  );
}

/** Para errores inesperados al pintar una ruta */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return <NotFound mensaje="Algo ha fallado al cargar la página." />;
}
