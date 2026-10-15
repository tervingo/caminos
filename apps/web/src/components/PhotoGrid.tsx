import { useEffect, useRef, useState } from 'react';
import type { Foto } from '@caminos/shared';
import { degradado } from './YearCard';

interface Props {
  fotos: Foto[];
  anio: number;
  onVerEnMapa: (id: string) => void;
}

/** Galería del tramo con visor a pantalla completa (dialog nativo: Esc cierra, foco atrapado) */
export function PhotoGrid({ fotos, anio, onVerEnMapa }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);

  if (fotos.length === 0) {
    return (
      <p className="m-0 rounded-xl border-2 border-dashed border-borde px-5 py-10 text-center text-musgo">
        Aún no hay fotos de {anio}.
      </p>
    );
  }

  const textoAlt = (f: Foto) => f.pie ?? `Foto del tramo de ${anio}`;
  const foto = abierta !== null ? fotos[abierta] : null;
  const mover = (paso: number) => setAbierta((i) => (i === null ? null : (i + paso + fotos.length) % fotos.length));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fotos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setAbierta(i)}
            aria-label={`Ampliar: ${textoAlt(f)}`}
            className={`relative h-40 cursor-pointer overflow-hidden rounded-xl border-0 p-0 sm:h-[220px] ${i === 0 ? 'col-span-2' : ''}`}
            style={{ background: degradado(i + 2) }}
          >
            <img
              src={f.urlMini}
              alt=""
              width={f.ancho}
              height={f.alto}
              loading="lazy"
              className="size-full object-cover"
            />
            {f.pie && (
              <span className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] truncate rounded-full bg-tinta/72 px-2.5 py-1 text-xs text-white">
                {f.pie}
              </span>
            )}
          </button>
        ))}
      </div>

      <dialog
        ref={dialogo}
        aria-label="Visor de fotos"
        onClose={() => setAbierta(null)}
        onClick={(e) => e.target === e.currentTarget && setAbierta(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') mover(1);
          if (e.key === 'ArrowLeft') mover(-1);
        }}
        className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-4 text-white"
      >
        {foto && (
          <figure className="m-0 flex flex-col items-center gap-3">
            <img
              src={foto.urlGrande}
              alt={textoAlt(foto)}
              width={foto.ancho}
              height={foto.alto}
              className="h-auto max-h-[80dvh] w-auto max-w-[min(92vw,1600px)] rounded-lg object-contain"
            />
            <figcaption className="flex w-full flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {foto.pie}
                {foto.lat !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setAbierta(null);
                      onVerEnMapa(foto.id);
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-ocre underline-offset-2 hover:underline"
                  >
                    Ver en el mapa →
                  </button>
                )}
              </span>
              <span className="flex items-center gap-2">
                {fotos.length > 1 && (
                  <>
                    <BotonVisor onClick={() => mover(-1)} label="Foto anterior">←</BotonVisor>
                    <span className="tabular-nums">
                      {abierta! + 1} / {fotos.length}
                    </span>
                    <BotonVisor onClick={() => mover(1)} label="Foto siguiente">→</BotonVisor>
                  </>
                )}
                <BotonVisor onClick={() => setAbierta(null)} label="Cerrar">×</BotonVisor>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

function BotonVisor({ onClick, label, children }: { onClick: () => void; label: string; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="size-11 cursor-pointer rounded-full border border-white/60 bg-transparent text-xl text-white hover:bg-white/15"
    >
      {children}
    </button>
  );
}
