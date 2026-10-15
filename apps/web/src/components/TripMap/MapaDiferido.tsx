import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { TripMapProps } from './tipos';

const TripMap = lazy(() => import('./TripMap'));

/** Carga Leaflet y el mapa solo cuando el hueco se acerca a la pantalla */
export function MapaDiferido(props: TripMapProps) {
  const hueco = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const el = hueco.current;
    if (!el || cerca) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setCerca(true);
          observador.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [cerca]);

  // Un foco pedido desde fuera (Ver en el mapa) carga el mapa aunque no esté cerca
  const cargar = cerca || props.foco !== null;

  return (
    <div ref={hueco}>
      {cargar ? (
        <Suspense fallback={<Hueco />}>
          <TripMap {...props} />
        </Suspense>
      ) : (
        <Hueco />
      )}
    </div>
  );
}

function Hueco() {
  return (
    <div className="pt-[56px]">
      <div className="flex aspect-[900/560] min-h-[360px] items-center justify-center rounded-2xl border border-[#8FB5C2] bg-agua">
        <span className="rounded-full bg-white/90 px-4 py-2 text-sm text-musgo">Cargando el mapa…</span>
      </div>
    </div>
  );
}
