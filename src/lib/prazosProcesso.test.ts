import { describe, expect, it } from 'vitest';
import { calcularDataPrevista, PRAZOS_ALVO_POR_RITO } from './prazosProcesso';

describe('calcularDataPrevista', () => {
  it('soma o prazo-alvo do rito à data de abertura', () => {
    const prevista = calcularDataPrevista('2026-01-01T00:00:00.000Z', 'Adesão à ata de registro de preços');
    expect(prevista?.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('devolve null pra rito sem prazo-alvo definido', () => {
    expect(calcularDataPrevista('2026-01-01T00:00:00.000Z', 'Cotação Deserta / Fracassada por 3 vezes')).toBeNull();
  });

  it('devolve null sem data de entrada ou sem rito', () => {
    expect(calcularDataPrevista(undefined, 'Pregão Eletrônico')).toBeNull();
    expect(calcularDataPrevista('2026-01-01T00:00:00.000Z', undefined)).toBeNull();
  });

  it('tem prazo definido pros 14 ritos com meta acordada', () => {
    expect(Object.keys(PRAZOS_ALVO_POR_RITO)).toHaveLength(14);
  });
});
