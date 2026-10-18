// Cálculos del gráfico de perfil de altitud: escalas redondas, marcas sobre el perfil y punto bajo el cursor.
import type { Perfil } from '@caminos/shared';
import { distancia } from './recorridoPie';

/** Paso «bonito» (1, 2 o 5 × 10ⁿ) para que el rango quepa en unas `cuantas` divisiones */
export function pasoBonito(rango: number, cuantas: number): number {
  if (rango <= 0) return 1;
  const bruto = rango / cuantas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * potencia;
}

/** Marcas del eje de min a max con un paso dado (redondeadas al paso) */
export function marcasEje(min: number, max: number, paso: number): number[] {
  const marcas: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) marcas.push(Math.round(v * 1e6) / 1e6);
  return marcas;
}

/** Dominio de altitud con margen y en múltiplos del paso, para que el perfil no toque los bordes */
export function dominioAltitud(minima: number, maxima: number): { desde: number; hasta: number; paso: number } {
  const paso = pasoBonito(Math.max(maxima - minima, 50), 5);
  return { desde: Math.floor((minima - paso * 0.25) / paso) * paso, hasta: Math.ceil((maxima + paso * 0.25) / paso) * paso, paso };
}

/** Índice del punto del perfil más cercano a un km (los km están ordenados) */
export function indiceEnKm(perfil: Perfil, km: number): number {
  const p = perfil.puntos;
  let a = 0;
  let b = p.length - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (p[m][0] <= km) a = m;
    else b = m;
  }
  return Math.abs(p[a][0] - km) <= Math.abs(p[b][0] - km) ? a : b;
}

export interface Marca {
  nombre: string;
  lat: number;
  lon: number;
}

/** Lugares que caen junto al recorrido (a menos de `maxM`), colocados en su punto del perfil */
export function marcasEnPerfil(perfil: Perfil, marcas: Marca[], maxM = 1500): { nombre: string; indice: number }[] {
  return marcas
    .flatMap((m) => {
      let indice = -1;
      let mejor = maxM;
      perfil.puntos.forEach(([, , lat, lon], i) => {
        const d = distancia([m.lat, m.lon], [lat, lon]);
        if (d < mejor) {
          mejor = d;
          indice = i;
        }
      });
      return indice >= 0 ? [{ nombre: m.nombre, indice }] : [];
    })
    .sort((a, b) => a.indice - b.indice);
}
