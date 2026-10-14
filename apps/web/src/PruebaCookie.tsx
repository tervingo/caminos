// Prueba de la fase 0: la cookie httpOnly debe sobrevivir al proxy de Netlify.
// Temporal: se borrará con el login real.
import { useMutation } from '@tanstack/react-query';
import { cookiePruebaSchema } from '@caminos/shared';

async function llamar(method: 'POST' | 'GET') {
  const res = await fetch('/api/prueba/cookie', { method, credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return cookiePruebaSchema.parse(await res.json());
}

async function probar() {
  const puesta = await llamar('POST');
  const leida = await llamar('GET');
  return { ok: leida.recibida && leida.valor === puesta.valor, puesta, leida };
}

export function PruebaCookie() {
  const prueba = useMutation({ mutationFn: probar });

  return (
    <section className="mt-6 border-t border-linea pt-6 text-sm text-gris">
      <button
        type="button"
        onClick={() => prueba.mutate()}
        disabled={prueba.isPending}
        className="rounded-full bg-bosque px-4 py-2 font-medium text-papel hover:bg-tinta disabled:opacity-60"
      >
        Probar cookie
      </button>
      <p className="mt-3" aria-live="polite">
        {prueba.isPending && 'Probando…'}
        {prueba.isError && <span className="text-red-700">Error: {prueba.error.message}</span>}
        {prueba.isSuccess &&
          (prueba.data.ok ? (
            <span className="text-bosque">Cookie guardada y devuelta ({prueba.data.leida.valor})</span>
          ) : (
            <span className="text-red-700">
              La cookie no volvió al API (enviada {prueba.data.puesta.valor}, recibida{' '}
              {prueba.data.leida.valor ?? 'nada'})
            </span>
          ))}
      </p>
    </section>
  );
}
