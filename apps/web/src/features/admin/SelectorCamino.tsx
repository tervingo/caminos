import { useState } from 'react';
import { useCaminos, useCrearCamino } from '../../lib/admin';
import { Boton, INPUT, MensajeError } from './ui';

const NUEVO = '__nuevo__';

interface Props {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  invalido?: boolean;
}

/** Desplegable de Caminos con opción de crear uno nuevo sin salir del formulario */
export function SelectorCamino({ id, value, onChange, invalido }: Props) {
  const caminos = useCaminos();
  const crear = useCrearCamino();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('Camino ');
  const [color, setColor] = useState('#2F7D6B');

  return (
    <div className="flex flex-col gap-2">
      <select
        id={id}
        aria-invalid={invalido}
        value={creando ? NUEVO : value}
        onChange={(e) => {
          if (e.target.value === NUEVO) setCreando(true);
          else {
            setCreando(false);
            onChange(e.target.value);
          }
        }}
        className={INPUT}
      >
        <option value="">Elige un Camino…</option>
        {caminos.data?.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.nombre}
          </option>
        ))}
        <option value={NUEVO}>+ Nuevo Camino…</option>
      </select>
      {creando && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-papel p-3">
          <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 text-sm font-semibold">
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-16 cursor-pointer rounded-[10px] border border-borde bg-white" />
          </label>
          <Boton
            variante="primario"
            ocupado={crear.isPending}
            onClick={() =>
              crear.mutate(
                { nombre: nombre.trim(), color },
                {
                  onSuccess: (camino) => {
                    setCreando(false);
                    onChange(camino.slug);
                  },
                },
              )
            }
          >
            Crear
          </Boton>
          <Boton variante="sutil" onClick={() => setCreando(false)}>
            Cancelar
          </Boton>
          <div className="basis-full">
            <MensajeError error={crear.error} />
          </div>
        </div>
      )}
    </div>
  );
}
