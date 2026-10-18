import { describe, expect, it } from 'vitest';
import type { Perfil } from '@caminos/shared';
import { dominioAltitud, indiceEnKm, marcasEje, marcasEnPerfil, pasoBonito } from './perfil';

// Diez puntos hacia el norte, uno cada ~1,1 km, subiendo de 500 a 1.400 m
const perfil: Perfil = {
  origen: 'terreno',
  puntos: Array.from({ length: 10 }, (_, i): [number, number, number, number] => [i * 1.11, 500 + i * 100, 43 + i * 0.01, -4]),
  subida: 900,
  bajada: 0,
  minima: 500,
  maxima: 1400,
};

describe('gráfico de perfil', () => {
  it('usa pasos redondos en los ejes', () => {
    expect(pasoBonito(18.9, 6)).toBe(5);
    expect(pasoBonito(900, 4)).toBe(500);
    expect(pasoBonito(9.9, 6)).toBe(2);
    expect(marcasEje(0, 18.9, 5)).toEqual([0, 5, 10, 15]);
  });

  it('deja margen arriba y abajo en múltiplos del paso', () => {
    expect(dominioAltitud(540, 1460)).toEqual({ desde: 400, hasta: 1600, paso: 200 });
    expect(dominioAltitud(1200, 1230)).toEqual({ desde: 1190, hasta: 1240, paso: 10 });
  });

  it('encuentra el punto más cercano a un km', () => {
    expect(indiceEnKm(perfil, 0)).toBe(0);
    expect(indiceEnKm(perfil, 3.4)).toBe(3);
    expect(indiceEnKm(perfil, 3.0)).toBe(3);
    expect(indiceEnKm(perfil, 99)).toBe(9);
  });

  it('coloca los lugares cercanos al recorrido y descarta los lejanos', () => {
    const marcas = marcasEnPerfil(perfil, [
      { nombre: 'Mirador', lat: 43.0505, lon: -4.0005 },
      { nombre: 'Pueblo', lat: 43.0198, lon: -4 },
      { nombre: 'Lejos', lat: 43.05, lon: -4.2 },
    ]);
    expect(marcas).toEqual([
      { nombre: 'Pueblo', indice: 2 },
      { nombre: 'Mirador', indice: 5 },
    ]);
  });
});
