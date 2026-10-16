import { type KeyboardEvent, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Foto, TramoDetalle } from '@caminos/shared';
import { PhotoGrid } from '../components/PhotoGrid';
import { Aviso, CONTENEDOR } from '../components/ui';
import { ApiError } from '../lib/api';
import { useTramo } from '../lib/consultas';
import { fotosPorEtapa } from '../lib/fotosTramo';
import { NotFound } from './NotFound';

export function FotosPage() {
  const { slug = '' } = useParams();
  const { data: tramo, isPending, error } = useTramo(slug);

  if (isPending) return <div className={`${CONTENEDOR} pt-12 text-gris`}>Cargando las fotos…</div>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFound mensaje="No existe ese tramo." />;
    return (
      <div className={`${CONTENEDOR} pt-12`}>
        <Aviso>No se pudieron cargar las fotos. Prueba a recargar la página en un rato.</Aviso>
      </div>
    );
  }
  return <Fotos tramo={tramo} />;
}

interface Pestana {
  /** Valor en la URL: el número de la etapa o «otras» */
  clave: string;
  titulo: string;
  fotos: Foto[];
}

function Fotos({ tramo }: { tramo: TramoDetalle }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pestanasRef = useRef<HTMLDivElement>(null);

  const { etapas, otras } = fotosPorEtapa(tramo.etapas, tramo.fotos);
  const pestanas: Pestana[] = [
    ...etapas.map((e) => ({ clave: String(e.numero), titulo: `${e.numero} · ${e.etapa.titulo}`, fotos: e.fotos })),
    ...(otras.length > 0 ? [{ clave: 'otras', titulo: 'Otras', fotos: otras }] : []),
  ];
  // Sin etapa en la URL, la primera pestaña que tenga fotos
  const pedida = pestanas.find((p) => p.clave === params.get('etapa'));
  const actual = pedida ?? pestanas.find((p) => p.fotos.length > 0) ?? pestanas[0];

  const elegir = (clave: string) => setParams({ etapa: clave }, { replace: true, preventScrollReset: true });

  // Flechas izquierda y derecha entre pestañas, como en cualquier lista de pestañas
  const teclado = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = pestanas.indexOf(actual) + (e.key === 'ArrowRight' ? 1 : -1);
    const siguiente = pestanas[(i + pestanas.length) % pestanas.length];
    elegir(siguiente.clave);
    pestanasRef.current?.querySelector<HTMLButtonElement>(`[data-clave="${siguiente.clave}"]`)?.focus();
  };

  return (
    <div className={`${CONTENEDOR} pt-8`}>
      <title>{`Fotos de ${tramo.anio} · ${tramo.titulo} · En Caminos`}</title>
      <Link to={`/tramos/${tramo.slug}`} className="text-sm font-semibold text-bosque">
        ← {tramo.anio} · {tramo.titulo}
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="m-0 font-serif text-[38px] leading-tight font-medium sm:text-[44px]">Fotos de {tramo.anio}</h1>
        <span className="text-[15px] text-gris">{tramo.fotos.length} fotos</span>
      </div>

      {tramo.fotos.length === 0 ? (
        <Aviso>Aún no hay fotos de {tramo.anio}.</Aviso>
      ) : (
        <>
          <div
            ref={pestanasRef}
            role="tablist"
            aria-label="Etapas"
            onKeyDown={teclado}
            className="-mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-linea px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {pestanas.map((p) => {
              const activa = p === actual;
              return (
                <button
                  key={p.clave}
                  type="button"
                  role="tab"
                  id={`pestana-${p.clave}`}
                  data-clave={p.clave}
                  aria-selected={activa}
                  aria-controls="panel-fotos"
                  tabIndex={activa ? 0 : -1}
                  onClick={() => elegir(p.clave)}
                  className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
                    activa ? 'border-tinta bg-tinta text-white' : 'border-linea bg-white text-tinta hover:border-borde'
                  } ${p.fotos.length === 0 ? 'opacity-60' : ''}`}
                >
                  {p.titulo}
                  <span className={`rounded-full px-2 text-xs ${activa ? 'bg-white/20' : 'bg-linea-suave'}`}>{p.fotos.length}</span>
                </button>
              );
            })}
          </div>

          <div id="panel-fotos" role="tabpanel" aria-labelledby={`pestana-${actual.clave}`}>
            {actual.fotos.length === 0 ? (
              <p className="m-0 text-musgo">No hay fotos de esta etapa.</p>
            ) : (
              <PhotoGrid
                // Al cambiar de pestaña se cierra el visor y empieza de cero
                key={actual.clave}
                fotos={actual.fotos}
                anio={tramo.anio}
                uniforme
                onVerEnMapa={(id) => navigate(`/tramos/${tramo.slug}?${new URLSearchParams({ foto: id })}`)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
