import { useState } from 'react';
import type { FotoEditor, TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { type FaseSubida, subirFoto, TIPOS_ADMITIDOS } from '../../lib/fotos';
import { SelectorEtapa } from './LugaresEditor';
import { Boton, INPUT, MensajeError } from './ui';

type Estado = 'esperando' | FaseSubida | 'hecha' | 'error';

interface EnCola {
  clave: string;
  nombre: string;
  estado: Estado;
  error?: string;
}

const TEXTO_ESTADO: Record<Estado, string> = {
  esperando: 'En espera',
  leyendo: 'Preparando…',
  subiendo: 'Subiendo…',
  registrando: 'Guardando…',
  hecha: 'Hecha',
  error: 'Error',
};

/** Fotos a la vez: suficiente para ir rápido sin saturar la conexión */
const EN_PARALELO = 2;

export function FotosEditor({ tramo }: { tramo: TramoEditor }) {
  const [cola, setCola] = useState<EnCola[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const subir = useCambio((a: { archivo: File; avisar: (f: FaseSubida) => void }) => subirFoto(tramo.id, tramo.etapas, a.archivo, a.avisar));

  const actualizar = (clave: string, cambio: Partial<EnCola>) =>
    setCola((c) => c.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));

  const anadir = async (archivos: File[]) => {
    const nuevos = archivos.map((archivo, i) => ({ archivo, clave: `${Date.now()}-${i}-${archivo.name}` }));
    setCola((c) => [...c.filter((x) => x.estado !== 'hecha'), ...nuevos.map(({ clave, archivo }) => ({ clave, nombre: archivo.name, estado: 'esperando' as const }))]);
    const pendientes = [...nuevos];
    const trabajador = async () => {
      for (let item = pendientes.shift(); item; item = pendientes.shift()) {
        const { clave, archivo } = item;
        try {
          await subir.mutateAsync({ archivo, avisar: (estado) => actualizar(clave, { estado }) });
          actualizar(clave, { estado: 'hecha' });
        } catch (err) {
          actualizar(clave, { estado: 'error', error: err instanceof Error ? err.message : 'Error desconocido' });
        }
      }
    };
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));
  };

  const ocupada = cola.some((x) => !['hecha', 'error'].includes(x.estado));

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          anadir([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-5 py-8 text-center ${
          arrastrando ? 'border-bosque bg-papel' : 'border-borde'
        }`}
      >
        <span className="font-semibold">+ Subir fotos</span>
        <span className="text-sm text-gris">
          Arrástralas aquí o pulsa para elegirlas (JPEG, PNG o WebP). Se reducen en tu navegador y se asignan a su etapa por la fecha.
        </span>
        <input
          type="file"
          multiple
          accept={TIPOS_ADMITIDOS.join(',')}
          className="sr-only"
          onChange={(e) => {
            anadir([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </label>

      {cola.length > 0 && (
        <ul aria-live="polite" className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {cola.map((x) => (
            <li key={x.clave} className="flex flex-wrap gap-x-3">
              <span className="min-w-0 flex-1 truncate">{x.nombre}</span>
              <span className={x.estado === 'error' ? 'text-red-800' : x.estado === 'hecha' ? 'text-bosque' : 'text-gris'}>
                {TEXTO_ESTADO[x.estado]}
                {x.error && `: ${x.error}`}
              </span>
            </li>
          ))}
          {!ocupada && (
            <li>
              <Boton variante="sutil" onClick={() => setCola([])}>
                Limpiar lista
              </Boton>
            </li>
          )}
        </ul>
      )}

      {tramo.fotos.length === 0 ? (
        <p className="m-0 text-musgo">Aún no hay fotos.</p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {tramo.fotos.map((f) => (
            <FotoFicha key={f.id} tramo={tramo} foto={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FotoFicha({ tramo, foto }: { tramo: TramoEditor; foto: FotoEditor }) {
  const [pie, setPie] = useState(foto.pie ?? '');
  const cambiar = useCambio((datos: object) => editar('PATCH', `/api/admin/fotos/${foto.id}`, datos));
  const portada = useCambio(() => editar('PATCH', `/api/admin/tramos/${tramo.id}`, { portadaFotoId: foto.id }));
  const borrar = useCambio(() => editar('DELETE', `/api/admin/fotos/${foto.id}`));
  const esPortada = tramo.portadaFotoId === foto.id;
  const fecha = foto.tomadaEn ? new Date(foto.tomadaEn).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

  return (
    <li className={`flex flex-col overflow-hidden rounded-[14px] border-2 ${esPortada ? 'border-ocre' : 'border-linea'}`}>
      <img src={foto.urlMini} alt={foto.pie ?? ''} width={foto.ancho} height={foto.alto} loading="lazy" className="aspect-[3/2] w-full bg-linea-suave object-cover" />
      <div className="flex flex-col gap-2 p-3">
        <span className="text-xs text-gris">
          {fecha}
          {foto.lat === null && ' · sin GPS'}
        </span>
        <input
          aria-label="Pie de foto"
          placeholder="Pie de foto"
          value={pie}
          onChange={(e) => setPie(e.target.value)}
          onBlur={() => pie !== (foto.pie ?? '') && cambiar.mutate({ pie })}
          className={INPUT}
        />
        <SelectorEtapa
          aria-label="Etapa de la foto"
          tramo={tramo}
          value={foto.etapaId ?? ''}
          onChange={(e) => cambiar.mutate({ etapaId: e.target.value || null })}
        />
        <label className={`flex items-center gap-2 text-sm ${foto.lat === null ? 'text-gris' : ''}`}>
          <input
            type="checkbox"
            disabled={foto.lat === null}
            checked={foto.mostrarPosicion}
            onChange={(e) => cambiar.mutate({ mostrarPosicion: e.target.checked })}
            className="size-4 accent-bosque"
          />
          Mostrar en el mapa público
        </label>
        <div className="flex flex-wrap gap-2">
          <Boton variante={esPortada ? 'primario' : 'secundario'} className="min-h-9! px-3!" disabled={esPortada} ocupado={portada.isPending} onClick={() => portada.mutate(undefined)}>
            {esPortada ? 'Portada' : 'Usar de portada'}
          </Boton>
          <Boton
            variante="peligro"
            className="min-h-9! px-3!"
            ocupado={borrar.isPending}
            onClick={() => confirm('¿Borrar esta foto? Se elimina también del almacenamiento.') && borrar.mutate(undefined)}
          >
            Borrar
          </Boton>
        </div>
        <MensajeError error={cambiar.error ?? portada.error ?? borrar.error} />
      </div>
    </li>
  );
}
