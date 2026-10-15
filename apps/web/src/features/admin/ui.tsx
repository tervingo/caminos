// Elementos de formulario del editor, con el estilo del mock-up D.
import { type ButtonHTMLAttributes, type ReactNode, useId } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../../lib/api';

export const INPUT =
  'w-full min-h-11 rounded-[10px] border border-borde bg-white px-3 text-[15px] text-tinta outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/25 aria-[invalid=true]:border-red-700';

export const TEXTAREA = `${INPUT} py-2.5 leading-normal`;

type Variante = 'primario' | 'secundario' | 'peligro' | 'sutil';

const VARIANTES: Record<Variante, string> = {
  primario: 'border-2 border-tinta bg-tinta text-white hover:bg-pizarra',
  secundario: 'border-2 border-tinta bg-white text-tinta hover:bg-papel',
  peligro: 'border-2 border-red-800 bg-white text-red-800 hover:bg-red-50',
  sutil: 'border-0 bg-transparent text-bosque underline-offset-2 hover:underline px-1!',
};

export function Boton({
  variante = 'secundario',
  className = '',
  ocupado = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; ocupado?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || ocupado}
      aria-busy={ocupado || undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {ocupado ? 'Guardando…' : children}
    </button>
  );
}

/** Etiqueta, control y mensaje de error. El control recibe id y aria-* con la función hija. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  className = '',
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const idNota = `${id}-nota`;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {etiqueta}
      </label>
      {children({ id, 'aria-invalid': !!error, ...((error || ayuda) && { 'aria-describedby': idNota }) })}
      {(error || ayuda) && (
        <span id={idNota} className={`text-[13px] ${error ? 'text-red-800' : 'text-gris'}`}>
          {error ?? ayuda}
        </span>
      )}
    </div>
  );
}

export function Seccion({ id, titulo, accion, children }: { id: string; titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="mt-10 rounded-2xl border border-linea bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-titulo`} className="m-0 font-serif text-[26px] font-medium">
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function MensajeError({ error }: { error: unknown }) {
  if (!error) return null;
  const texto = error instanceof Error ? error.message : 'Algo ha fallado';
  return (
    <p role="alert" className="m-0 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {texto}
    </p>
  );
}

/** Lleva los errores por campo del API a React Hook Form; devuelve si había alguno */
export function erroresDelApi<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!(error instanceof ApiError) || error.campos.length === 0) return false;
  for (const c of error.campos) setError(c.campo as Path<T>, { message: c.mensaje });
  return true;
}

/** '' → null, '12,5' → 12.5; para campos numéricos opcionales */
export function numeroOpcional(valor: unknown): number | null {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
