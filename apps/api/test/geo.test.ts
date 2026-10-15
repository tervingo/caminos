import { describe, expect, it } from 'vitest';
import { bboxDe, simplificar } from '../src/geo.js';

describe('simplificar', () => {
  it('quita los puntos casi alineados y conserva los extremos', () => {
    // Recta de unos 1,1 km con un punto desviado ~1 m
    const recta: [number, number][] = [
      [-4.0, 43.0],
      [-3.995, 43.00001],
      [-3.99, 43.0],
    ];
    expect(simplificar(recta)).toEqual([
      [-4.0, 43.0],
      [-3.99, 43.0],
    ]);
  });

  it('conserva las curvas que superan la tolerancia', () => {
    const curva: [number, number][] = [
      [-4.0, 43.0],
      [-3.995, 43.002], // ~220 m fuera de la recta
      [-3.99, 43.0],
    ];
    expect(simplificar(curva)).toHaveLength(3);
  });

  it('deja intactas las líneas de dos puntos', () => {
    const corta: [number, number][] = [
      [-4.0, 43.0],
      [-3.99, 43.0],
    ];
    expect(simplificar(corta)).toEqual(corta);
  });
});

describe('bboxDe', () => {
  it('calcula el recuadro en orden GeoJSON', () => {
    expect(
      bboxDe([
        [-4.4, 43.38],
        [-4.53, 43.25],
      ]),
    ).toEqual([-4.53, 43.25, -4.4, 43.38]);
    expect(bboxDe([])).toBeNull();
  });
});
