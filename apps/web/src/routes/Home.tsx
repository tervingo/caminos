import { useSearchParams } from 'react-router';
import type { TramoResumen } from '@caminos/shared';
import { YearCard } from '../components/YearCard';
import { Aviso, Cifra, CONTENEDOR, TITULO_SECCION } from '../components/ui';
import { useTramos } from '../lib/consultas';
import { numeroKm } from '../lib/formato';

function resumen(tramos: TramoResumen[]) {
  const caminos = new Map(tramos.map((t) => [t.camino.slug, t.camino]));
  return {
    km: tramos.reduce((suma, t) => suma + t.kmTotal, 0),
    anios: new Set(tramos.map((t) => t.anio)).size,
    primerAnio: tramos.length > 0 ? Math.min(...tramos.map((t) => t.anio)) : null,
    caminos: [...caminos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

export function Home() {
  const { data, isPending, isError } = useTramos();
  const [params, setParams] = useSearchParams();

  // Del más antiguo al más reciente, como en el mock-up
  const tramos = [...(data ?? [])].sort((a, b) => a.anio - b.anio || a.slug.localeCompare(b.slug));
  const r = resumen(tramos);
  const filtro = r.caminos.some((c) => c.slug === params.get('camino')) ? params.get('camino') : null;
  const visibles = tramos.filter((t) => !filtro || t.camino.slug === filtro);
  const elegir = (slug: string | null) =>
    setParams(slug ? { camino: slug } : {}, { replace: true, preventScrollReset: true });

  const chips = [{ slug: null, label: 'Todos' }, ...r.caminos.map((c) => ({ slug: c.slug, label: c.nombre.replace(/^Camino /, '') }))];

  return (
    <>
      <title>En Caminos</title>
      <section id="inicio" className={`${CONTENEDOR} flex flex-wrap items-end gap-12 pt-12 pb-10 sm:pt-16`}>
        <div className="min-w-0 flex-[1.4_1_460px]">
          <div className="text-[13px] font-semibold uppercase tracking-[.12em] text-bosque">
            Diario del grupo{r.primerAnio ? ` · desde ${r.primerAnio}` : ''}
          </div>
          <h1 className="mt-4 mb-5 font-serif text-[44px] leading-[1.03] font-medium tracking-[-.02em] sm:text-[64px]">
            Un tramo cada año, y cada año un camino distinto.
          </h1>
          <p className="m-0 max-w-[540px] text-lg text-musgo">
            Cada año es independiente: su recorrido sobre el mapa de la península, sus etapas, fotos, sitios y notas.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_340px] flex-wrap gap-x-8 gap-y-5 rounded-2xl border border-linea bg-white p-6">
          <Cifra grande valor={isPending ? '—' : numeroKm(r.km)} etiqueta="km caminados" />
          <Cifra grande valor={isPending ? '—' : r.anios} etiqueta="años" />
          <Cifra grande valor={isPending ? '—' : r.caminos.length} etiqueta="caminos distintos" />
        </div>
      </section>

      <section id="anos" className={`${CONTENEDOR} pb-12`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5">
          <h2 className={TITULO_SECCION}>Los años</h2>
          {r.caminos.length > 1 && (
            <div role="group" aria-label="Filtrar por Camino" className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const activo = filtro === c.slug;
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => elegir(c.slug)}
                    className={`min-h-11 cursor-pointer rounded-full border border-tinta px-4 text-sm font-semibold ${
                      activo ? 'bg-tinta text-white' : 'bg-transparent text-tinta hover:bg-white'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isError && <Aviso>No se pudieron cargar los tramos. Prueba a recargar la página en un rato.</Aviso>}
        {!isError && !isPending && tramos.length === 0 && <Aviso>Todavía no hay ningún tramo publicado.</Aviso>}
        <div className="flex flex-wrap gap-4">
          {isPending &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden="true" className="h-[230px] min-w-0 flex-[1_1_220px] animate-pulse rounded-[14px] bg-linea-suave" />
            ))}
          {visibles.map((t) => (
            <YearCard key={t.slug} tramo={t} indice={tramos.indexOf(t)} />
          ))}
        </div>
      </section>
    </>
  );
}
