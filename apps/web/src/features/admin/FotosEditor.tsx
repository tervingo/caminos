import { useState } from 'react';
import type { Etapa, FotoEditor, TramoEditor } from '@caminos/shared';
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

/**
 * Fotos de una etapa (las que se suben aquí van a esa etapa) o, sin etapa, las «otras»: las que no son
 * de ninguna etapa del Camino. En el orden en que se ven en la web, con flechas para moverlas.
 */
export function FotosEditor({ tramo, etapa }: { tramo: TramoEditor; etapa?: Etapa }) {
  const [cola, setCola] = useState<EnCola[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const subir = useCambio(async (a: { archivo: File; avisar: (f: FaseSubida) => void }) =>
    (await subirFoto(tramo.id, tramo.etapas, a.archivo, a.avisar, etapa?.id)).tramo,
  );
  const ordenar = useCambio((ids: string[]) => editar('PUT', `/api/admin/tramos/${tramo.id}/fotos/orden`, { ids }));

  const idsEtapas = new Set(tramo.etapas.map((e) => e.id));
  const fotos = etapa
    ? tramo.fotos.filter((f) => f.etapaId === etapa.id)
    : tramo.fotos.filter((f) => !f.etapaId || !idsEtapas.has(f.etapaId));
  const mover = (i: number, paso: number) => {
    const ids = fotos.map((f) => f.id);
    [ids[i], ids[i + paso]] = [ids[i + paso], ids[i]];
    ordenar.mutate(ids);
  };

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
        <span className="font-semibold">+ Subir fotos{etapa ? ' de esta etapa' : ''}</span>
        <span className="text-sm text-gris">
          Arrástralas aquí o pulsa para elegirlas (JPEG, PNG o WebP). Se reducen en tu navegador
          {etapa ? ' y se añaden al final de esta etapa.' : '. Si su fecha coincide con la de una etapa, van a esa etapa.'}
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

      <MensajeError error={ordenar.error} />
      {fotos.length === 0 ? (
        <p className="m-0 text-sm text-musgo">{etapa ? 'Todavía no hay fotos de esta etapa.' : 'No hay fotos fuera de las etapas.'}</p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {fotos.map((f, i) => (
            <FotoFicha
              key={f.id}
              tramo={tramo}
              foto={f}
              posicion={i + 1}
              // Las flechas mueven la foto dentro de su grupo, en el orden en que se ve en la web
              onMover={fotos.length > 1 ? (paso) => mover(i, paso) : undefined}
              primera={i === 0}
              ultima={i === fotos.length - 1}
              moviendo={ordenar.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PropsFicha {
  tramo: TramoEditor;
  foto: FotoEditor;
  posicion: number;
  onMover?: (paso: -1 | 1) => void;
  primera: boolean;
  ultima: boolean;
  moviendo: boolean;
}

function FotoFicha({ tramo, foto, posicion, onMover, primera, ultima, moviendo }: PropsFicha) {
  const [pie, setPie] = useState(foto.pie ?? '');
  const cambiar = useCambio((datos: object) => editar('PATCH', `/api/admin/fotos/${foto.id}`, datos));
  const portada = useCambio(() => editar('PATCH', `/api/admin/tramos/${tramo.id}`, { portadaFotoId: foto.id }));
  const borrar = useCambio(() => editar('DELETE', `/api/admin/fotos/${foto.id}`));
  const esPortada = tramo.portadaFotoId === foto.id;
  const fecha = foto.tomadaEn ? new Date(foto.tomadaEn).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

  return (
    <li className={`flex flex-col overflow-hidden rounded-[14px] border-2 ${esPortada ? 'border-ocre' : 'border-linea'}`}>
      <div className="relative">
        <img src={foto.urlMini} alt={foto.pie ?? ''} width={foto.ancho} height={foto.alto} loading="lazy" className="aspect-[3/2] w-full bg-linea-suave object-cover" />
        <span className="absolute top-2 left-2 rounded-full bg-tinta/80 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">{posicion}</span>
        {onMover && (
          <span className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              aria-label={`Mover la foto ${posicion} antes`}
              disabled={primera || moviendo}
              onClick={() => onMover(-1)}
              className="size-9 cursor-pointer rounded-full border-0 bg-white/90 text-lg font-semibold text-tinta shadow disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              aria-label={`Mover la foto ${posicion} después`}
              disabled={ultima || moviendo}
              onClick={() => onMover(1)}
              className="size-9 cursor-pointer rounded-full border-0 bg-white/90 text-lg font-semibold text-tinta shadow disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </span>
        )}
      </div>
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
          {/* La portada es la foto de la tarjeta del año; la primera que se sube lo es hasta que se elija otra */}
          {esPortada ? (
            <span className="inline-flex min-h-9 items-center rounded-full bg-ocre px-3 text-sm font-semibold text-tinta">★ Es la portada</span>
          ) : (
            <Boton className="min-h-9! px-3!" ocupado={portada.isPending} onClick={() => portada.mutate(undefined)}>
              Usar de portada
            </Boton>
          )}
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
