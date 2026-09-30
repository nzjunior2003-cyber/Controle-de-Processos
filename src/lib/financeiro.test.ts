import { describe, expect, it } from 'vitest';
import { saldoDaDotacao, totalPagoDaDotacao, totalPagoDoContrato, totalPagoPorFonte } from './financeiro';
import type { DotacaoOrcamentaria, PagamentoContrato } from '../types';

const pagamento = (overrides: Partial<PagamentoContrato>): PagamentoContrato => ({
  id: 'pag-1',
  contratoId: 'contrato-1',
  numeroEmpenho: '2026NE000123',
  numeroOrdemPagamento: 'OP-001',
  dotacaoId: 'dotacao-1',
  fonteRecurso: 'Tesouro',
  valorPago: 1000,
  dataPagamento: '2026-01-15T00:00:00.000Z',
  criado_em: '2026-01-15T00:00:00.000Z',
  atualizado_em: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

const dotacao: DotacaoOrcamentaria = {
  id: 'dotacao-1',
  exercicio: 2026,
  codigo: '3.3.90.30',
  descricao: 'Material de consumo',
  fonteRecurso: 'Tesouro',
  valorDotado: 5000,
  criado_em: '2026-01-01T00:00:00.000Z',
  atualizado_em: '2026-01-01T00:00:00.000Z',
};

describe('totalPagoDaDotacao', () => {
  it('soma só os pagamentos daquela dotação', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 1000 }),
      pagamento({ id: 'b', valorPago: 500, dotacaoId: 'outra-dotacao' }),
      pagamento({ id: 'c', valorPago: 200 }),
    ];
    expect(totalPagoDaDotacao('dotacao-1', pagamentos)).toBe(1200);
  });

  it('devolve 0 sem pagamentos vinculados', () => {
    expect(totalPagoDaDotacao('dotacao-1', [])).toBe(0);
  });
});

describe('saldoDaDotacao', () => {
  it('subtrai o total pago do valor dotado', () => {
    const pagamentos = [pagamento({ valorPago: 1200 })];
    expect(saldoDaDotacao(dotacao, pagamentos)).toBe(3800);
  });

  it('devolve o valor total quando não há pagamentos', () => {
    expect(saldoDaDotacao(dotacao, [])).toBe(5000);
  });
});

describe('totalPagoDoContrato', () => {
  it('soma só os pagamentos daquele contrato', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 300 }),
      pagamento({ id: 'b', valorPago: 400, contratoId: 'outro-contrato' }),
    ];
    expect(totalPagoDoContrato('contrato-1', pagamentos)).toBe(300);
  });
});

describe('totalPagoPorFonte', () => {
  it('agrupa o total pago por fonte de recurso', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 300, fonteRecurso: 'Tesouro' }),
      pagamento({ id: 'b', valorPago: 200, fonteRecurso: 'FEBOM' }),
      pagamento({ id: 'c', valorPago: 100, fonteRecurso: 'Tesouro' }),
    ];
    expect(totalPagoPorFonte(pagamentos)).toEqual({ Tesouro: 400, FEBOM: 200 });
  });

  it('agrupa sem fonte definida sob "Sem fonte"', () => {
    const pagamentos = [pagamento({ fonteRecurso: '' })];
    expect(totalPagoPorFonte(pagamentos)).toEqual({ 'Sem fonte': 1000 });
  });
});
