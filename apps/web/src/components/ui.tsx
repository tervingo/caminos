// Piezas pequeñas que se repiten en varias páginas.
import type { ReactNode } from 'react';

/** Ancho máximo y márgenes laterales de todas las secciones */
export const CONTENEDOR = 'mx-auto w-full max-w-[1200px] px-4 sm:px-8';

/** Título de sección en serif (h2 del mock-up) */
export const TITULO_SECCION = 'm-0 font-serif text-[30px] font-medium sm:text-4xl';

/** Rótulo en versalitas pequeñas (h3 del mock-up) */
export const ROTULO = 'text-[13px] font-semibold uppercase tracking-[.12em]';

export function Cifra({ valor, etiqueta, grande = false }: { valor: ReactNode; etiqueta: string; grande?: boolean }) {
  return (
    <div>
      <div className={`font-serif font-semibold leading-none ${grande ? 'text-5xl' : 'text-[32px] sm:text-[40px]'}`}>{valor}</div>
      <div className="text-sm text-gris">{etiqueta}</div>
    </div>
  );
}

export function PuntoCamino({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Valoración de 1 a 5: ★★★★☆ */
export function Estrellas({ valor }: { valor: number }) {
  return (
    <span role="img" aria-label={`Valoración: ${valor} de 5`} className="tracking-[.05em] text-ambar">
      {'★'.repeat(valor)}
      <span className="text-linea">{'★'.repeat(5 - valor)}</span>
    </span>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-[14px] border border-linea bg-white px-5 py-4 text-musgo">{children}</p>;
}
