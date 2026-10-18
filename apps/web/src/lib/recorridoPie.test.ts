import { describe, expect, it } from 'vitest';
import { construirRed, distancia, type LatLon, recortar } from './recorridoPie';

/** Track recto de lat0 a lat1 (misma longitud), con un punto cada ~110 m */
function recta(lon: number, lat0: number, lat1: number): LatLon[] {
  const n = Math.round(Math.abs(lat1 - lat0) / 0.001);
  return Array.from({ length: n + 1 }, (_, i): LatLon => [lat0 + ((lat1 - lat0) * i) / n, lon]);
}

describe('recorrido a pie', () => {
  it('une ficheros consecutivos aunque haya un pequeño hueco y recorta la etapa', () => {
    // Dos «ficheros de etapa» del CNIG: 43.00→43.10 y, tras un hueco de ~40 m, 43.1004→43.20
    const red = construirRed([recta(-4, 43.0, 43.1), recta(-4, 43.1004, 43.2)]);
    // La etapa va de 43.05 a 43.15, con el origen a unos 80 m del track
    const r = recortar(red, [43.05, -4.001], [43.15, -4]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metros / 1000).toBeCloseTo(11.1, 0);
    expect(r.aOrigen).toBeGreaterThan(50);
    expect(r.aOrigen).toBeLessThan(100);
    // Una recta se queda en sus dos extremos al simplificar
    expect(r.coordenadas).toHaveLength(2);
    expect(r.coordenadas[0][1]).toBeCloseTo(43.05, 3);
  });

  it('sigue el track aunque la línea recta sea más corta', () => {
    // Una «U»: subir por una longitud, cruzar y bajar por otra
    const red = construirRed([[...recta(-4, 43.0, 43.1), ...recta(-3.99, 43.1, 43.0)]]);
    const r = recortar(red, [43.0, -4], [43.0, -3.99]);
    expect(r.ok && r.metros).toBeGreaterThan(20_000);
    expect(distancia([43.0, -4], [43.0, -3.99])).toBeLessThan(1000);
  });

  it('conserva las altitudes del GPX en todos los puntos del recorrido, si las trae', () => {
    const conAltitud = (lon: number, lat0: number, lat1: number) => recta(lon, lat0, lat1).map(([lat, l], i): [number, number, number] => [lat, l, 500 + i]);
    const r = recortar(construirRed([conAltitud(-4, 43.0, 43.1)]), [43.02, -4], [43.08, -4]);
    expect(r.ok && r.conAltitud?.length).toBe(61);
    expect(r.ok && r.conAltitud?.[0]).toEqual([-4, 43.02, 520]);
    // Sin altitud en el GPX no hay perfil propio (lo pondrá el servidor)
    const sin = recortar(construirRed([recta(-4, 43.0, 43.1)]), [43.02, -4], [43.08, -4]);
    expect(sin.ok && sin.conAltitud).toBeNull();
  });

  it('avisa si la etapa no está en los ficheros', () => {
    const red = construirRed([recta(-4, 43.0, 43.1)]);
    expect(recortar(red, [43.05, -4], [43.5, -4])).toMatchObject({ ok: false, motivo: 'lejos' });
  });

  it('avisa si los tracks no se tocan', () => {
    const red = construirRed([recta(-4, 43.0, 43.1), recta(-3.95, 43.0, 43.1)]);
    expect(recortar(red, [43.05, -4], [43.05, -3.95])).toMatchObject({ ok: false, motivo: 'sin-conexion' });
  });
});
