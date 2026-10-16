import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { tramoEntradaSchema } from '@caminos/shared';
import { Aviso, CONTENEDOR, PuntoCamino, TITULO_SECCION } from '../../components/ui';
import { SelectorCamino } from '../../features/admin/SelectorCamino';
import { Boton, Campo, erroresDelApi, INPUT, MensajeError } from '../../features/admin/ui';
import { editar, useCambio, useTramosAdmin } from '../../lib/admin';
import { fechaLarga, numeroKm, plural } from '../../lib/formato';

export function AdminHome() {
  const tramos = useTramosAdmin();
  const [nuevo, setNuevo] = useState(false);

  return (
    <section className={`${CONTENEDOR} pt-10`}>
      <title>Modo editor · En Caminos</title>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_SECCION}>Tramos</h1>
        {!nuevo && (
          <Boton variante="primario" onClick={() => setNuevo(true)}>
            + Nuevo año / tramo
          </Boton>
        )}
      </div>

      {nuevo && <NuevoTramo onCancelar={() => setNuevo(false)} />}

      {tramos.isError && <Aviso>No se pudieron cargar los tramos.</Aviso>}
      {tramos.data?.length === 0 && <Aviso>Todavía no hay tramos. Crea el primero.</Aviso>}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {tramos.data?.map((t) => (
          <li key={t.id}>
            <Link
              to={`/admin/tramos/${t.id}`}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[14px] border-2 border-linea bg-white px-5 py-4 hover:border-ocre hover:no-underline"
            >
              <span className="font-serif text-3xl font-semibold">{t.anio}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.titulo}</span>
                <span className="flex items-center gap-1.5 text-sm text-gris">
                  <PuntoCamino color={t.camino.color} />
                  {t.camino.nombre} · {numeroKm(t.kmTotal)} km · {plural(t.numEtapas, 'etapa')}
                </span>
              </span>
              <span className="text-right text-[13px] text-gris">
                <EstadoTramo estado={t.estado} />
                <span className="block">Cambiado el {fechaLarga(t.actualizadoEn.slice(0, 10))}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EstadoTramo({ estado }: { estado: 'borrador' | 'publicado' }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[.08em] ${
        estado === 'publicado' ? 'bg-bosque text-white' : 'bg-ocre text-tinta'
      }`}
    >
      {estado === 'publicado' ? 'Publicado' : 'Borrador'}
    </span>
  );
}

function NuevoTramo({ onCancelar }: { onCancelar: () => void }) {
  const navigate = useNavigate();
  const crear = useCambio((datos: unknown) => editar('POST', '/api/admin/tramos', datos));
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tramoEntradaSchema),
    defaultValues: { anio: new Date().getFullYear(), camino: '', titulo: '' },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((datos) =>
        crear.mutate(datos, {
          onSuccess: (tramo) => navigate(`/admin/tramos/${tramo.id}`),
          onError: (err) => erroresDelApi(err, setError),
        }),
      )}
      className="mb-8 grid gap-4 rounded-2xl border-2 border-dashed border-bosque bg-white p-5 sm:grid-cols-[120px_1fr]"
    >
      <Campo etiqueta="Año" error={errors.anio && 'Año entre 1990 y 2100'}>
        {(p) => <input {...p} {...register('anio', { valueAsNumber: true })} type="number" inputMode="numeric" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Camino" error={errors.camino && 'Elige un Camino'}>
        {(p) => (
          <Controller
            control={control}
            name="camino"
            render={({ field }) => <SelectorCamino id={p.id} value={field.value} onChange={field.onChange} invalido={p['aria-invalid']} />}
          />
        )}
      </Campo>
      <Campo etiqueta="Título" ayuda="Normalmente, origen → destino" error={errors.titulo?.message && 'Escribe un título'} className="sm:col-span-2">
        {(p) => <input {...p} {...register('titulo')} placeholder="San Vicente de la Barquera → Potes" className={INPUT} />}
      </Campo>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Boton type="submit" variante="primario" ocupado={crear.isPending}>
          Crear borrador
        </Boton>
        <Boton variante="sutil" onClick={onCancelar}>
          Cancelar
        </Boton>
        <MensajeError error={crear.error} />
      </div>
    </form>
  );
}
