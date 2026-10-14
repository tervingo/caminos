// Portada provisional: comprueba el API y lista los tramos. La web pública llega en la fase 2.
import { useQuery } from '@tanstack/react-query';
import { healthSchema, tramoResumenSchema } from '@caminos/shared';

async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return healthSchema.parse(await res.json());
}

async function fetchTramos() {
  const res = await fetch('/api/tramos');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return tramoResumenSchema.array().parse(await res.json());
}

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
  const tramos = useQuery({ queryKey: ['tramos'], queryFn: fetchTramos, retry: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-gris">Camino de Santiago</p>
      <h1 className="mt-2 font-serif text-5xl text-bosque">Nuestro Camino</h1>
      <p className="mt-4 font-serif text-xl text-musgo">Un tramo cada año. Muy pronto, aquí.</p>

      <ul className="mt-10 space-y-3">
        {tramos.isError && <li className="text-red-700">No se pudieron cargar los tramos ({tramos.error.message})</li>}
        {tramos.data?.map((t) => (
          <li key={t.slug} className="flex items-baseline gap-3 border-b border-linea pb-3">
            <span className="font-serif text-2xl text-tinta">{t.anio}</span>
            <span className="text-tinta">{t.titulo}</span>
            <span className="ml-auto text-sm font-medium" style={{ color: t.camino.color }}>
              {t.camino.nombre} · {t.kmTotal} km
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-12 border-t border-linea pt-6 text-sm text-gris">
        <span className="font-medium text-tinta">Estado del API: </span>
        {health.isPending && 'comprobando…'}
        {health.isError && <span className="text-red-700">sin conexión ({health.error.message})</span>}
        {health.isSuccess && (
          <span className="text-bosque">
            en marcha · base de datos: {health.data.db} · {health.data.time}
          </span>
        )}
      </section>
    </main>
  );
}
