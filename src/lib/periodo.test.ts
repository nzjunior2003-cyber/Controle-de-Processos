import { describe, expect, it } from 'vitest';
import { FILTRO_PERIODO_VAZIO, alternarValor, competenciaNoPeriodo } from './periodo';

describe('competenciaNoPeriodo', () => {
  it('sem filtro tudo passa, inclusive vazio', () => {
    expect(competenciaNoPeriodo('2026-03', FILTRO_PERIODO_VAZIO)).toBe(true);
    expect(competenciaNoPeriodo('', FILTRO_PERIODO_VAZIO)).toBe(true);
  });
  it('vários anos', () => {
    const f = { anos: [2025, 2026], meses: [] };
    expect(competenciaNoPeriodo('2025-12', f)).toBe(true);
    expect(competenciaNoPeriodo('2024-12', f)).toBe(false);
  });
  it('vários meses (em qualquer ano) e combinação com anos', () => {
    expect(competenciaNoPeriodo('2024-02', { anos: [], meses: [1, 2] })).toBe(true);
    expect(competenciaNoPeriodo('2024-03', { anos: [], meses: [1, 2] })).toBe(false);
    expect(competenciaNoPeriodo('2025-02', { anos: [2026], meses: [2] })).toBe(false);
  });
  it('competência ausente não passa quando há filtro; aceita data ISO', () => {
    expect(competenciaNoPeriodo(undefined, { anos: [2026], meses: [] })).toBe(false);
    expect(competenciaNoPeriodo('2026-03-15T00:00:00.000Z', { anos: [2026], meses: [3] })).toBe(true);
  });
});

describe('alternarValor', () => {
  it('liga, desliga e mantém ordenado', () => {
    expect(alternarValor([3], 1)).toEqual([1, 3]);
    expect(alternarValor([1, 3], 3)).toEqual([1]);
  });
});
