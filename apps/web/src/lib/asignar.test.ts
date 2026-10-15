import { describe, expect, it } from 'vitest';
import { etapaDeFecha, fechaLocal } from './asignar';

const etapas = [
  { id: 'e1', fecha: '2026-09-12' },
  { id: 'e2', fecha: '2026-09-13' },
  { id: 'e3', fecha: null },
];

describe('asignación de fotos a etapas', () => {
  it('usa el día local de la foto', () => {
    expect(fechaLocal(new Date(2026, 8, 13, 23, 59))).toBe('2026-09-13');
    expect(fechaLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('asigna la etapa de ese día', () => {
    expect(etapaDeFecha(etapas, new Date(2026, 8, 13, 10, 0))).toBe('e2');
  });

  it('no asigna si no hay fecha, ninguna etapa ese día o varias', () => {
    expect(etapaDeFecha(etapas, null)).toBeNull();
    expect(etapaDeFecha(etapas, new Date(2026, 8, 20))).toBeNull();
    expect(etapaDeFecha([...etapas, { id: 'e4', fecha: '2026-09-12' }], new Date(2026, 8, 12, 9))).toBeNull();
  });
});
