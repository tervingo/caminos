import type { Nota } from '@caminos/shared';
import { fechaLarga } from '../lib/formato';

export function NoteList({ notas }: { notas: Nota[] }) {
  if (notas.length === 0) return <p className="m-0 text-musgo">Sin notas por ahora.</p>;

  return (
    <div className="max-w-[760px]">
      {notas.map((n) => (
        <div key={n.id} className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-linea py-[18px]">
          <div className="flex-[0_0_120px] text-sm text-gris">{n.fecha ? fechaLarga(n.fecha) : 'Sin fecha'}</div>
          <p className="m-0 flex-[1_1_320px] font-serif text-xl leading-[1.4] text-pizarra">{n.texto}</p>
        </div>
      ))}
    </div>
  );
}
