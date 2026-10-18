import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { TramoDetalle } from '@caminos/shared';
import { NoteList } from '../components/NoteList';
import { PerfilEtapa } from '../components/PerfilEtapa';
import { PhotoGrid } from '../components/PhotoGrid';
import { PlaceCards } from '../components/PlaceCards';
import { MapaDiferido } from '../components/TripMap/MapaDiferido';
import type { Foco } from '../components/TripMap/tipos';
import { Aviso, Cifra, CONTENEDOR, PuntoCamino, TITULO_SECCION } from '../components/ui';
import { ApiError } from '../lib/api';
import { useTramo } from '../lib/consultas';
import { fechaLarga, numeroKm, plural } from '../lib/formato';
import { NotFound } from './NotFound';

/** Ficha completa de una etapa: /tramos/:slug/etapas/:numero */
export function EtapaPage() {
  const { slug = '', numero = '' } = useParams();
  const { data: tramo, isPending, error } = useTramo(slug);

  if (isPending) return <div className={`${CONTENEDOR} pt-12 text-gris`}>Cargando la etapa…</div>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFound mensaje="No existe ese tramo." />;
    return (
      <div className={`${CONTENEDOR} pt-12`}>
        <Aviso>No se pudo cargar la etapa. Prueba a recargar la página en un rato.</Aviso>
      </div>
    );
  }
  const indice = Number(numero) - 1;
  if (!Number.isInteger(indice) || !tramo.etapas[indice]) return <NotFound mensaje="No existe esa etapa." />;
  // Una ficha nueva por etapa: el mapa vuelve a encuadrar y el foco empieza de cero
  return <Ficha key={tramo.etapas[indice].id} tramo={tramo} indice={indice} />;
}

