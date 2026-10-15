import { describe, expect, it, vi } from 'vitest';
import { conRespaldo, createNominatim } from '../src/buscador.js';
import { HttpError } from '../src/errores.js';
import { createOrs } from '../src/ors.js';

const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });

describe('buscador de localidades', () => {
  it('con el cupo de ORS agotado da un error claro', async () => {
    const ors = createOrs('clave', async () => respuesta(403, { error: 'Quota exceeded' }))!;
    await expect(ors.buscar('Potes')).rejects.toMatchObject({ statusCode: 429, code: 'cupo-agotado' });
  });

  it('si ORS falla, busca en Nominatim identificándose', async () => {
    const fetchNominatim = vi.fn(async () =>
      respuesta(200, [
        { lat: '43.153', lon: '-4.623', name: 'Potes', display_name: 'Potes, Liébana, Cantabria, España', address: { village: 'Potes' } },
      ]),
    );
    const principal = { buscar: async () => Promise.reject(new HttpError(429, 'cupo-agotado', 'x')), inverso: async () => null };
    const buscador = conRespaldo(principal, createNominatim(fetchNominatim as typeof fetch));
    expect(await buscador.buscar('Potes')).toEqual([{ nombre: 'Potes', etiqueta: 'Potes, Liébana, Cantabria, España', lat: 43.153, lon: -4.623 }]);
    const [url, init] = fetchNominatim.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=es%2Cpt%2Cfr%2Cad');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^NuestroCamino/);
  });

  it('no usa el respaldo para errores de datos', async () => {
    const principal = { buscar: async () => Promise.reject(new HttpError(400, 'datos-invalidos', 'x')), inverso: async () => null };
    const respaldo = { buscar: vi.fn(), inverso: vi.fn() };
    await expect(conRespaldo(principal, respaldo).buscar('P')).rejects.toMatchObject({ statusCode: 400 });
    expect(respaldo.buscar).not.toHaveBeenCalled();
  });

  it('el punto en el mapa se nombra por su pueblo', async () => {
    const nominatim = createNominatim((async () =>
      respuesta(200, { lat: '43.29', lon: '-4.48', name: 'Calle Mayor', display_name: 'Calle Mayor, Puentenansa, Cantabria', address: { village: 'Puentenansa', road: 'Calle Mayor' } })) as typeof fetch);
    expect(await nominatim.inverso(43.288, -4.48)).toMatchObject({ nombre: 'Puentenansa', lat: 43.288, lon: -4.48 });
  });
});
