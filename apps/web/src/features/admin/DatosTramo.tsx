import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { type TramoEditor, tramoEntradaSchema } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { SelectorCamino } from './SelectorCamino';
import { Boton, Campo, erroresDelApi, INPUT, MensajeError, TEXTAREA } from './ui';

const valoresDe = (t: TramoEditor) => ({
  anio: t.anio,
  camino: t.camino.slug,
  titulo: t.titulo,
  slug: t.slug,
  resumen: t.resumen ?? '',
  fechaInicio: t.fechaInicio ?? '',
  fechaFin: t.fechaFin ?? '',
});

export function DatosTramo({ tramo }: { tramo: TramoEditor }) {
  const guardar = useCambio((datos: object) => editar('PATCH', `/api/admin/tramos/${tramo.id}`, datos));
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(tramoEntradaSchema), defaultValues: valoresDe(tramo) });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((datos) =>
        guardar.mutate(datos, {
          onSuccess: (t) => reset(valoresDe(t)),
          onError: (err) => erroresDelApi(err, setError),
        }),
      )}
      className="grid gap-4 sm:grid-cols-[120px_1fr_1fr]"
    >
      <Campo etiqueta="Año" error={errors.anio && 'Año entre 1990 y 2100'}>
        {(p) => <input {...p} {...register('anio', { valueAsNumber: true })} type="number" inputMode="numeric" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Camino" error={errors.camino && 'Elige un Camino'} className="sm:col-span-2">
        {(p) => (
          <Controller
            control={control}
            name="camino"
            render={({ field }) => <SelectorCamino id={p.id} value={field.value} onChange={field.onChange} invalido={p['aria-invalid']} />}
          />
        )}
      </Campo>
      <Campo etiqueta="Título" error={errors.titulo && 'Escribe un título'} className="sm:col-span-3">
        {(p) => <input {...p} {...register('titulo')} className={INPUT} />}
      </Campo>
      <Campo etiqueta="Fecha de inicio" error={errors.fechaInicio?.message}>
        {(p) => <input {...p} {...register('fechaInicio')} type="date" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Fecha de fin" error={errors.fechaFin?.message}>
        {(p) => <input {...p} {...register('fechaFin')} type="date" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Dirección" ayuda={`/tramos/${tramo.slug}`} error={errors.slug?.message}>
        {(p) => <input {...p} {...register('slug')} className={INPUT} />}
      </Campo>
      <Campo etiqueta="Resumen" ayuda="La entradilla que se lee bajo el título" error={errors.resumen?.message} className="sm:col-span-3">
        {(p) => <textarea {...p} {...register('resumen')} rows={3} className={TEXTAREA} />}
      </Campo>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Boton type="submit" variante="primario" ocupado={guardar.isPending} disabled={!isDirty}>
          Guardar datos
        </Boton>
        <MensajeError error={guardar.error} />
      </div>
    </form>
  );
}
