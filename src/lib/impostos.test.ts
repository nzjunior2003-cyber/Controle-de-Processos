import { describe, expect, it } from 'vitest';
import { calcularImposto, totalImpostos, totalPorContaContabil, ultimasAliquotas, valorLiquido } from './impostos';

describe('impostos', () => {
  it('calcula base × alíquota com 2 casas', () => {
    expect(calcularImposto(10000, 5)).toBe(500);
    expect(calcularImposto(1234.56, 1.2)).toBe(14.81);
    expect(calcularImposto(0, 5)).toBe(0);
    expect(calcularImposto(NaN, 5)).toBe(0);
  });

  it('soma os impostos e tira do bruto', () => {
    const impostos = [{ valor: 500 }, { valor: 14.81 }];
    expect(totalImpostos(impostos)).toBe(514.81);
    expect(valorLiquido(10000, impostos)).toBe(9485.19);
    expect(valorLiquido(10000, undefined)).toBe(10000);
  });

  it('agrupa por conta contábil', () => {
    expect(
      totalPorContaContabil([
        { valor: 100, contaContabil: '2.1.2.1' },
        { valor: 50, contaContabil: ' 2.1.2.1 ' },
        { valor: 30, contaContabil: '2.1.3.2' },
        { valor: 5 },
      ]),
    ).toEqual({ '2.1.2.1': 150, '2.1.3.2': 30, 'Sem conta': 5 });
  });

  it('lembra a última alíquota e conta de cada imposto', () => {
    const r = ultimasAliquotas([
      { criado_em: '2026-01-01', impostos: [{ nome: 'ISS', aliquota: 2, contaContabil: 'A' }] },
      { criado_em: '2026-03-01', impostos: [{ nome: 'iss', aliquota: 5, contaContabil: 'B' }] },
    ]);
    expect(r.iss).toEqual({ aliquota: 5, contaContabil: 'B' });
  });
});
