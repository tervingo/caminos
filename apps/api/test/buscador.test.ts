import { describe, expect, it, vi } from 'vitest';
import { combinar, createNominatim } from '../src/buscador.js';
import { HttpError } from '../src/errores.js';
import { createOrs } from '../src/ors.js';

const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });

describe('buscador de localidades', () => {
  it('con el cupo de ORS agotado da un error claro', async () => {
    const ors = createOrs('clave', async () => respuesta(403, { error: 'Quota exceeded' }))!;
    await expect(ors.buscar('Potes')).rejects.toMatchObject({ statusCode: 429, code: 'cupo-agotado' });
  });

  it('si ORS falla, sigue con lo que encuentre Nominatim, identificándose', async () => {
    const fetchNominatim = vi.fn(async () =>
      respuesta(200, [
        { lat: '43.153', lon: '-4.623', name: 'Potes', display_name: 'Potes, Liébana, Cantabria, España', address: { village: 'Potes' } },
      ]),
    );
    const principal = { buscar: async () => Promise.reject(new HttpError(429, 'cupo-agotado', 'x')), inverso: async () => null };
    const buscador = combinar(principal, createNominatim(fetchNominatim as typeof fetch));
    expect(await buscador.buscar('Potes')).toEqual([
      { nombre: 'Potes', etiqueta: 'Potes, Liébana, Cantabria, España', lat: 43.153, lon: -4.623 },
    ]);
    const [url, init] = fetchNominatim.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=es%2Cpt%2Cfr%2Cad');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^NuestroCamino/);
  });

  it('solo falla si fallan los dos', async () => {
    const mal = { buscar: async () => Promise.reject(new HttpError(502, 'buscador', 'x')), inverso: async () => null };
    const peor = { buscar: async () => Promise.reject(new HttpError(429, 'cupo-agotado', 'y')), inverso: async () => null };
    await expect(combinar(mal, peor).buscar('P')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('junta los dos sin repetir sitios y pone primero lo más cercano al punto de referencia', async () => {
    const lugar = (nombre: string, lat: number, lon: number) => ({ nombre, etiqueta: nombre, lat, lon });
    // ORS no conoce O Cebreiro y sí otros Cebreiros de Galicia
    const ors = {
      buscar: vi.fn(async () => [lugar('Cebreiro (O Pino)', 42.883, -8.317), lugar('Pedrafita do Cebreiro', 42.695, -7.082)]),
      inverso: async () => null,
    };
    const nominatim = {
      buscar: vi.fn(async () => [
        lugar('O Cebreiro', 42.708, -7.043),
        lugar('Cebreiro (O Pino) bis', 42.887, -8.311),
        // El municipio, a 3 km del pueblo que da ORS
        lugar('Pedrafita do Cebreiro', 42.72, -7.07),
      ]),
      inverso: async () => null,
    };
    const triacastela = { lat: 42.756, lon: -7.241 };
    const nombres = (await combinar(ors, nominatim).buscar('Cebreiro', triacastela)).map((l) => l.nombre);
    expect(nombres).toEqual(['Pedrafita do Cebreiro', 'O Cebreiro', 'Cebreiro (O Pino)']);
    expect(ors.buscar).toHaveBeenCalledWith('Cebreiro', triacastela);
    expect(nominatim.buscar).toHaveBeenCalledWith('Cebreiro', triacastela);
  });

  it('pide a cada servicio que prefiera lo cercano', async () => {
    const fetchOrs = vi.fn(async () => respuesta(200, { features: [] }));
    await createOrs('clave', fetchOrs as typeof fetch)!.buscar('Triacastela', { lat: 42.7, lon: -7.04 });
    expect(fetchOrs.mock.calls[0]![0]).toContain('focus.point.lat=42.7&focus.point.lon=-7.04');
    const fetchNominatim = vi.fn(async () => respuesta(200, []));
    await createNominatim(fetchNominatim as typeof fetch).buscar('Triacastela', { lat: 42.7, lon: -7.04 });
    expect(decodeURIComponent(fetchNominatim.mock.calls[0]![0] as string)).toContain('viewbox=-8.04,43.7,-6.04,41.7');
  });

  it('el punto en el mapa usa Nominatim si se agota el cupo de ORS', async () => {
    const ors = { buscar: async () => [], inverso: async () => Promise.reject(new HttpError(429, 'cupo-agotado', 'x')) };
    const otro = { buscar: async () => [], inverso: vi.fn(async () => ({ nombre: 'Potes', etiqueta: 'Potes', lat: 1, lon: 2 })) };
    expect(await combinar(ors, otro).inverso(1, 2)).toMatchObject({ nombre: 'Potes' });
  });

  it('el punto en el mapa se nombra por su pueblo', async () => {
    const nominatim = createNominatim((async () =>
      respuesta(200, {
        lat: '43.29',
        lon: '-4.48',
        name: 'Calle Mayor',
        display_name: 'Calle Mayor, Puentenansa, Cantabria',
        address: { village: 'Puentenansa', road: 'Calle Mayor' },
      })) as typeof fetch);
    expect(await nominatim.inverso(43.288, -4.48)).toMatchObject({ nombre: 'Puentenansa', lat: 43.288, lon: -4.48 });
  });
});
