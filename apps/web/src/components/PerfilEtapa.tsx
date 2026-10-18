// Perfil de altitud de una etapa, al estilo de Gronze: área con degradado suave, altitud a la derecha,
// los puntos con nombre marcados sobre el perfil y, al pasar el ratón o el dedo, km y altitud de ese punto.
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import type { Perfil } from '@caminos/shared';
import { metros, numeroKm } from '../lib/formato';
import { dominioAltitud, indiceEnKm, type Marca, marcasEje, marcasEnPerfil, pasoBonito } from '../lib/perfil';

// Colores del mock-up D: ocre para el área, ámbar para la línea; texto siempre con tintas de texto
const LINEA = '#B07A0F';
const AREA = '#E2AE2D';
const REJILLA = '#E4E3D8';
const TINTA = '#14231C';
const GRIS = '#5A665F';
const SUPERFICIE = '#FFFFFF';

const MARGEN = { arriba: 34, derecha: 56, abajo: 28, izquierda: 12 };
/** Separación mínima entre dos nombres para que no se pisen; los que no caben quedan solo con su punto */
const SEPARACION_NOMBRES = 90;

interface Props {
  perfil: Perfil;
  /** Inicio, final y sitios de interés, que se marcan con su nombre si caen junto al recorrido */
  marcas: Marca[];
  /** Punto bajo el cursor ([lat, lon]), para señalarlo también en el mapa */
  onPunto?: (punto: [number, number] | null) => void;
}

