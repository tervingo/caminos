import { Link, useParams, useSearchParams } from 'react-router';
import type { TramoDetalle } from '@caminos/shared';
import { NoteList } from '../components/NoteList';
import { PhotoGrid } from '../components/PhotoGrid';
import { PlaceCards } from '../components/PlaceCards';
import { StageList } from '../components/StageList';
import { Aviso, Cifra, CONTENEDOR, PuntoCamino, ROTULO, TITULO_SECCION } from '../components/ui';
import { ApiError } from '../lib/api';
import { useTramo, useTramos } from '../lib/consultas';
import { desnivel, numeroKm, rangoFechas } from '../lib/formato';
import { NotFound } from './NotFound';

export function TripPage() {
  const { slug = '' } = useParams();
  const { data: tramo, isPending, error } = useTramo(slug);

  if (isPending) {
    return (
      <div className={`${CONTENEDOR} pt-12`} aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-linea-suave" />
        <div className="mt-4 h-14 w-3/4 animate-pulse rounded bg-linea-suave" />
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-linea-suave" />
      </div>
    );
  }
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFound mensaje="No existe ese tramo." />;
    return (
      <div className={`${CONTENEDOR} pt-12`}>
        <Aviso>No se pudo cargar el tramo. Prueba a recargar la página en un rato.</Aviso>
      </div>
    );
  }
  return <Tramo tramo={tramo} />;
}

function Tramo({ tramo }: { tramo: TramoDetalle }) {
  const [params, setParams] = useSearchParams();
  const n = Number(params.get('etapa'));
  const elegida = Number.isInteger(n) && n >= 1 && n <= tramo.etapas.length ? n - 1 : null;
  const elegirEtapa = (i: number | null) =>
    setParams(
      (actuales) => {
        const p = new URLSearchParams(actuales);
        if (i === null) p.delete('etapa');
        else p.set('etapa', String(i + 1));
        return p;
      },
      { replace: true, preventScrollReset: true },
    );

  const fechas = rangoFechas(tramo.fechaInicio, tramo.fechaFin);

  return (
    <>
      <title>{`${tramo.anio} · ${tramo.titulo} · Nuestro Camino`}</title>
      <section className={`${CONTENEDOR} pt-10`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-[1_1_480px]">
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.1em] text-bosque">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white py-0.5 pr-3 pl-2">
                <PuntoCamino color={tramo.camino.color} />
                {tramo.camino.nombre}
              </span>
              {fechas && <span>{fechas}</span>}
            </div>
            <h1 className="mt-2.5 mb-0 font-serif text-[38px] leading-[1.05] font-medium tracking-[-.01em] sm:text-[52px]">
              {tramo.anio} · {tramo.titulo}
            </h1>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-9">
            <Cifra valor={numeroKm(tramo.kmTotal)} etiqueta="kilómetros" />
            <Cifra valor={tramo.numEtapas} etiqueta={tramo.numEtapas === 1 ? 'etapa' : 'etapas'} />
            <Cifra valor={tramo.desnivelPosTotal > 0 ? desnivel(tramo.desnivelPosTotal) : '—'} etiqueta="desnivel +" />
          </div>
        </div>
        {tramo.resumen && (
          <p className="mt-6 mb-0 max-w-[760px] font-serif text-[22px] leading-[1.4] text-pizarra sm:text-2xl">
            {tramo.resumen}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-start gap-6">
          <div id="etapas" className="min-w-0 flex-[1_1_340px] lg:max-w-[440px]">
            <h2 className={`m-0 mb-3 ${ROTULO} text-gris`}>Etapas</h2>
            <StageList etapas={tramo.etapas} elegida={elegida} onElegir={elegirEtapa} />
          </div>
          <div id="mapa" className="min-w-0 flex-[2_1_560px]">
            <div className="flex aspect-[900/560] items-center justify-center rounded-2xl border border-[#8FB5C2] bg-agua p-6 text-center">
              <p className="m-0 max-w-xs rounded-xl bg-white/90 px-4 py-3 text-sm text-musgo">
                Aquí irá el mapa del tramo, con sus etapas, lugares y fotos.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="galeria" className={`${CONTENEDOR} pt-14`}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={TITULO_SECCION}>Fotos de {tramo.anio}</h2>
          {tramo.fotos.length > 0 && <span className="text-[15px] text-gris">{tramo.fotos.length} fotos</span>}
        </div>
        <PhotoGrid fotos={tramo.fotos} anio={tramo.anio} />
      </section>

      <section id="lugares" className={`${CONTENEDOR} pt-16`}>
        <h2 className={`${TITULO_SECCION} mb-5`}>Dónde dormir, comer y qué ver</h2>
        <PlaceCards lugares={tramo.lugares} />
      </section>

      <section id="notas" className={`${CONTENEDOR} pt-16`}>
        <h2 className={`${TITULO_SECCION} mb-5`}>Notas del año</h2>
        <NoteList notas={tramo.notas} />
      </section>

      <OtrosAnios slug={tramo.slug} />
    </>
  );
}

/** Enlaces al año anterior y al siguiente */
function OtrosAnios({ slug }: { slug: string }) {
  const { data } = useTramos();
  if (!data) return null;
  const orden = [...data].sort((a, b) => a.anio - b.anio || a.slug.localeCompare(b.slug));
  const i = orden.findIndex((t) => t.slug === slug);
  if (i < 0) return null;
  const anterior = orden[i - 1];
  const siguiente = orden[i + 1];
  if (!anterior && !siguiente) return null;

  return (
    <nav aria-label="Otros años" className={`${CONTENEDOR} pt-16`}>
      <div className="flex flex-wrap justify-between gap-4 border-t border-tinta pt-6">
        {anterior ? (
          <Link to={`/tramos/${anterior.slug}`} className="group">
            <span className="block text-sm text-gris">← Año anterior</span>
            <span className="font-serif text-2xl font-semibold group-hover:underline">
              {anterior.anio} · {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {siguiente && (
          <Link to={`/tramos/${siguiente.slug}`} className="group text-right">
            <span className="block text-sm text-gris">Año siguiente →</span>
            <span className="font-serif text-2xl font-semibold group-hover:underline">
              {siguiente.anio} · {siguiente.titulo}
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
