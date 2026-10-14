import { useQuery } from '@tanstack/react-query';
import { healthSchema } from '@caminos/shared';
import { PruebaCookie } from './PruebaCookie';

async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return healthSchema.parse(await res.json());
}

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-gris">Camino de Santiago</p>
      <h1 className="mt-2 font-serif text-5xl text-bosque">Nuestro Camino</h1>
      <p className="mt-4 font-serif text-xl text-musgo">
        Un tramo cada año. Muy pronto, aquí.
      </p>

      <section className="mt-12 border-t border-linea pt-6 text-sm text-gris">
        <span className="font-medium text-tinta">Estado del API: </span>
        {health.isPending && 'comprobando…'}
        {health.isError && <span className="text-red-700">sin conexión ({health.error.message})</span>}
        {health.isSuccess && <span className="text-bosque">en marcha · {health.data.time}</span>}
      </section>

      <PruebaCookie />
    </main>
  );
}