function Ficha({ tramo, indice }: { tramo: TramoDetalle; indice: number }) {
  const navigate = useNavigate();
  const etapa = tramo.etapas[indice];
  const numero = indice + 1;
  const [foco, setFoco] = useState<Foco | null>(null);
  // Punto del perfil bajo el cursor, que se señala también en el mapa
  const [punto, setPunto] = useState<[number, number] | null>(null);
  const verEnMapa = (tipo: Foco['tipo'], id: string) => {
    setFoco((f) => ({ tipo, id, vez: (f?.vez ?? 0) + 1 }));
    document.getElementById('mapa')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const lugares = tramo.lugares.filter((l) => l.etapaId === etapa.id);
  const fotos = tramo.fotos.filter((f) => f.etapaId === etapa.id);
  const notas = tramo.notas.filter((n) => n.etapaId === etapa.id);
  const anterior = tramo.etapas[indice - 1];
  const siguiente = tramo.etapas[indice + 1];
  const enlace = (n: number) => `/tramos/${tramo.slug}/etapas/${n}`;

  return (
    <>
      <title>{`Etapa ${numero} · ${etapa.titulo} · ${tramo.anio} · En Caminos`}</title>
      <section className={`${CONTENEDOR} pt-8`}>
        <Link to={`/tramos/${tramo.slug}`} className="text-sm font-semibold text-bosque">
          ← {tramo.anio} · {tramo.titulo}
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-[1_1_480px]">
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.1em] text-bosque">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white py-0.5 pr-3 pl-2">
                <PuntoCamino color={tramo.camino.color} />
                Etapa {numero} de {tramo.etapas.length}
              </span>
              {etapa.fecha && <span>{fechaLarga(etapa.fecha)}</span>}
            </div>
            <h1 className="mt-2.5 mb-0 font-serif text-[36px] leading-[1.05] font-medium tracking-[-.01em] sm:text-[48px]">{etapa.titulo}</h1>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-9">
            {etapa.kmPie !== null && <Cifra valor={numeroKm(etapa.kmPie)} etiqueta="km a pie" />}
            {etapa.km !== null && <Cifra valor={numeroKm(etapa.km)} etiqueta={etapa.kmPie !== null ? 'km por carretera' : 'kilómetros'} />}
          </div>
        </div>
        {etapa.notas && (
          <p className="mt-6 mb-0 max-w-[760px] font-serif text-[21px] leading-[1.45] text-pizarra sm:text-[22px]">{etapa.notas}</p>
        )}

        <div id="mapa" className="mt-8">
          <MapaDiferido
            tramo={tramo}
            otros={[]}
            etapa={indice}
            // Pulsar otra etapa en el mapa lleva a su ficha
            onEtapa={(j) => j !== null && j !== indice && navigate(enlace(j + 1))}
            vista="tramo"
            onVista={() => {}}
            foco={foco}
            marcador={punto}
          />
        </div>

        {etapa.perfil && (
          <div id="perfil" className="mt-10">
            <h2 className={`${TITULO_SECCION} mb-3`}>Perfil de la etapa</h2>
            <PerfilEtapa
              perfil={etapa.perfil}
              marcas={[
                ...(etapa.origen ? [{ nombre: etapa.origen.nombre ?? 'Inicio', lat: etapa.origen.lat, lon: etapa.origen.lon }] : []),
                ...etapa.sitios.map((s) => ({ nombre: s.nombre, lat: s.lat, lon: s.lon })),
                ...(etapa.destino ? [{ nombre: etapa.destino.nombre ?? 'Final', lat: etapa.destino.lat, lon: etapa.destino.lon }] : []),
              ]}
              onPunto={setPunto}
            />
          </div>
        )}
      </section>

      {etapa.sitios.length > 0 && (
        <section id="sitios" className={`${CONTENEDOR} pt-14`}>
          <h2 className={`${TITULO_SECCION} mb-5`}>★ Sitios de interés</h2>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {etapa.sitios.map((s, j) => {
              const foto = s.fotoId ? tramo.fotos.find((f) => f.id === s.fotoId) : undefined;
              return (
                <li key={j} className="overflow-hidden rounded-[14px] border border-t-4 border-linea border-t-ocre bg-white">
                  {foto && <img src={foto.urlMini} alt={foto.pie ?? s.nombre} loading="lazy" className="aspect-[3/2] w-full object-cover" />}
                  <div className="p-4">
                    <div className="font-semibold">{s.nombre}</div>
                    {s.localidad && <div className="text-sm text-gris">{s.localidad}</div>}
                    {s.nota && <p className="mt-1.5 mb-0 text-sm text-musgo">{s.nota}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {lugares.length > 0 && (
        <section id="lugares" className={`${CONTENEDOR} pt-14`}>
          <h2 className={`${TITULO_SECCION} mb-5`}>Dónde dormir y comer</h2>
          <PlaceCards lugares={lugares} etapas={tramo.etapas} fotos={tramo.fotos} conEtapa={false} onVerEnMapa={(id) => verEnMapa('lugar', id)} />
        </section>
      )}

      {notas.length > 0 && (
        <section id="notas" className={`${CONTENEDOR} pt-14`}>
          <h2 className={`${TITULO_SECCION} mb-5`}>Notas de la etapa</h2>
          <NoteList notas={notas} />
        </section>
      )}

      <section id="fotos" className={`${CONTENEDOR} pt-14`}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={TITULO_SECCION}>Fotos de la etapa</h2>
          {fotos.length > 0 && <span className="text-[15px] text-gris">{plural(fotos.length, 'foto')}</span>}
        </div>
        {fotos.length === 0 ? (
          <p className="m-0 text-musgo">Esta etapa no tiene fotos.</p>
        ) : (
          <PhotoGrid fotos={fotos} anio={tramo.anio} uniforme onVerEnMapa={(id) => verEnMapa('foto', id)} />
        )}
      </section>

      {(anterior || siguiente) && (
        <nav aria-label="Otras etapas" className={`${CONTENEDOR} pt-16`}>
          <div className="flex flex-wrap justify-between gap-4 border-t border-tinta pt-6">
            {anterior ? (
              <Link to={enlace(numero - 1)} className="group">
                <span className="block text-sm text-gris">← Etapa {numero - 1}</span>
                <span className="font-serif text-2xl font-semibold group-hover:underline">{anterior.titulo}</span>
              </Link>
            ) : (
              <span />
            )}
            {siguiente && (
              <Link to={enlace(numero + 1)} className="group text-right">
                <span className="block text-sm text-gris">Etapa {numero + 1} →</span>
                <span className="font-serif text-2xl font-semibold group-hover:underline">{siguiente.titulo}</span>
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
