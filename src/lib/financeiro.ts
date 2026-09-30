/**
 * Funções puras do módulo Financeiro — saldo de dotação orçamentária e
 * agregações de pagamentos, sempre calculadas a partir dos pagamentos já
 * lançados (nunca persistidas), no mesmo espírito de `calcularEconomicidade`
 * (src/lib/contratos.ts).
 */
import type { DotacaoOrcamentaria, PagamentoContrato } from '../types';

/** Soma dos pagamentos que apontam pra uma dotação específica. */
export function totalPagoDaDotacao(dotacaoId: string, pagamentos: PagamentoContrato[]): number {
  return pagamentos
    .filter((p) => p.dotacaoId === dotacaoId)
    .reduce((acc, p) => acc + (p.valorPago || 0), 0);
}

/** Saldo disponível de uma dotação: valor dotado menos o já pago a partir dela. */
export function saldoDaDotacao(dotacao: DotacaoOrcamentaria, pagamentos: PagamentoContrato[]): number {
  return dotacao.valorDotado - totalPagoDaDotacao(dotacao.id, pagamentos);
}

/** Soma dos pagamentos vinculados a um contrato específico. */
export function totalPagoDoContrato(contratoId: string, pagamentos: PagamentoContrato[]): number {
  return pagamentos
    .filter((p) => p.contratoId === contratoId)
    .reduce((acc, p) => acc + (p.valorPago || 0), 0);
}

/** Agrupa o total pago por fonte de recurso — usado no dashboard executivo (DGA). */
export function totalPagoPorFonte(pagamentos: PagamentoContrato[]): Record<string, number> {
  return pagamentos.reduce<Record<string, number>>((acc, p) => {
    const fonte = p.fonteRecurso || 'Sem fonte';
    acc[fonte] = (acc[fonte] || 0) + (p.valorPago || 0);
    return acc;
  }, {});
}
