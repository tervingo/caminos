import { describe, expect, it } from 'vitest';
import { desnivel, fechaCorta, fechaLarga, numeroKm, plural, precio, rangoFechas } from './formato';

describe('fechas', () => {
  it('formatea sin depender de la zona horaria', () => {
    expect(fechaCorta('2023-09-08')).toBe('8 sep');
    expect(fechaLarga('2024-01-01')).toBe('1 ene 2024');
    expect(fechaLarga('2026-12-31')).toBe('31 dic 2026');
  });

  it('agrupa los rangos según mes y año', () => {
    expect(rangoFechas('2023-09-08', '2023-09-10')).toBe('8–10 sep 2023');
    expect(rangoFechas('2023-08-28', '2023-09-03')).toBe('28 ago – 3 sep 2023');
    expect(rangoFechas('2023-12-30', '2024-01-02')).toBe('30 dic 2023 – 2 ene 2024');
  });

  it('acepta rangos incompletos', () => {
    expect(rangoFechas('2025-09-05', null)).toBe('5 sep 2025');
    expect(rangoFechas(null, '2025-09-07')).toBe('7 sep 2025');
    expect(rangoFechas('2025-09-05', '2025-09-05')).toBe('5 sep 2025');
    expect(rangoFechas(null, null)).toBeNull();
  });
});

describe('cifras', () => {
  it('formatea kilómetros con coma decimal y punto de miles', () => {
    expect(numeroKm(68)).toBe('68');
    expect(numeroKm(12.46)).toBe('12,5');
    expect(numeroKm(1234)).toBe('1.234');
  });

  it('formatea el desnivel', () => {
    expect(desnivel(1700)).toBe('+1.700 m');
    expect(desnivel(500)).toBe('+500 m');
  });

  it('formatea precio y plurales', () => {
    expect(precio(3)).toBe('€€€');
    expect(precio(null)).toBe('');
    expect(plural(1, 'etapa')).toBe('1 etapa');
    expect(plural(3, 'etapa')).toBe('3 etapas');
  });
});
