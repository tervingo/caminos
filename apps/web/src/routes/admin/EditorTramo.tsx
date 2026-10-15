import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { TramoEditor } from '@caminos/shared';
import { MapaDiferido } from '../../components/TripMap/MapaDiferido';
import { Aviso, CONTENEDOR } from '../../components/ui';
import { DatosTramo } from '../../features/admin/DatosTramo';
import { EtapasEditor } from '../../features/admin/EtapasEditor';
import { FotosEditor } from '../../features/admin/FotosEditor';
import { NotasEditor } from '../../features/admin/NotasEditor';
import { Boton, MensajeError, Seccion } from '../../features/admin/ui';
import { ApiError } from '../../lib/api';
import { editar, useBorrarTramo, useCambio, useTramoEditor } from '../../lib/admin';
import { desnivel, numeroKm, plural } from '../../lib/formato';
import { NotFound } from '../NotFound';
import { EstadoTramo } from './AdminHome';

const SECCIONES = [
  ['datos', 'Datos'],
  ['etapas', 'Etapas'],
  ['fotos', 'Fotos'],
  ['notas', 'Notas'],
] as const;

export function EditorTramo() {
  const { id = '' } = useParams();
  const { data: tramo, isPending, error } = useTramoEditor(id);

  if (isPending) return <div className={`${CONTENEDOR} pt-12 text-gris`}>Cargando el tramo…</div>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFound mensaje="No existe ese tramo." />;
    return (
      <div className={`${CONTENEDOR} pt-12`}>
        <Aviso>No se pudo cargar el tramo.</Aviso>
      </div>
    );
  }
  return <Editor tramo={tramo} />;
}

function Editor({ tramo }: { tramo: TramoEditor }) {
  const navigate = useNavigate();
  const [etapaMapa, setEtapaMapa] = useState<number | null>(null);
  const publicar = useCambio((si: boolean) => editar('POST', `/api/admin/tramos/${tramo.id}/${si ? 'publicar' : 'despublicar'}`));
  const borrar = useBorrarTramo();
  const publicado = tramo.estado === 'publicado';

  return (
    <div className={`${CONTENEDOR} pt-8`}>
      <title>{`Editar ${tramo.anio} · ${tramo.titulo} · Nuestro Camino`}</title>
      <Link to="/admin" className="text-sm font-semibold text-bosque">
        ← Todos los tramos
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <EstadoTramo estado={tramo.estado} />
          <h1 className="mt-2 mb-1 font-serif text-[36px] leading-tight font-medium sm:text-[44px]">
            {tramo.anio} · {tramo.titulo}
          </h1>
          <p className="m-0 text-sm text-gris">
            {tramo.camino.nombre} · {numeroKm(tramo.kmTotal)} km · {plural(tramo.etapas.length, 'etapa')}
            {tramo.desnivelPosTotal > 0 && ` · ${desnivel(tramo.desnivelPosTotal)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/tramos/${tramo.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-tinta px-5 text-sm font-semibold hover:no-underline"
          >
            {publicado ? 'Ver en la web' : 'Vista previa'}
          </Link>
          <Boton variante={publicado ? 'secundario' : 'primario'} ocupado={publicar.isPending} onClick={() => publicar.mutate(!publicado)}>
            {publicado ? 'Pasar a borrador' : 'Publicar'}
          </Boton>
        </div>
      </div>
      <MensajeError error={publicar.error} />

      <nav aria-label="Secciones del editor" className="sticky top-0 z-[1100] -mx-4 mt-6 flex gap-5 overflow-x-auto border-b border-linea bg-papel/95 px-4 py-3 text-sm font-semibold backdrop-blur sm:mx-0 sm:px-0">
        {SECCIONES.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <Seccion id="datos" titulo="Datos del tramo">
        <DatosTramo tramo={tramo} />
      </Seccion>

      <Seccion id="etapas" titulo="Etapas">
        {tramo.etapas.some((e) => e.traza || e.origen) && (
          <div className="mb-5">
            <MapaDiferido
              tramo={tramo}
              otros={[]}
              etapa={etapaMapa}
              onEtapa={setEtapaMapa}
              vista="tramo"
              onVista={() => {}}
              foco={null}
            />
          </div>
        )}
        <EtapasEditor tramo={tramo} />
      </Seccion>

      <Seccion id="fotos" titulo="Fotos">
        <FotosEditor tramo={tramo} />
      </Seccion>

      <Seccion id="notas" titulo="Notas del año">
        <NotasEditor tramo={tramo} />
      </Seccion>

      <section aria-labelledby="peligro" className="mt-10 rounded-2xl border-2 border-red-200 p-5">
        <h2 id="peligro" className="m-0 mb-2 text-base font-semibold text-red-900">
          Borrar el tramo
        </h2>
        <p className="mt-0 mb-3 text-sm text-musgo">Se borran sus etapas, lugares, notas y fotos. No se puede deshacer.</p>
        <Boton
          variante="peligro"
          ocupado={borrar.isPending}
          onClick={() => {
            const respuesta = prompt(`Para borrar el tramo escribe su año (${tramo.anio}):`);
            if (respuesta?.trim() === String(tramo.anio)) borrar.mutate(tramo.id, { onSuccess: () => navigate('/admin', { replace: true }) });
          }}
        >
          Borrar tramo
        </Boton>
        <MensajeError error={borrar.error} />
      </section>
    </div>
  );
}
