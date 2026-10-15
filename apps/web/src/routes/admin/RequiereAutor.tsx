import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { Aviso, CONTENEDOR } from '../../components/ui';
import { Boton } from '../../features/admin/ui';
import { useLogout, useSesion } from '../../lib/admin';

/** Envuelve las páginas del editor: sin sesión, lleva al acceso y luego vuelve aquí */
export function RequiereAutor() {
  const sesion = useSesion();
  const logout = useLogout();
  const { pathname } = useLocation();

  if (sesion.isPending) return <div className={`${CONTENEDOR} pt-12 text-gris`}>Comprobando la sesión…</div>;
  if (sesion.isError) {
    return (
      <div className={`${CONTENEDOR} pt-12`}>
        <Aviso>No se pudo comprobar la sesión. Prueba a recargar la página.</Aviso>
      </div>
    );
  }
  if (!sesion.data) return <Navigate to={`/admin/login?${new URLSearchParams({ volver: pathname })}`} replace />;

  return (
    <>
      <div className="bg-tinta text-white">
        <div className={`${CONTENEDOR} flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm`}>
          <span>
            <Link to="/admin" className="font-semibold">
              Modo editor
            </Link>
            <span className="text-[#BFD0C6]"> · {sesion.data.email}</span>
          </span>
          <Boton variante="sutil" className="min-h-9! text-white!" onClick={() => logout.mutate()}>
            Cerrar sesión
          </Boton>
        </div>
      </div>
      <Outlet />
    </>
  );
}
