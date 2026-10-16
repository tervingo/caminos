import { Link, Outlet, ScrollRestoration, useMatch } from 'react-router';
import { CONTENEDOR } from '../components/ui';
import { pareceAutor } from '../lib/admin';

const ANCLAS_TRAMO = [
  { href: '#etapas', label: 'Etapas' },
  { href: '#mapa', label: 'Mapa' },
  { href: '#galeria', label: 'Fotos' },
  { href: '#lugares', label: 'Lugares' },
  { href: '#notas', label: 'Notas' },
];

export function Layout() {
  const enTramo = useMatch('/tramos/:slug') !== null;
  const enAdmin = useMatch('/admin/*') !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-linea">
        <div className={`${CONTENEDOR} flex flex-wrap items-center justify-between gap-4 py-[18px]`}>
          <Link to="/" className="flex items-center gap-3 hover:no-underline">
            <img src="/img/logo.png" alt="" width={80} height={52} className="h-[52px] w-auto" />
            <span className="font-serif text-2xl font-semibold">En Caminos</span>
            <img
              src="/img/en-santiago.webp"
              alt="El grupo ante la catedral de Santiago"
              width={75}
              height={100}
              className="h-[72px] w-auto rounded-lg object-cover sm:h-[100px]"
            />
          </Link>
          <nav aria-label="Principal" className="flex flex-wrap gap-x-7 gap-y-2 text-[15px] font-medium">
            <Link to="/#anos">Los años</Link>
            {enTramo &&
              ANCLAS_TRAMO.map((a) => (
                <a key={a.href} href={a.href}>
                  {a.label}
                </a>
              ))}
          </nav>
          {/* Solo lo ve quien ya ha entrado alguna vez como autor en este navegador */}
          {pareceAutor() && !enAdmin && (
            <Link
              to="/admin"
              className="inline-flex min-h-11 items-center rounded-full border-2 border-tinta px-5 text-[15px] font-semibold hover:bg-tinta hover:text-white hover:no-underline"
            >
              Modo editor
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-linea">
        <div className={`${CONTENEDOR} py-6 text-[13px] text-gris`}>
          En Caminos · un tramo del Camino de Santiago cada año, contado por el grupo.{' '}
          <Link to="/admin" className="text-gris underline-offset-2">
            Acceso del autor
          </Link>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
