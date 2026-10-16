import type { Etapa, Foto } from '@caminos/shared';

export interface FotosDeEtapa {
  etapa: Etapa;
  /** Número de la etapa (1, 2, 3…) */
  numero: number;
  fotos: Foto[];
}

/** Reparte las fotos por etapa del Camino; las que no tienen etapa (o son de la ida o la vuelta) van a «otras» */
export function fotosPorEtapa(etapas: Etapa[], fotos: Foto[]): { etapas: FotosDeEtapa[]; otras: Foto[] } {
  const porEtapa = new Map<string, Foto[]>();
  for (const f of fotos) if (f.etapaId) porEtapa.set(f.etapaId, [...(porEtapa.get(f.etapaId) ?? []), f]);
  const ids = new Set(etapas.map((e) => e.id));
  return {
    etapas: etapas.map((etapa, i) => ({ etapa, numero: i + 1, fotos: porEtapa.get(etapa.id) ?? [] })),
    otras: fotos.filter((f) => !f.etapaId || !ids.has(f.etapaId)),
  };
}

/** Unas pocas fotos repartidas por todo el tramo, para la franja de la página del año */
export function muestraDeFotos(fotos: Foto[], cuantas = 6): Foto[] {
  if (fotos.length <= cuantas) return fotos;
  return Array.from({ length: cuantas }, (_, i) => fotos[Math.round((i * (fotos.length - 1)) / (cuantas - 1))]);
}