export function PerfilEtapa({ perfil, marcas, onPunto }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState<number | null>(null);
  const idDegradado = useId();

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const observador = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const alto = ancho < 500 ? 190 : 240;
  const puntos = perfil.puntos;
  const total = puntos.at(-1)![0];
  const { desde, hasta, paso } = dominioAltitud(perfil.minima, perfil.maxima);
  const anchoUtil = Math.max(ancho - MARGEN.izquierda - MARGEN.derecha, 1);
  const altoUtil = alto - MARGEN.arriba - MARGEN.abajo;
  const x = (km: number) => MARGEN.izquierda + (km / total) * anchoUtil;
  const y = (m: number) => MARGEN.arriba + (1 - (m - desde) / (hasta - desde)) * altoUtil;

  const linea = puntos.map(([km, m], i) => `${i ? 'L' : 'M'}${x(km).toFixed(1)},${y(m).toFixed(1)}`).join('');
  const area = `${linea}L${x(total).toFixed(1)},${y(desde)}L${x(0)},${y(desde)}Z`;
  const pasoKm = pasoBonito(total, ancho < 500 ? 4 : 7);
  const marcasKm = marcasEje(0, total, pasoKm);
  const marcasM = marcasEje(desde, hasta, paso);

  // Nombres: de izquierda a derecha, saltando los que pisarían al anterior
  const conNombre = marcasEnPerfil(perfil, marcas).reduce<{ nombre: string; indice: number; px: number; py: number; cabe: boolean }[]>(
    (acc, m) => {
      const px = x(puntos[m.indice][0]);
      const ultimo = acc.findLast((a) => a.cabe);
      return [...acc, { ...m, px, py: y(puntos[m.indice][1]), cabe: !ultimo || px - ultimo.px >= SEPARACION_NOMBRES }];
    },
    [],
  );

  const mover = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const km = ((e.clientX - r.left) / r.width) * total;
    const i = indiceEnKm(perfil, Math.max(0, Math.min(total, km)));
    setActivo(i);
    onPunto?.([puntos[i][2], puntos[i][3]]);
  };
  const salir = () => {
    setActivo(null);
    onPunto?.(null);
  };

  const resumen = `Perfil de altitud: ${numeroKm(total)} km, sube ${metros(perfil.subida)} y baja ${metros(perfil.bajada)}; altitud entre ${metros(
    perfil.minima,
  )} y ${metros(perfil.maxima)}.`;
  const p = activo !== null ? puntos[activo] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-musgo">
        <span>
          <span aria-hidden="true">↗</span> Sube <strong className="text-tinta">{metros(perfil.subida)}</strong>
        </span>
        <span>
          <span aria-hidden="true">↘</span> Baja <strong className="text-tinta">{metros(perfil.bajada)}</strong>
        </span>
        <span>
          Máxima <strong className="text-tinta">{metros(perfil.maxima)}</strong>
        </span>
        <span>
          Mínima <strong className="text-tinta">{metros(perfil.minima)}</strong>
        </span>
      </figcaption>

      <div ref={caja} className="relative rounded-2xl border border-linea bg-white">
        {ancho > 0 && (
          <svg width={ancho} height={alto} role="img" aria-label={resumen} className="block">
            <defs>
              <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AREA} stopOpacity={0.32} />
                <stop offset="100%" stopColor={AREA} stopOpacity={0.06} />
              </linearGradient>
            </defs>

            {/* Rejilla y eje de altitud (a la derecha, como en Gronze) */}
            {marcasM.map((m) => (
              <g key={m}>
                <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(m)} y2={y(m)} stroke={REJILLA} strokeWidth={1} />
                <text x={ancho - MARGEN.derecha + 8} y={y(m)} dy="0.32em" fontSize={11} fill={GRIS} className="tabular-nums">
                  {metros(m)}
                </text>
              </g>
            ))}
            {marcasKm.map((km) => (
              <text key={km} x={x(km)} y={alto - 8} fontSize={11} fill={GRIS} textAnchor={km === 0 ? 'start' : 'middle'} className="tabular-nums">
                {km === 0 ? '0 km' : numeroKm(km)}
              </text>
            ))}

            <path d={area} fill={`url(#${idDegradado})`} />
            <path d={linea} fill="none" stroke={LINEA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Puntos con nombre: el punto siempre; el nombre, si cabe */}
            {conNombre.map((m) => (
              <g key={`${m.nombre}-${m.indice}`}>
                <circle cx={m.px} cy={m.py} r={4} fill={TINTA} stroke={SUPERFICIE} strokeWidth={2} />
                {m.cabe && (
                  <text
                    x={m.px}
                    y={m.py - 10}
                    fontSize={11}
                    fontWeight={600}
                    fill={TINTA}
                    textAnchor={m.px < 60 ? 'start' : m.px > ancho - MARGEN.derecha - 60 ? 'end' : 'middle'}
                    stroke={SUPERFICIE}
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {m.nombre}
                  </text>
                )}
              </g>
            ))}

            {/* Cursor: línea vertical y punto sobre el perfil */}
            {p && (
              <g pointerEvents="none">
                <line x1={x(p[0])} x2={x(p[0])} y1={MARGEN.arriba} y2={y(desde)} stroke={TINTA} strokeWidth={1} />
                <circle cx={x(p[0])} cy={y(p[1])} r={5} fill={LINEA} stroke={SUPERFICIE} strokeWidth={2} />
              </g>
            )}
            <rect
              x={MARGEN.izquierda}
              y={MARGEN.arriba}
              width={anchoUtil}
              height={altoUtil}
              fill="transparent"
              onPointerMove={mover}
              onPointerDown={mover}
              onPointerLeave={salir}
              style={{ touchAction: 'pan-y' }}
            />
          </svg>
        )}
        {!ancho && <div style={{ height: 240 }} />}
        {p && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 rounded-lg bg-tinta px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white tabular-nums"
            style={{ left: Math.min(Math.max(x(p[0]) - 50, 4), ancho - 120) }}
          >
            km {numeroKm(p[0])} · {metros(p[1])}
          </div>
        )}
      </div>

      <p className="mt-2 mb-0 text-[13px] text-gris">
        {perfil.origen === 'gpx' ? 'Altitudes del GPX del recorrido.' : 'Altitudes aproximadas del modelo del terreno (OpenRouteService).'}
      </p>
      <details className="mt-1 text-sm text-gris">
        <summary className="cursor-pointer">Ver los datos del perfil</summary>
        <table className="mt-2 text-left tabular-nums">
          <thead>
            <tr>
              <th className="pr-6 font-semibold">km</th>
              <th className="font-semibold">Altitud</th>
            </tr>
          </thead>
          <tbody>
            {/* Una fila por kilómetro (aprox.): suficiente para leerlo sin el gráfico */}
            {marcasEje(0, total, 1).map((km) => {
              const i = indiceEnKm(perfil, km);
              return (
                <tr key={km}>
                  <td className="pr-6">{numeroKm(km)}</td>
                  <td>{metros(puntos[i][1])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
