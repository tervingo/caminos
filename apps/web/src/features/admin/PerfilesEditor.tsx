import type { TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { Boton, MensajeError } from './ui';

/**
 * Perfiles de altitud: se calculan solos al calcular la ruta o guardar el recorrido a pie. Este botón los
 * (re)calcula para todas las etapas a la vez: útil para las que ya existían o si falló el servicio de altitudes.
 */
export function PerfilesEditor({ tramo }: { tramo: TramoEditor }) {
  const calcular = useCambio(() => editar('POST', `/api/admin/tramos/${tramo.id}/perfiles`));
  const conLinea = tramo.etapas.filter((e) => e.trazaPie || e.traza);
  const conPerfil = tramo.etapas.filter((e) => e.perfil);
  if (conLinea.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-linea bg-papel/60 p-4">
      <div className="min-w-0 flex-[1_1_280px]">
        <h3 className="m-0 text-sm font-semibold">Perfiles de altitud</h3>
        <p className="mt-1 mb-0 text-[13px] text-gris">
          {conPerfil.length} de {tramo.etapas.length} etapas tienen perfil. Se calculan sobre el recorrido a pie (o, si no lo hay, la ruta
          por carretera) y de ahí salen la subida y la bajada.
        </p>
      </div>
      <Boton ocupado={calcular.isPending} onClick={() => calcular.mutate(undefined)}>
        {conPerfil.length > 0 ? 'Recalcular los perfiles' : 'Calcular los perfiles'}
      </Boton>
      <div className="basis-full empty:hidden">
        <MensajeError error={calcular.error} />
      </div>
    </div>
  );
}
