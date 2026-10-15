import { Link, Outlet, ScrollRestoration, useMatch } from 'react-router';
import { Logo } from '../components/Logo';
import { CONTENEDOR } from '../components/ui';

const ANCLAS_TRAMO = [
  { href: '#etapas', label: 'Etapas' },
  { href: '#mapa', label: 'Mapa' },
  { href: '#galeria', label: 'Fotos' },
  { href: '#lugares', label: 'Lugares' },
  { href: '#notas', label: 'Notas' },
];

export function Layout() {
  const enTramo = useMatch('/tramos/:slug') !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-linea">
        <div className={`${CONTENEDOR} flex flex-wrap items-center justify-between gap-4 py-[18px]`}>
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-serif text-2xl font-semibold">Nuestro Camino</span>
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
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-linea">
        <div className={`${CONTENEDOR} py-6 text-[13px] text-gris`}>
          Nuestro Camino · un tramo del Camino de Santiago cada año, contado por el grupo.
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
