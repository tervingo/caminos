import { Link } from 'react-router';
import type { TramoResumen } from '@caminos/shared';
import { numeroKm, plural } from '../lib/formato';
import { PuntoCamino } from './ui';

// Fondos del mock-up D para los tramos que aún no tienen foto de portada
const DEGRADADOS = [
  'linear-gradient(180deg,#a9cde0 0%,#e8dcc0 52%,#7d9a58 53%,#4f6c3c 100%)',
  'linear-gradient(180deg,#f2c98a 0%,#e9a36b 40%,#6d5a7a 41%,#3d3550 100%)',
  'linear-gradient(180deg,#b9d3e6 0%,#dfe8ee 45%,#a79b86 46%,#6a5f50 100%)',
  'linear-gradient(180deg,#8fb4c9 0%,#c9d9c0 50%,#5f8a5a 51%,#2f5238 100%)',
  'linear-gradient(180deg,#e6c3a1 0%,#f3e3c9 48%,#b98a56 49%,#7a5a36 100%)',
  'linear-gradient(180deg,#a5c0d8 0%,#d8e2ea 55%,#8aa07a 56%,#566f4a 100%)',
];

export function degradado(i: number) {
  return DEGRADADOS[i % DEGRADADOS.length];
}

export function YearCard({ tramo, indice }: { tramo: TramoResumen; indice: number }) {
  return (
    <Link
      to={`/tramos/${tramo.slug}`}
      className="block min-w-0 flex-[1_1_220px] overflow-hidden rounded-[14px] border-2 border-linea bg-white transition-colors hover:border-ocre hover:no-underline focus-visible:border-ocre"
    >
      <div className="h-24" style={{ background: degradado(indice) }}>
        {tramo.portada && (
          <img src={tramo.portada.urlMini} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-musgo">
          <PuntoCamino color={tramo.camino.color} />
          {tramo.camino.nombre}
        </div>
        <div className="mt-1.5 font-serif text-4xl leading-none font-semibold">{tramo.anio}</div>
        <div className="mt-2 text-[15px] font-semibold">{tramo.titulo}</div>
        <div className="mt-1 text-sm text-gris">
          {numeroKm(tramo.kmTotal)} km · {plural(tramo.numEtapas, 'etapa')}
        </div>
      </div>
    </Link>
  );
}
