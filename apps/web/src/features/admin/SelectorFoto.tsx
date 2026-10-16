import { useRef, useState } from 'react';
import type { TramoEditor } from '@caminos/shared';
import { useCambio } from '../../lib/admin';
import { subirFoto, TIPOS_ADMITIDOS } from '../../lib/fotos';
import { Boton, MensajeError } from './ui';

interface Props {
  tramo: TramoEditor;
  /** Id de la foto elegida, o null */
  value: string | null;
  onChange: (fotoId: string | null) => void;
  /** Para los nombres accesibles, p. ej. «el sitio 1» */
  de: string;
}

/** Foto de un lugar o sitio de interés: se sube una nueva o se elige entre las del tramo */
export function SelectorFoto({ tramo, value, onChange, de }: Props) {
  const [eligiendo, setEligiendo] = useState(false);
  const nueva = useRef<string | null>(null);
  // La foto subida pasa a ser una foto más del tramo (sale también en la galería)
  const subir = useCambio(async (archivo: File) => {
    const { tramo: actualizado, id } = await subirFoto(tramo.id, tramo.etapas, archivo, () => {});
    nueva.current = id;
    return actualizado;
  });
  const foto = value ? tramo.fotos.find((f) => f.id === value) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {foto && (
          <img src={foto.urlMini} alt={foto.pie ?? `Foto de ${de}`} className="h-16 w-24 rounded-lg bg-linea-suave object-cover" />
        )}
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-tinta bg-white px-4 text-sm font-semibold hover:bg-papel ${
            subir.isPending ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {subir.isPending ? 'Subiendo…' : foto ? 'Subir otra' : 'Subir foto'}
          <input
            type="file"
            accept={TIPOS_ADMITIDOS.join(',')}
            aria-label={`Subir una foto de ${de}`}
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = '';
              if (archivo) subir.mutate(archivo, { onSuccess: () => onChange(nueva.current) });
            }}
          />
        </label>
        {tramo.fotos.length > 0 && (
          <Boton variante="sutil" aria-expanded={eligiendo} onClick={() => setEligiendo(!eligiendo)}>
            Elegir del tramo
          </Boton>
        )}
        {foto && (
          <Boton variante="sutil" onClick={() => onChange(null)}>
            Quitar foto
          </Boton>
        )}
      </div>
      <MensajeError error={subir.error} />
      {eligiendo && (
        <ul
          aria-label={`Fotos del tramo para ${de}`}
          className="m-0 grid max-h-64 list-none grid-cols-3 gap-2 overflow-y-auto rounded-xl bg-papel p-2 sm:grid-cols-5"
        >
          {tramo.fotos.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={f.id === value}
                aria-label={f.pie ?? 'Foto sin pie'}
                onClick={() => {
                  onChange(f.id);
                  setEligiendo(false);
                }}
                className={`block w-full cursor-pointer overflow-hidden rounded-lg border-2 p-0 ${f.id === value ? 'border-ocre' : 'border-transparent'}`}
              >
                <img src={f.urlMini} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
