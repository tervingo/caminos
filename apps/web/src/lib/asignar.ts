import type { Etapa } from '@caminos/shared';

/**
 * Fecha 'AAAA-MM-DD' en hora local. Las fechas EXIF no llevan zona horaria y exifr las lee
 * como hora local, así que el día local es el día en que se hizo la foto.
 */
export function fechaLocal(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Etapa que se caminó el día de la foto; si no hay ninguna (o hay varias), ninguna */
export function etapaDeFecha(etapas: Pick<Etapa, 'id' | 'fecha'>[], tomadaEn: Date | null): string | null {
  if (!tomadaEn) return null;
  const dia = fechaLocal(tomadaEn);
  const candidatas = etapas.filter((e) => e.fecha === dia);
  return candidatas.length === 1 ? candidatas[0].id : null;
}
