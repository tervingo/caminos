import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
 * de ninguna etapa del Camino. En el orden en que se ven en la web: se reordenan arrastrándolas o
 * escribiendo su nueva posición (para saltos largos en etapas con muchas fotos).
 */
export function FotosEditor({ tramo, etapa }: { tramo: TramoEditor; etapa?: Etapa }) {
  const [cola, setCola] = useState<EnCola[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const subir = useCambio(
    async (a: { archivo: File; avisar: (f: FaseSubida) => void }) =>
      (await subirFoto(tramo.id, tramo.etapas, a.archivo, a.avisar, etapa?.id)).tramo,
  );
  const ordenar = useCambio((ids: string[]) => editar('PUT', `/api/admin/tramos/${tramo.id}/fotos/orden`, { ids }));
  // Orden provisional mientras se guarda, para que la foto no «salte» de vuelta al soltarla
  const [provisional, setProvisional] = useState<string[] | null>(null);
  // Modo «Ordenar»: solo miniaturas pequeñas, para ver muchas a la vez y moverlas de un vistazo
  const [ordenando, setOrdenando] = useState(false);

  const idsEtapas = new Set(tramo.etapas.map((e) => e.id));
  const delGrupo = etapa
    ? tramo.fotos.filter((f) => f.etapaId === etapa.id)
    : tramo.fotos.filter((f) => !f.etapaId || !idsEtapas.has(f.etapaId));
  const porId = new Map(delGrupo.map((f) => [f.id, f]));
  const fotos = provisional ? provisional.flatMap((id) => porId.get(id) ?? []) : delGrupo;
  const ids = fotos.map((f) => f.id);

  const mover = (desde: number, hasta: number) => {
    if (desde === hasta || hasta < 0 || hasta >= ids.length) return;
    const nuevo = arrayMove(ids, desde, hasta);
    setProvisional(nuevo);
    ordenar.mutate(nuevo, { onSettled: () => setProvisional(null) });
  };

  const sensores = useSensors(
    // Con ratón, se arrastra tras moverse unos píxeles (un clic normal no arrastra)
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Con el dedo, tras mantener pulsado un momento, para no impedir el desplazamiento de la página
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) mover(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  const actualizar = (clave: string, cambio: Partial<EnCola>) =>
    setCola((c) => c.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));

  const anadir = async (archivos: File[]) => {
    const nuevos = archivos.map((archivo, i) => ({ archivo, clave: `${Date.now()}-${i}-${archivo.name}` }));
    setCola((c) => [
      ...c.filter((x) => x.estado !== 'hecha'),
      ...nuevos.map(({ clave, archivo }) => ({ clave, nombre: archivo.name, estado: 'esperando' as const })),
    ]);
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
        <>
          {fotos.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[13px] text-gris">
                {ordenando
                  ? 'Arrastra las miniaturas para cambiar el orden; se guarda al soltar.'
                  : 'Arrastra una foto por su asa ⠿ para cambiarla de sitio, o pulsa su número y escribe a qué posición va.'}
              </p>
              <Boton variante={ordenando ? 'primario' : 'secundario'} className="min-h-9! px-4!" onClick={() => setOrdenando(!ordenando)}>
                {ordenando ? 'Terminar de ordenar' : 'Ordenar'}
              </Boton>
            </div>
          )}
          <DndContext
            sensors={sensores}
            collisionDetection={closestCenter}
            onDragEnd={alSoltar}
            accessibility={{ announcements: anuncios(ids), screenReaderInstructions: { draggable: INSTRUCCIONES } }}
          >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              {ordenando ? (
                <ul aria-label="Orden de las fotos" className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-6 lg:grid-cols-8">
                  {fotos.map((f, i) => (
                    <Miniatura key={f.id} foto={f} posicion={i + 1} />
                  ))}
                </ul>
              ) : (
                <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {fotos.map((f, i) => (
                    <FotoFicha
                      key={f.id}
                      tramo={tramo}
                      foto={f}
                      posicion={i + 1}
                      total={fotos.length}
                      onMoverA={(hasta) => mover(i, hasta - 1)}
                    />
                  ))}
                </ul>
              )}
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

const INSTRUCCIONES =
  'Para mover una foto, pulsa espacio o intro sobre su asa, usa las flechas para llevarla a su sitio y vuelve a pulsar espacio o intro para dejarla. Escape cancela.';

/** Avisos para lectores de pantalla, en español */
function anuncios(ids: string[]): Announcements {
  const pos = (id: string | number) => ids.indexOf(String(id)) + 1;
  return {
    onDragStart: ({ active }) => `Has cogido la foto ${pos(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Sobre la posición ${pos(over.id)}.` : 'Fuera de la lista.'),
    onDragEnd: ({ over }) => (over ? `Foto dejada en la posición ${pos(over.id)}.` : 'Foto dejada en su sitio.'),
    onDragCancel: () => 'Movimiento cancelado; la foto vuelve a su sitio.',
  };
}

/** Miniatura del modo «Ordenar»: se arrastra entera (no tiene campos que editar) */
function Miniatura({ foto, posicion }: { foto: FotoEditor; posicion: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: foto.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-80' : ''}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Foto ${posicion}${foto.pie ? `: ${foto.pie}` : ''}. Arrástrala para moverla`}
        className={`relative block aspect-square w-full cursor-grab touch-none overflow-hidden rounded-lg border-2 bg-linea-suave p-0 active:cursor-grabbing ${
          isDragging ? 'border-ocre shadow-xl' : 'border-transparent hover:border-borde'
        }`}
      >
        <img src={foto.urlMini} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
        <span className="absolute top-1 left-1 rounded-full bg-tinta/80 px-1.5 text-[11px] font-semibold text-white tabular-nums">
          {posicion}
        </span>
      </button>
    </li>
  );
}

interface PropsFicha {
  tramo: TramoEditor;
  foto: FotoEditor;
  posicion: number;
  total: number;
  /** Lleva la foto a la posición dada (1…total) */
  onMoverA: (posicion: number) => void;
}

function FotoFicha({ tramo, foto, posicion, total, onMoverA }: PropsFicha) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: foto.id });
  const [escribiendo, setEscribiendo] = useState(false);
  const [pie, setPie] = useState(foto.pie ?? '');
  const cambiar = useCambio((datos: object) => editar('PATCH', `/api/admin/fotos/${foto.id}`, datos));
  const portada = useCambio(() => editar('PATCH', `/api/admin/tramos/${tramo.id}`, { portadaFotoId: foto.id }));
  const borrar = useCambio(() => editar('DELETE', `/api/admin/fotos/${foto.id}`));
  const esPortada = tramo.portadaFotoId === foto.id;
  const fecha = foto.tomadaEn ? new Date(foto.tomadaEn).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col overflow-hidden rounded-[14px] border-2 bg-white ${esPortada ? 'border-ocre' : 'border-linea'} ${
        isDragging ? 'relative z-10 opacity-80 shadow-xl' : ''
      }`}
    >
      <div className="relative">
        <img
          src={foto.urlMini}
          alt={foto.pie ?? ''}
          width={foto.ancho}
          height={foto.alto}
          loading="lazy"
          className="aspect-[3/2] w-full bg-linea-suave object-cover"
        />
        {/* El número de posición: pulsarlo permite escribir a dónde va la foto */}
        {escribiendo ? (
          <input
            type="number"
            min={1}
            max={total}
            autoFocus
            defaultValue={posicion}
            aria-label={`Nueva posición de la foto ${posicion} (de 1 a ${total})`}
            onBlur={() => setEscribiendo(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEscribiendo(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                const n = Math.round(Number(e.currentTarget.value));
                if (n >= 1 && n <= total) onMoverA(n);
                setEscribiendo(false);
              }
            }}
            className="absolute top-2 left-2 w-16 rounded-full border-2 border-ocre bg-white px-2 py-0.5 text-sm font-semibold tabular-nums"
          />
        ) : (
          <button
            type="button"
            disabled={total < 2}
            title={total > 1 ? 'Cambiar de posición' : undefined}
            aria-label={`Posición ${posicion} de ${total}${total > 1 ? '; pulsa para cambiarla' : ''}`}
            onClick={() => setEscribiendo(true)}
            className="absolute top-2 left-2 cursor-pointer rounded-full border-0 bg-tinta/80 px-2 py-0.5 text-xs font-semibold text-white tabular-nums hover:bg-tinta disabled:cursor-default"
          >
            {posicion}
          </button>
        )}
        {total > 1 && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar la foto ${posicion}`}
            className="absolute top-2 right-2 flex size-9 cursor-grab touch-none items-center justify-center rounded-full border-0 bg-white/90 text-lg text-tinta shadow active:cursor-grabbing"
          >
            ⠿
          </button>
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
            <span className="inline-flex min-h-9 items-center rounded-full bg-ocre px-3 text-sm font-semibold text-tinta">
              ★ Es la portada
            </span>
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
