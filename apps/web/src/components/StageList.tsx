import type { Etapa } from '@caminos/shared';
import { fechaCorta, numeroKm } from '../lib/formato';

interface Props {
  etapas: Etapa[];
  /** Índice de la etapa elegida, o null */
  elegida: number | null;
  onElegir: (indice: number | null) => void;
}

export function StageList({ etapas, elegida, onElegir }: Props) {
  if (etapas.length === 0) return <p className="m-0 text-musgo">Este tramo todavía no tiene etapas.</p>;

  return (
    <ol className="m-0 list-none p-0">
      {etapas.map((e, i) => {
        const activa = i === elegida;
        const datos = [e.fecha && fechaCorta(e.fecha), e.km !== null && `${numeroKm(e.km)} km`].filter(Boolean);
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
                {datos.length > 0 && (
                  <span className="block text-[13px] font-semibold text-bosque">{datos.join(' · ')}</span>
                )}
                {e.notas && <span className="mt-1.5 block text-sm text-musgo">{e.notas}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
