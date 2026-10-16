import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { CONTENEDOR } from '../components/ui';

export function NotFound({ mensaje = 'No encontramos esa página.' }: { mensaje?: string }) {
  return (
    <section className={`${CONTENEDOR} py-24`}>
      <title>Página no encontrada · En Caminos</title>
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
  // Un trozo de la web que no carga suele ser una versión nueva publicada con la página abierta
  if (error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message)) {
    return (
      <section className={`${CONTENEDOR} py-24`}>
        <title>Versión nueva · En Caminos</title>
        <p className="text-[13px] font-semibold uppercase tracking-[.12em] text-bosque">Versión nueva</p>
        <h1 className="mt-4 mb-6 font-serif text-5xl font-medium">Hay una versión nueva de la web.</h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 cursor-pointer rounded-full border-2 border-tinta bg-tinta px-5 text-sm font-semibold text-white"
        >
          Recargar
        </button>
      </section>
    );
  }
  return <NotFound mensaje="Algo ha fallado al cargar la página." />;
}
