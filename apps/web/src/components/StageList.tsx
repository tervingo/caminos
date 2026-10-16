import type { Etapa, Foto } from '@caminos/shared';
import { fechaCorta, kmEtapa, numeroKm } from '../lib/formato';

interface Props {
  etapas: Etapa[];
  /** Para la foto de cada sitio de interés */
  fotos?: Foto[];
  /** Viajes en coche, fuera de la numeración */
  ida?: Etapa | null;
  vuelta?: Etapa | null;
  /** Índice de la etapa elegida, o null */
  elegida: number | null;
  onElegir: (indice: number | null) => void;
}

export function StageList({ etapas, fotos = [], ida, vuelta, elegida, onElegir }: Props) {
  if (etapas.length === 0 && !ida && !vuelta) return <p className="m-0 text-musgo">Este tramo todavía no tiene etapas.</p>;

  return (
    <>
      {ida && <Viaje etapa={ida} />}
      <ol className="m-0 list-none p-0">
        {etapas.map((e, i) => {
          const activa = i === elegida;
          const km = kmEtapa(e);
          const datos = [e.fecha && fechaCorta(e.fecha), km !== null && `${numeroKm(km)} km`].filter(Boolean);
          return (
            <li key={e.id} className="mb-3">
              <button
                type="button"
                aria-pressed={activa}
                onClick={() => onElegir(activa ? null : i)}
                className={`flex w-full cursor-pointer gap-3.5 rounded-[14px] border-2 bg-white p-4 text-left text-inherit ${
                  activa ? 'border-ocre' : 'border-linea hover:border-borde'
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bosque font-semibold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{e.titulo}</span>
                  {datos.length > 0 && <span className="block text-[13px] font-semibold text-bosque">{datos.join(' · ')}</span>}
                  {e.notas && <span className="mt-1.5 block text-sm text-musgo">{e.notas}</span>}
                  {e.sitios.length > 0 && (
                    <span className="mt-2.5 block border-t border-linea-suave pt-2">
                      <span className="block text-xs font-semibold uppercase tracking-[.08em] text-ambar-oscuro">★ Sitios de interés</span>
                      {e.sitios.map((s, j) => {
                        const foto = s.fotoId ? fotos.find((f) => f.id === s.fotoId) : undefined;
                        return (
                          <span key={j} className="mt-1.5 flex gap-2.5 text-sm">
                            {foto && (
                              <img src={foto.urlMini} alt={foto.pie ?? s.nombre} loading="lazy" className="size-12 shrink-0 rounded-md object-cover" />
                            )}
                            <span className="min-w-0">
                              <span className="font-semibold">{s.nombre}</span>
                              {s.localidad && <span className="text-gris"> · {s.localidad}</span>}
                              {s.nota && <span className="block text-[13px] text-musgo">{s.nota}</span>}
                            </span>
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
              </button>
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
