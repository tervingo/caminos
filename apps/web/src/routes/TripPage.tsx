import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { TramoDetalle } from '@caminos/shared';
import { MapaDiferido } from '../components/TripMap/MapaDiferido';
import type { Foco, Vista } from '../components/TripMap/tipos';
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
  const vista: Vista = params.get('vista') === 'peninsula' ? 'peninsula' : 'tramo';
  const { data: todos } = useTramos();
  const otros = (todos ?? []).filter((t) => t.slug !== tramo.slug);
  const [foco, setFoco] = useState<Foco | null>(null);

  const cambiarParams = (cambios: Record<string, string | null>) =>
    setParams(
      (actuales) => {
        const p = new URLSearchParams(actuales);
        for (const [nombre, valor] of Object.entries(cambios)) {
          if (valor === null) p.delete(nombre);
          else p.set(nombre, valor);
        }
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  // Elegir una etapa acerca el mapa a ella, así que deja de estar en la vista de península
  const elegirEtapa = (i: number | null) =>
    cambiarParams(i === null ? { etapa: null } : { etapa: String(i + 1), vista: null });
  const elegirVista = (v: Vista) => cambiarParams({ vista: v === 'tramo' ? null : v });
  const verEnMapa = (tipo: Foco['tipo'], id: string) => {
    setFoco((f) => ({ tipo, id, vez: (f?.vez ?? 0) + 1 }));
    document.getElementById('mapa')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const fechas = rangoFechas(tramo.fechaInicio, tramo.fechaFin);

  return (
    <>
      <title>{`${tramo.anio} · ${tramo.titulo} · En Caminos`}</title>
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
        {tramo.portada && (
          <figure className="mt-6 mb-0">
            <img
              src={tramo.portada.urlGrande}
              alt={tramo.portada.pie ?? `Portada del tramo de ${tramo.anio}`}
              width={tramo.portada.ancho}
              height={tramo.portada.alto}
              // Es lo primero que se ve: se pide con prioridad
              fetchPriority="high"
              className="block aspect-[21/9] max-h-[460px] w-full rounded-2xl bg-linea-suave object-cover"
            />
            {tramo.portada.pie && <figcaption className="mt-2 text-sm text-gris">{tramo.portada.pie}</figcaption>}
          </figure>
        )}
        {tramo.resumen && (
          <p className="mt-6 mb-0 max-w-[760px] font-serif text-[22px] leading-[1.4] text-pizarra sm:text-2xl">
            {tramo.resumen}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-start gap-6">
          <div id="etapas" className="min-w-0 flex-[1_1_340px] lg:max-w-[440px]">
            <h2 className={`m-0 mb-1 ${ROTULO} text-gris`}>Etapas</h2>
            <p className="mt-0 mb-2 text-sm text-gris">Toca una etapa para verla de cerca en el mapa.</p>
            <StageList etapas={tramo.etapas} fotos={tramo.fotos} ida={tramo.ida} vuelta={tramo.vuelta} elegida={elegida} onElegir={elegirEtapa} />
          </div>
          <div id="mapa" className="min-w-0 flex-[2_1_560px]">
            <MapaDiferido
              key={tramo.slug}
              tramo={tramo}
              otros={otros}
              etapa={elegida}
              onEtapa={elegirEtapa}
              vista={vista}
              onVista={elegirVista}
              foco={foco}
            />
          </div>
        </div>
      </section>

      <section id="galeria" className={`${CONTENEDOR} pt-14`}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={TITULO_SECCION}>Fotos de {tramo.anio}</h2>
          {tramo.fotos.length > 0 && <span className="text-[15px] text-gris">{tramo.fotos.length} fotos</span>}
        </div>
        <PhotoGrid fotos={tramo.fotos} anio={tramo.anio} onVerEnMapa={(id) => verEnMapa('foto', id)} />
      </section>

      <section id="lugares" className={`${CONTENEDOR} pt-16`}>
        <h2 className={`${TITULO_SECCION} mb-5`}>Dónde dormir y comer</h2>
        <PlaceCards lugares={tramo.lugares} etapas={tramo.etapas} fotos={tramo.fotos} onVerEnMapa={(id) => verEnMapa('lugar', id)} />
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
