import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { Punto } from '@caminos/shared';
import { buscarLocalidad, nombrarPunto } from '../../lib/admin';
import type { Limites } from '../../lib/geo';
import { Boton, INPUT, MensajeError } from './ui';

const MapaSelector = lazy(() => import('./MapaSelector'));

function useRetardado<T>(valor: T, ms: number): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retardado;
}

interface Props {
  /** Nombre accesible del buscador, p. ej. «Origen» */
  etiqueta: string;
  id?: string;
  value: Punto | null;
  onChange: (punto: Punto | null) => void;
  /** Zona en la que abrir el mapa */
  zona?: Limites | null;
}

/** Elige un punto buscando la localidad por nombre (OpenRouteService) o pulsando en el mapa */
export function SelectorPunto({ etiqueta, id, value, onChange, zona }: Props) {
  const [texto, setTexto] = useState('');
  const [mapa, setMapa] = useState(false);
  const [nombrando, setNombrando] = useState(false);
  const q = useRetardado(texto.trim(), 350);
  const resultados = useQuery({
    queryKey: ['geo', q],
    queryFn: () => buscarLocalidad(q),
    enabled: q.length >= 2 && !value,
    staleTime: Infinity,
  });

  const desdeMapa = async (lat: number, lon: number) => {
    setMapa(false);
    setNombrando(true);
    const lugar = await nombrarPunto(lat, lon).catch(() => null);
    setNombrando(false);
    onChange({ nombre: lugar?.nombre ?? 'Punto en el mapa', lat, lon });
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          aria-label={`Nombre de ${etiqueta.toLowerCase()}`}
          value={value.nombre ?? ''}
          onChange={(e) => onChange({ ...value, nombre: e.target.value || null })}
          className={`${INPUT} min-w-0 flex-[1_1_180px]`}
        />
        <span className="text-xs text-gris tabular-nums">
          {value.lat.toFixed(4)}, {value.lon.toFixed(4)}
        </span>
        <Boton variante="sutil" onClick={() => onChange(null)}>
          Cambiar
        </Boton>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={!!resultados.data?.length}
          aria-label={`Buscar ${etiqueta.toLowerCase()}`}
          placeholder="Busca una localidad…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={`${INPUT} min-w-0 flex-[1_1_200px]`}
        />
        <Boton onClick={() => setMapa(true)} ocupado={nombrando}>
          Elegir en el mapa
        </Boton>
      </div>
      {resultados.isFetching && <span className="text-[13px] text-gris">Buscando…</span>}
      <MensajeError error={resultados.error} />
      {resultados.data && q.length >= 2 && (
        <ul role="listbox" aria-label={`Resultados para ${etiqueta.toLowerCase()}`} className="m-0 list-none rounded-[10px] border border-linea bg-white p-1">
          {resultados.data.length === 0 && <li className="px-3 py-2 text-sm text-gris">Sin resultados</li>}
          {resultados.data.map((r) => (
            <li key={`${r.lat},${r.lon}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onChange({ nombre: r.nombre, lat: r.lat, lon: r.lon });
                  setTexto('');
                }}
                className="w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-papel"
              >
                <span className="font-semibold">{r.nombre}</span>
                <span className="block text-xs text-gris">{r.etiqueta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mapa && (
        <Suspense fallback={null}>
          <MapaSelector titulo={etiqueta} zona={zona ?? null} onElegir={desdeMapa} onCerrar={() => setMapa(false)} />
        </Suspense>
      )}
    </div>
  );
}
