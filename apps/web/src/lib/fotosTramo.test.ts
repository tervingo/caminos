import { describe, expect, it } from 'vitest';
import type { Etapa, Foto } from '@caminos/shared';
import { fotosPorEtapa, muestraDeFotos } from './fotosTramo';

const foto = (id: string, etapaId: string | null) => ({ id, etapaId }) as Foto;
const etapa = (id: string) => ({ id }) as Etapa;

describe('fotos del tramo', () => {
  it('reparte por etapa y deja aparte las que no son de ninguna etapa del Camino', () => {
    const r = fotosPorEtapa(
      [etapa('e1'), etapa('e2')],
      [foto('a', 'e1'), foto('b', 'e2'), foto('c', null), foto('d', 'e1'), foto('e', 'ida')],
    );
    expect(r.etapas.map((e) => [e.numero, e.fotos.map((f) => f.id)])).toEqual([
      [1, ['a', 'd']],
      [2, ['b']],
    ]);
    expect(r.otras.map((f) => f.id)).toEqual(['c', 'e']);
  });

  it('la franja reparte la muestra por todo el tramo', () => {
    const fotos = Array.from({ length: 87 }, (_, i) => foto(String(i), null));
    const muestra = muestraDeFotos(fotos);
    expect(muestra.map((f) => f.id)).toEqual(['0', '17', '34', '52', '69', '86']);
    expect(muestraDeFotos(fotos.slice(0, 3))).toHaveLength(3);
  });
});
