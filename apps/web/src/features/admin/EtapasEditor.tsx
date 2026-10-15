import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { Etapa, PerfilRuta, Punto, TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { desnivel, fechaCorta, numeroKm } from '../../lib/formato';
import { type Limites, limitesTramo } from '../../lib/geo';
import { SelectorPunto } from './SelectorPunto';
import { Boton, Campo, erroresDelApi, INPUT, MensajeError, numeroOpcional, TEXTAREA } from './ui';

const PERFILES: { id: PerfilRuta; label: string }[] = [
  { id: 'driving-car', label: 'Por carretera (coche)' },
  { id: 'foot-walking', label: 'A pie' },
  { id: 'foot-hiking', label: 'Senderismo' },
];

/** Día siguiente a una fecha 'AAAA-MM-DD' */
function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function EtapasEditor({ tramo }: { tramo: TramoEditor }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const zona = limitesTramo(tramo);

  const nueva = useCambio(() => {
    const ultima = tramo.etapas.at(-1);
    const fecha = ultima?.fecha ? diaSiguiente(ultima.fecha) : tramo.fechaInicio;
    return editar('POST', `/api/admin/tramos/${tramo.id}/etapas`, {
      titulo: `Etapa ${tramo.etapas.length + 1}`,
      fecha,
      // Por comodidad, la nueva etapa sale de donde llegó la anterior
      origen: ultima?.destino ?? null,
    });
  });
  const ordenar = useCambio((ids: string[]) => editar('PUT', `/api/admin/tramos/${tramo.id}/etapas/orden`, { ids }));

  const mover = (i: number, paso: number) => {
    const ids = tramo.etapas.map((e) => e.id);
    [ids[i], ids[i + paso]] = [ids[i + paso], ids[i]];
    ordenar.mutate(ids);
  };

  return (
    <div className="flex flex-col gap-3">
      {tramo.etapas.length === 0 && <p className="m-0 text-musgo">Añade la primera etapa con su origen y su destino.</p>}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {tramo.etapas.map((e, i) => (
          <li key={e.id} className="rounded-[14px] border-2 border-linea">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bosque font-semibold text-white">{i + 1}</span>
              <button
                type="button"
                aria-expanded={abierta === e.id}
                onClick={() => setAbierta(abierta === e.id ? null : e.id)}
                className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
              >
                <span className="block font-semibold">{e.titulo}</span>
                <ResumenRuta etapa={e} />
              </button>
              <span className="flex gap-1">
                <Boton variante="sutil" aria-label={`Subir la etapa ${i + 1}`} disabled={i === 0 || ordenar.isPending} onClick={() => mover(i, -1)}>
                  ↑
                </Boton>
                <Boton
                  variante="sutil"
                  aria-label={`Bajar la etapa ${i + 1}`}
                  disabled={i === tramo.etapas.length - 1 || ordenar.isPending}
                  onClick={() => mover(i, 1)}
                >
                  ↓
                </Boton>
              </span>
            </div>
            {abierta === e.id && <EtapaForm key={e.id} etapa={e} zona={zona} onCerrar={() => setAbierta(null)} />}
          </li>
        ))}
      </ol>
      <MensajeError error={ordenar.error ?? nueva.error} />
      <div>
        <Boton
          variante="primario"
          ocupado={nueva.isPending}
          onClick={() => nueva.mutate(undefined, { onSuccess: (t) => setAbierta(t.etapas.at(-1)?.id ?? null) })}
        >
          + Nueva etapa
        </Boton>
      </div>
    </div>
  );
}

function ResumenRuta({ etapa }: { etapa: Etapa }) {
  const datos = [
    etapa.fecha && fechaCorta(etapa.fecha),
    etapa.km !== null && `${numeroKm(etapa.km)} km`,
    etapa.desnivelPos !== null && desnivel(etapa.desnivelPos),
  ].filter(Boolean);
  const aviso = !etapa.origen || !etapa.destino ? 'Falta origen o destino' : !etapa.traza ? 'Recorrido sin calcular' : null;
  return (
    <span className="block text-[13px] text-gris">
      {datos.join(' · ')}
      {aviso && <span className="ml-2 font-semibold text-ambar-oscuro">{aviso}</span>}
    </span>
  );
}

interface ValoresEtapa {
  titulo: string;
  fecha: string;
  origen: Punto | null;
  destino: Punto | null;
  via: { punto: Punto | null }[];
  notas: string;
  km: string;
}

const puntosIguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const valoresDe = (etapa: Etapa): ValoresEtapa => ({
  titulo: etapa.titulo,
  fecha: etapa.fecha ?? '',
  origen: etapa.origen,
  destino: etapa.destino,
  via: etapa.via.map((punto) => ({ punto })),
  notas: etapa.notas ?? '',
  km: etapa.km === null ? '' : String(etapa.km),
});

function EtapaForm({ etapa, zona, onCerrar }: { etapa: Etapa; zona: Limites | null; onCerrar: () => void }) {
  const [perfil, setPerfil] = useState<PerfilRuta>('driving-car');
  const [avisoRuta, setAvisoRuta] = useState<unknown>(null);
  const guardar = useCambio((cambios: object) => editar('PATCH', `/api/admin/etapas/${etapa.id}`, cambios));
  const calcular = useCambio((p: PerfilRuta) => editar('POST', `/api/admin/etapas/${etapa.id}/calcular-ruta`, { perfil: p }));
  const borrar = useCambio(() => editar('DELETE', `/api/admin/etapas/${etapa.id}`));

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ValoresEtapa>({ defaultValues: valoresDe(etapa) });
  const paradas = useFieldArray({ control, name: 'via' });

  /** Lo guardado pasa a ser la base del formulario */
  const tomarGuardado = (tramo: TramoEditor) => {
    const actual = tramo.etapas.find((e) => e.id === etapa.id);
    if (actual) reset(valoresDe(actual));
  };

  const calcularRuta = () => {
    setAvisoRuta(null);
    calcular.mutate(perfil, { onSuccess: tomarGuardado, onError: setAvisoRuta });
  };

  const enviar = handleSubmit((v) => {
    const via = v.via.flatMap((p) => (p.punto ? [p.punto] : []));
    const cambianPuntos = !puntosIguales(v.origen, etapa.origen) || !puntosIguales(v.destino, etapa.destino) || !puntosIguales(via, etapa.via);
    const cambios = {
      titulo: v.titulo,
      fecha: v.fecha,
      notas: v.notas,
      km: numeroOpcional(v.km),
      ...(cambianPuntos && { origen: v.origen, destino: v.destino, via }),
    };
    guardar.mutate(cambios, {
      onError: (err) => erroresDelApi(err, setError),
      // Con origen y destino nuevos, se recalcula el recorrido sin pedirlo
      onSuccess: (tramo) => {
        tomarGuardado(tramo);
        if (cambianPuntos && v.origen && v.destino) calcularRuta();
      },
    });
  });

  const puedeCalcular = !!etapa.origen && !!etapa.destino;

  return (
    <form noValidate onSubmit={enviar} className="grid gap-4 border-t border-linea p-4 sm:grid-cols-2">
      <Campo etiqueta="Título" error={errors.titulo && 'Escribe un título'}>
        {(p) => <input {...p} {...register('titulo', { required: true })} className={INPUT} />}
      </Campo>
      <Campo etiqueta="Fecha" error={errors.fecha?.message}>
        {(p) => <input {...p} {...register('fecha')} type="date" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Origen" error={errors.origen?.message}>
        {(p) => (
          <Controller
            control={control}
            name="origen"
            render={({ field }) => <SelectorPunto id={p.id} etiqueta="Origen" value={field.value} onChange={field.onChange} zona={zona} />}
          />
        )}
      </Campo>
      <Campo etiqueta="Destino" error={errors.destino?.message}>
        {(p) => (
          <Controller
            control={control}
            name="destino"
            render={({ field }) => <SelectorPunto id={p.id} etiqueta="Destino" value={field.value} onChange={field.onChange} zona={zona} />}
          />
        )}
      </Campo>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 sm:col-span-2">
        <legend className="mb-1 p-0 text-sm font-semibold">Paradas intermedias</legend>
        <p className="m-0 text-[13px] text-gris">Para que el recorrido pase por un sitio concreto cuando la carretera más corta no es la que hicisteis.</p>
        {paradas.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-start gap-2">
            <span className="mt-3 text-sm text-gris">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <Controller
                control={control}
                name={`via.${i}.punto`}
                render={({ field }) => (
                  <SelectorPunto etiqueta={`Parada ${i + 1}`} value={field.value} onChange={field.onChange} zona={zona} />
                )}
              />
            </div>
            <Boton variante="sutil" onClick={() => paradas.remove(i)} aria-label={`Quitar la parada ${i + 1}`}>
              Quitar
            </Boton>
          </div>
        ))}
        <div>
          <Boton variante="sutil" onClick={() => paradas.append({ punto: null })}>
            + Añadir parada
          </Boton>
        </div>
      </fieldset>

      <Campo etiqueta="Notas de la etapa" className="sm:col-span-2" error={errors.notas?.message}>
        {(p) => <textarea {...p} {...register('notas')} rows={3} className={TEXTAREA} />}
      </Campo>

      <div className="flex flex-col gap-2 rounded-xl bg-papel p-3 sm:col-span-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Tipo de recorrido
            <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilRuta)} className={INPUT}>
              {PERFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Boton onClick={calcularRuta} ocupado={calcular.isPending} disabled={!puedeCalcular || isDirty}>
            {etapa.traza ? 'Recalcular recorrido' : 'Calcular recorrido'}
          </Boton>
          <Campo etiqueta="Kilómetros" ayuda="Se rellenan al calcular; puedes corregirlos" className="w-44">
            {(p) => <input {...p} {...register('km')} inputMode="decimal" className={INPUT} />}
          </Campo>
        </div>
        <p className="m-0 text-[13px] text-gris">
          {!puedeCalcular
            ? 'Indica origen y destino y guarda para calcular el recorrido.'
            : isDirty
              ? 'Guarda los cambios para recalcular el recorrido.'
              : etapa.traza
                ? `Recorrido guardado: ${numeroKm(etapa.km ?? 0)} km${etapa.desnivelPos !== null ? ` · ${desnivel(etapa.desnivelPos)}` : ''}.`
                : 'Todavía sin recorrido.'}
        </p>
        <MensajeError error={avisoRuta} />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Boton type="submit" variante="primario" ocupado={guardar.isPending} disabled={!isDirty}>
          Guardar etapa
        </Boton>
        <Boton variante="sutil" onClick={onCerrar}>
          Cerrar
        </Boton>
        <Boton
          variante="peligro"
          className="ml-auto"
          ocupado={borrar.isPending}
          onClick={() => {
            if (confirm(`¿Borrar la etapa «${etapa.titulo}»? Sus lugares, fotos y notas se quedan en el tramo.`)) borrar.mutate(undefined);
          }}
        >
          Borrar etapa
        </Boton>
        <div className="basis-full">
          <MensajeError error={guardar.error ?? borrar.error} />
        </div>
      </div>
    </form>
  );
}
