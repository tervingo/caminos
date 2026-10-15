import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Lugar, Punto, TipoLugar, TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { precio } from '../../lib/formato';
import { limitesTramo } from '../../lib/geo';
import { SelectorPunto } from './SelectorPunto';
import { Boton, Campo, erroresDelApi, INPUT, MensajeError, TEXTAREA } from './ui';

const TIPOS: { id: TipoLugar; label: string; color: string }[] = [
  { id: 'dormir', label: 'Dormir', color: '#234E8F' },
  { id: 'comer', label: 'Comer', color: '#1E4D3A' },
  { id: 'ver', label: 'Qué ver', color: '#8A5F08' },
];

export function LugaresEditor({ tramo }: { tramo: TramoEditor }) {
  // null: ninguno; 'nuevo' o el id del lugar que se edita
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {tramo.lugares.length === 0 && editando !== 'nuevo' && <p className="m-0 text-musgo">Sin lugares todavía.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {tramo.lugares.map((l) => {
          const tipo = TIPOS.find((t) => t.id === l.tipo)!;
          return (
            <li key={l.id} className="rounded-[14px] border border-linea">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-[.08em]" style={{ color: tipo.color }}>
                  {tipo.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{l.nombre}</span>
                  <span className="text-sm text-gris"> {[l.localidad, precio(l.precio)].filter(Boolean).join(' · ')}</span>
                </span>
                <Boton variante="sutil" aria-expanded={editando === l.id} onClick={() => setEditando(editando === l.id ? null : l.id)}>
                  Editar
                </Boton>
              </div>
              {editando === l.id && <LugarForm tramo={tramo} lugar={l} onCerrar={() => setEditando(null)} />}
            </li>
          );
        })}
      </ul>
      {editando === 'nuevo' ? (
        <div className="rounded-[14px] border-2 border-dashed border-bosque">
          <LugarForm tramo={tramo} onCerrar={() => setEditando(null)} />
        </div>
      ) : (
        <div>
          <Boton variante="primario" onClick={() => setEditando('nuevo')}>
            + Añadir lugar
          </Boton>
        </div>
      )}
    </div>
  );
}

interface ValoresLugar {
  tipo: TipoLugar;
  nombre: string;
  localidad: string;
  punto: Punto | null;
  precio: string;
  nota: string;
  url: string;
  etapaId: string;
}

function LugarForm({ tramo, lugar, onCerrar }: { tramo: TramoEditor; lugar?: Lugar; onCerrar: () => void }) {
  const guardar = useCambio((datos: object) =>
    lugar ? editar('PATCH', `/api/admin/lugares/${lugar.id}`, datos) : editar('POST', `/api/admin/tramos/${tramo.id}/lugares`, datos),
  );
  const borrar = useCambio(() => editar('DELETE', `/api/admin/lugares/${lugar!.id}`));
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ValoresLugar>({
    defaultValues: {
      tipo: lugar?.tipo ?? 'dormir',
      nombre: lugar?.nombre ?? '',
      localidad: lugar?.localidad ?? '',
      punto: lugar ? { nombre: lugar.localidad, lat: lugar.lat, lon: lugar.lon } : null,
      precio: lugar?.precio ? String(lugar.precio) : '',
      nota: lugar?.nota ?? '',
      url: lugar?.url ?? '',
      etapaId: lugar?.etapaId ?? '',
    },
  });

  const enviar = handleSubmit(({ punto, precio: p, etapaId, ...v }) => {
    if (!punto) return setError('punto', { message: 'Busca la localidad o elige el punto en el mapa' });
    guardar.mutate(
      { ...v, lat: punto.lat, lon: punto.lon, precio: p ? Number(p) : null, etapaId: etapaId || null },
      { onSuccess: onCerrar, onError: (err) => erroresDelApi(err, setError) },
    );
  });

  return (
    <form noValidate onSubmit={enviar} className="grid gap-4 border-t border-linea p-4 sm:grid-cols-2">
      <Campo etiqueta="Tipo">
        {(p) => (
          <select {...p} {...register('tipo')} className={INPUT}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo etiqueta="Nombre" error={errors.nombre && 'Escribe el nombre'}>
        {(p) => <input {...p} {...register('nombre', { required: true })} placeholder="Albergue de peregrinos" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Posición" error={errors.punto?.message} className="sm:col-span-2">
        {(p) => (
          <Controller
            control={control}
            name="punto"
            render={({ field }) => (
              <SelectorPunto
                id={p.id}
                etiqueta="Posición del lugar"
                value={field.value}
                zona={limitesTramo(tramo)}
                onChange={(punto) => {
                  field.onChange(punto);
                  if (punto?.nombre && !getValues('localidad')) setValue('localidad', punto.nombre);
                }}
              />
            )}
          />
        )}
      </Campo>
      <Campo etiqueta="Localidad" error={errors.localidad?.message}>
        {(p) => <input {...p} {...register('localidad')} className={INPUT} />}
      </Campo>
      <Campo etiqueta="Precio">
        {(p) => (
          <select {...p} {...register('precio')} className={INPUT}>
            <option value="">Sin indicar</option>
            <option value="1">€</option>
            <option value="2">€€</option>
            <option value="3">€€€</option>
          </select>
        )}
      </Campo>
      <Campo etiqueta="Etapa">
        {(p) => <SelectorEtapa {...p} tramo={tramo} {...register('etapaId')} />}
      </Campo>
      <Campo etiqueta="Web" error={errors.url && 'Dirección no válida (empieza por https://)'}>
        {(p) => <input {...p} {...register('url')} type="url" placeholder="https://" className={INPUT} />}
      </Campo>
      <Campo etiqueta="Nota" className="sm:col-span-2" error={errors.nota?.message}>
        {(p) => <textarea {...p} {...register('nota')} rows={2} className={TEXTAREA} />}
      </Campo>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Boton type="submit" variante="primario" ocupado={guardar.isPending}>
          {lugar ? 'Guardar lugar' : 'Añadir lugar'}
        </Boton>
        <Boton variante="sutil" onClick={onCerrar}>
          Cancelar
        </Boton>
        {lugar && (
          <Boton
            variante="peligro"
            className="ml-auto"
            ocupado={borrar.isPending}
            onClick={() => confirm(`¿Borrar «${lugar.nombre}»?`) && borrar.mutate(undefined)}
          >
            Borrar
          </Boton>
        )}
        <div className="basis-full">
          <MensajeError error={guardar.error ?? borrar.error} />
        </div>
      </div>
    </form>
  );
}

/** Desplegable con las etapas del tramo; '' es «del tramo en general» */
export function SelectorEtapa({ tramo, ...props }: { tramo: TramoEditor } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={INPUT}>
      <option value="">Del tramo en general</option>
      {tramo.etapas.map((e, i) => (
        <option key={e.id} value={e.id}>
          {i + 1}. {e.titulo}
        </option>
      ))}
    </select>
  );
}
