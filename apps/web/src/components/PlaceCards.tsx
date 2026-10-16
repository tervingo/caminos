import type { Etapa, Foto, Lugar, TipoLugar } from '@caminos/shared';
import { precio } from '../lib/formato';
import { Estrellas, ROTULO } from './ui';

const TIPOS: { tipo: TipoLugar; titulo: string; borde: string; texto: string }[] = [
  { tipo: 'dormir', titulo: 'Dormir', borde: '#234E8F', texto: '#234E8F' },
  { tipo: 'comer', titulo: 'Comer', borde: '#1E4D3A', texto: '#1E4D3A' },
];

interface Props {
  lugares: Lugar[];
  etapas: Etapa[];
  fotos: Foto[];
  onVerEnMapa: (id: string) => void;
}

export function PlaceCards({ lugares, etapas, fotos, onVerEnMapa }: Props) {
  const fotoDe = (l: Lugar) => (l.fotoId ? fotos.find((f) => f.id === l.fotoId) : undefined);
  // Cada sitio indica su etapa y se listan en el orden del camino
  const posicion = new Map(etapas.map((e, i) => [e.id, i]));
  const ordenEtapa = (l: Lugar) => posicion.get(l.etapaId) ?? 99;

  if (lugares.length === 0) return <p className="m-0 text-musgo">No hay sitios para dormir ni para comer anotados en este tramo.</p>;

  return (
    <div className="flex flex-wrap gap-4">
      {TIPOS.map(({ tipo, titulo, borde, texto }) => {
        const deTipo = lugares.filter((l) => l.tipo === tipo).sort((a, b) => ordenEtapa(a) - ordenEtapa(b));
        return (
          <div
            key={tipo}
            className="min-w-0 flex-[1_1_280px] rounded-[14px] border border-t-4 border-linea bg-white p-5"
            style={{ borderTopColor: borde }}
          >
            <h3 className={`m-0 mb-2 ${ROTULO}`} style={{ color: texto }}>
              {titulo}
            </h3>
            {deTipo.length === 0 && <p className="m-0 border-t border-linea-suave py-3 text-sm text-gris">Nada anotado.</p>}
            {deTipo.map((l) => (
              <div key={l.id} className="flex gap-3 border-t border-linea-suave py-3">
                <div className="min-w-0 flex-1">
                  {posicion.has(l.etapaId) && (
                    <div className="text-xs font-semibold text-bosque">
                      Etapa {posicion.get(l.etapaId)! + 1} · {etapas[posicion.get(l.etapaId)!].titulo}
                    </div>
                  )}
                  <div className="font-semibold">{l.nombre}</div>
                  {l.valoracion && <Estrellas valor={l.valoracion} />}
                  {(l.localidad || l.precio) && (
                    <div className="text-sm text-gris">{[l.localidad, precio(l.precio)].filter(Boolean).join(' · ')}</div>
                  )}
                  {l.nota && <div className="mt-1 text-sm text-musgo">{l.nota}</div>}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-sm font-semibold text-bosque">
                    <a
                      href="#mapa"
                      onClick={(e) => {
                        e.preventDefault();
                        onVerEnMapa(l.id);
                      }}
                    >
                      Ver en el mapa →
                    </a>
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        Web del sitio ↗
                      </a>
                    )}
                  </div>
                </div>
                {fotoDe(l) && (
                  <img
                    src={fotoDe(l)!.urlMini}
                    alt={fotoDe(l)!.pie ?? l.nombre}
                    loading="lazy"
                    className="size-20 shrink-0 rounded-lg bg-linea-suave object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
