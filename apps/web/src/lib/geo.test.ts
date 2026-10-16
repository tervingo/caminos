import { describe, expect, it } from 'vitest';
import type { Etapa } from '@caminos/shared';
import { finEtapa, inicioEtapa, limitesDeBbox, limitesDePuntos, limitesEtapa, nivelVista, separador } from './geo';

const etapa = (parcial: Partial<Etapa>): Etapa => ({
  id: '00000000-0000-4000-8000-000000000000',
  tipo: 'camino',
  posicion: 1,
  titulo: 'A → B',
  fecha: null,
  origen: null,
  destino: null,
  via: [],
  notas: null,
  km: null,
  desnivelPos: null,
  desnivelNeg: null,
  traza: null,
  trazaOrigen: 'carretera',
  bbox: null,
  trazaPie: null,
  kmPie: null,
  trazaPieFuente: null,
  sitios: [],
  ...parcial,
});

describe('límites', () => {
  it('convierte un bbox GeoJSON a [[sur, oeste], [norte, este]]', () => {
    expect(limitesDeBbox([-4.53, 43.25, -4.395, 43.384])).toEqual([
      [43.25, -4.53],
      [43.384, -4.395],
    ]);
  });

  it('calcula los límites de una lista de puntos', () => {
    expect(
      limitesDePuntos([
        [43.1, -1.2],
        [42.8, -1.6],
        [43.0, -1.3],
      ]),
    ).toEqual([
      [42.8, -1.6],
      [43.1, -1.2],
    ]);
    expect(limitesDePuntos([])).toBeNull();
  });
});

describe('etapas', () => {
  it('usa la traza, en [lat, lon], si la hay', () => {
    const e = etapa({
      traza: {
        type: 'LineString',
        coordinates: [
          [-1.238, 43.163],
          [-1.319, 43.009],
        ],
      },
    });
    expect(inicioEtapa(e)).toEqual([43.163, -1.238]);
    expect(finEtapa(e)).toEqual([43.009, -1.319]);
  });

  it('sin traza, usa origen, paradas y destino', () => {
    const e = etapa({
      origen: { nombre: 'Tui', lat: 42.046, lon: -8.644 },
      via: [{ nombre: null, lat: 42.3, lon: -8.7 }],
      destino: { nombre: 'O Porriño', lat: 42.161, lon: -8.619 },
    });
    expect(inicioEtapa(e)).toEqual([42.046, -8.644]);
    expect(finEtapa(e)).toEqual([42.161, -8.619]);
    expect(limitesEtapa(e)).toEqual([
      [42.046, -8.7],
      [42.3, -8.619],
    ]);
  });

  it('el recuadro de la etapa incluye sus sitios de interés, aunque estén fuera de la ruta', () => {
    const e = etapa({
      origen: { nombre: 'A', lat: 43.0, lon: -4.0 },
      destino: { nombre: 'B', lat: 43.1, lon: -4.1 },
      sitios: [{ nombre: 'Cueva', localidad: null, lat: 43.3, lon: -4.3, nota: null, fotoId: null }],
    });
    expect(limitesEtapa(e)).toEqual([
      [43.0, -4.3],
      [43.3, -4.0],
    ]);
    expect(finEtapa(e)).toEqual([43.1, -4.1]);
  });

  it('la línea principal es el recorrido a pie si lo hay', () => {
    const e = etapa({
      traza: { type: 'LineString', coordinates: [[-4.0, 43.0], [-4.1, 43.1]] },
      trazaPie: { type: 'LineString', coordinates: [[-4.0, 43.0], [-4.05, 43.08], [-4.1, 43.1]] },
      bbox: [-4.1, 43.0, -4.0, 43.1],
    });
    expect(inicioEtapa(e)).toEqual([43.0, -4.0]);
    expect(limitesEtapa(e)).toEqual([
      [43.0, -4.1],
      [43.1, -4.0],
    ]);
  });

  it('sin traza ni puntos no tiene posición', () => {
    expect(inicioEtapa(etapa({}))).toBeNull();
    expect(limitesEtapa(etapa({}))).toBeNull();
  });
});

describe('mapa', () => {
  it('nombra el nivel de zoom', () => {
    expect(nivelVista(5)).toBe('Península');
    expect(nivelVista(8)).toBe('Región');
    expect(nivelVista(11)).toBe('Tramo');
    expect(nivelVista(15)).toBe('Detalle');
  });

  it('separa los marcadores que caen en el mismo punto', () => {
    const separar = separador();
    const a = separar([43.0, -4.0]);
    const b = separar([43.0, -4.0]);
    const c = separar([42.0, -4.0]);
    expect(a).not.toEqual(b);
    expect(c).toEqual(a);
  });
});
