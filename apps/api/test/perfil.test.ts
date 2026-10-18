import { describe, expect, it } from 'vitest';
import { desniveles, perfilDe } from '@caminos/shared';

describe('perfil de altitud', () => {
  it('acumula subida y bajada ignorando el ruido de menos de 3 m', () => {
    expect(desniveles([100, 101, 100, 102, 110, 108, 120, 100])).toEqual({ subida: 20, bajada: 20 });
    expect(desniveles([500, 502, 501, 503, 500])).toEqual({ subida: 3, bajada: 3 });
  });

  it('calcula distancia acumulada, extremos y conserva el último punto', () => {
    // Recta de unos 11 km hacia el norte subiendo de 100 a 600 m
    const coords = Array.from({ length: 101 }, (_, i): [number, number, number] => [-4, 43 + i * 0.001, 100 + i * 5]);
    const p = perfilDe(coords)!;
    expect(p.puntos[0]).toEqual([0, 100, 43, -4]);
    expect(p.puntos.at(-1)![0]).toBeCloseTo(11.1, 1);
    expect(p.puntos.at(-1)![1]).toBe(600);
    expect(p).toMatchObject({ subida: 500, bajada: 0, minima: 100, maxima: 600 });
  });

  it('se queda en 300 puntos como mucho', () => {
    const coords = Array.from({ length: 5000 }, (_, i): [number, number, number] => [-4, 43 + i * 0.0001, 100 + Math.sin(i / 50) * 50]);
    const p = perfilDe(coords)!;
    expect(p.puntos).toHaveLength(300);
    const km = p.puntos.map((x) => x[0]);
    expect(km).toEqual([...km].sort((a, b) => a - b));
  });

  it('no hay perfil sin al menos dos puntos distintos', () => {
    expect(perfilDe([[-4, 43, 100]])).toBeNull();
    expect(perfilDe([[-4, 43, 100], [-4, 43, 100]])).toBeNull();
  });
});
