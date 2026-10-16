// Formato de fechas y cifras en español. Las fechas llegan como 'AAAA-MM-DD' y se leen
// a mano para que la zona horaria del navegador no mueva el día.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio, mes: MESES[mes - 1], dia };
}

/** '2023-09-08' → '8 sep' */
export function fechaCorta(fecha: string): string {
  const { dia, mes } = partes(fecha);
  return `${dia} ${mes}`;
}

/** '2023-09-08' → '8 sep 2023' */
export function fechaLarga(fecha: string): string {
  const { dia, mes, anio } = partes(fecha);
  return `${dia} ${mes} ${anio}`;
}

/** '8–10 sep 2023', '28 ago – 3 sep 2023' o '30 dic 2023 – 2 ene 2024' */
export function rangoFechas(inicio: string | null, fin: string | null): string | null {
  if (!inicio || !fin || inicio === fin) {
    const unica = inicio ?? fin;
    return unica ? fechaLarga(unica) : null;
  }
  const a = partes(inicio);
  const b = partes(fin);
  if (a.anio !== b.anio) return `${fechaLarga(inicio)} – ${fechaLarga(fin)}`;
  if (a.mes !== b.mes) return `${a.dia} ${a.mes} – ${b.dia} ${b.mes} ${b.anio}`;
  return `${a.dia}–${b.dia} ${b.mes} ${b.anio}`;
}

// es-ES no agrupa los números de cuatro cifras salvo con useGrouping: 'always'
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' });

/** 68 → '68'; 12.46 → '12,5'; 1234 → '1.234' */
export function numeroKm(km: number): string {
  return decimal.format(km);
}

/** 1700 → '+1.700 m' */
export function desnivel(metros: number): string {
  return `+${entero.format(metros)} m`;
}

/** Km de una etapa: los del recorrido a pie si los hay; si no, los de la ruta */
export function kmEtapa(etapa: { kmPie: number | null; km: number | null }): number | null {
  return etapa.kmPie ?? etapa.km;
}

/** 2 → '€€' */
export function precio(nivel: number | null): string {
  return nivel ? '€'.repeat(nivel) : '';
}

/** 1 → '1 etapa'; 3 → '3 etapas' */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
