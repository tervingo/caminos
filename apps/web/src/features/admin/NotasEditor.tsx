import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Nota, TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { fechaLarga } from '../../lib/formato';
import { SelectorEtapa } from './LugaresEditor';
import { Boton, Campo, erroresDelApi, INPUT, MensajeError, TEXTAREA } from './ui';

export function NotasEditor({ tramo }: { tramo: TramoEditor }) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {tramo.notas.map((n) => (
          <li key={n.id} className="rounded-[14px] border border-linea">
            {editando === n.id ? (
              <NotaForm tramo={tramo} nota={n} onCerrar={() => setEditando(null)} />
            ) : (
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="w-28 shrink-0 text-sm text-gris">{n.fecha ? fechaLarga(n.fecha) : 'Sin fecha'}</span>
                <p className="m-0 min-w-0 flex-1 font-serif text-lg leading-snug">{n.texto}</p>
                <Boton variante="sutil" onClick={() => setEditando(n.id)}>
                  Editar
                </Boton>
              </div>
            )}
          </li>
        ))}
      </ul>
      {/* Formulario rápido siempre visible, como en el mock-up */}
      <div className="rounded-[14px] border-2 border-dashed border-borde">
        <NotaForm key={tramo.notas.length} tramo={tramo} />
      </div>
    </div>
  );
}

interface ValoresNota {
  texto: string;
  fecha: string;
  etapaId: string;
}

function NotaForm({ tramo, nota, onCerrar }: { tramo: TramoEditor; nota?: Nota; onCerrar?: () => void }) {
  const guardar = useCambio((datos: object) =>
    nota ? editar('PATCH', `/api/admin/notas/${nota.id}`, datos) : editar('POST', `/api/admin/tramos/${tramo.id}/notas`, datos),
  );
  const borrar = useCambio(() => editar('DELETE', `/api/admin/notas/${nota!.id}`));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ValoresNota>({
    defaultValues: { texto: nota?.texto ?? '', fecha: nota?.fecha ?? '', etapaId: nota?.etapaId ?? '' },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ etapaId, ...v }) =>
        guardar.mutate({ ...v, etapaId: etapaId || null }, { onSuccess: () => onCerrar?.(), onError: (err) => erroresDelApi(err, setError) }),
      )}
      className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_220px]"
    >
      <Campo etiqueta={nota ? 'Nota' : `Añadir nota a ${tramo.anio}`} error={errors.texto && 'Escribe algo'} className="sm:col-span-3">
        {(p) => (
          <textarea {...p} {...register('texto', { required: true })} rows={2} placeholder="Qué quieres recordar de este tramo" className={TEXTAREA} />
        )}
      </Campo>
      <Campo etiqueta="Fecha" error={errors.fecha?.message}>
        {(p) => <input {...p} {...register('fecha')} type="date" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Etapa">{(p) => <SelectorEtapa {...p} tramo={tramo} {...register('etapaId')} />}</Campo>
      <div className="flex flex-wrap items-end gap-2">
        <Boton type="submit" variante="primario" ocupado={guardar.isPending}>
          {nota ? 'Guardar' : 'Guardar nota'}
        </Boton>
        {nota && (
          <>
            <Boton variante="sutil" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton variante="peligro" ocupado={borrar.isPending} onClick={() => confirm('¿Borrar esta nota?') && borrar.mutate(undefined)}>
              Borrar
            </Boton>
          </>
        )}
      </div>
      <div className="sm:col-span-3">
        <MensajeError error={guardar.error ?? borrar.error} />
      </div>
    </form>
  );
}
