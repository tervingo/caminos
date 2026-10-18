import type { Etapa } from '@caminos/shared';
import { Link } from 'react-router';
import { fechaCorta, kmEtapa, numeroKm, plural } from '../lib/formato';

interface Props {
  etapas: Etapa[];
  /** Para enlazar la ficha de cada etapa */
  slug: string;
  conteoFotos?: Map<string, number>;
  /** Viajes en coche, fuera de la numeración */
  ida?: Etapa | null;
  vuelta?: Etapa | null;
  /** Índice de la etapa resaltada en el mapa, o null */
  elegida?: number | null;
}

/** Tarjetas de las etapas: cada una lleva a su ficha completa */
export function StageList({ etapas, slug, conteoFotos, ida, vuelta, elegida = null }: Props) {
  if (etapas.length === 0 && !ida && !vuelta) return <p className="m-0 text-musgo">Este tramo todavía no tiene etapas.</p>;

  return (
    <>
      {ida && <Viaje etapa={ida} />}
      <ol className="m-0 list-none p-0">
        {etapas.map((e, i) => {
          const km = kmEtapa(e);
          const datos = [e.fecha && fechaCorta(e.fecha), km !== null && `${numeroKm(km)} km`].filter(Boolean);
          const nFotos = conteoFotos?.get(e.id) ?? 0;
          const resumen = [e.sitios.length > 0 && plural(e.sitios.length, 'sitio de interés', 'sitios de interés'), nFotos > 0 && plural(nFotos, 'foto')].filter(
            Boolean,
          );
          return (
            <li key={e.id} className="mb-3">
              <Link
                to={`/tramos/${slug}/etapas/${i + 1}`}
                className={`flex w-full gap-3.5 rounded-[14px] border-2 bg-white p-4 text-inherit hover:no-underline ${
                  i === elegida ? 'border-ocre' : 'border-linea hover:border-borde'
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bosque font-semibold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{e.titulo}</span>
                  {datos.length > 0 && <span className="block text-[13px] font-semibold text-bosque">{datos.join(' · ')}</span>}
                  {e.notas && <span className="mt-1.5 line-clamp-2 block text-sm text-musgo">{e.notas}</span>}
                  {resumen.length > 0 && <span className="mt-1.5 block text-[13px] text-gris">{resumen.join(' · ')}</span>}
                </span>
                <span aria-hidden="true" className="self-center text-xl text-bosque">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {vuelta && <Viaje etapa={vuelta} />}
    </>
  );
}

/** Ida o vuelta en coche: tarjeta discontinua, sin número y sin selección */
function Viaje({ etapa }: { etapa: Etapa }) {
  const datos = [etapa.fecha && fechaCorta(etapa.fecha), etapa.km !== null && `${numeroKm(etapa.km)} km`].filter(Boolean);
  return (
    <div className="mb-3 flex gap-3.5 rounded-[14px] border-2 border-dashed border-borde px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-[.08em] text-gris">
          {etapa.tipo === 'ida' ? 'Ida' : 'Vuelta'} en coche
        </span>
        <span className="block font-semibold">{etapa.titulo}</span>
        {datos.length > 0 && <span className="block text-[13px] text-gris">{datos.join(' · ')}</span>}
        {etapa.notas && <span className="mt-1 block text-sm text-musgo">{etapa.notas}</span>}
      </span>
    </div>
  );
}
