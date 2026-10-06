/**
 * Impostos retidos/pagos junto com o pagamento de uma NF/fatura. Cada linha
 * tem imposto, base de cálculo, alíquota, valor (calculado) e conta contábil —
 * impostos diferentes podem ir pra contas contábeis diferentes.
 */
import type { ImpostoPagamento } from '../types';

/**
 * Nomes mais comuns, só como sugestão no campo (que aceita qualquer texto).
 * As alíquotas NÃO vêm preenchidas: variam por tipo de serviço, município e
 * enquadramento do fornecedor — o sistema lembra a última usada em cada imposto.
 */
export const IMPOSTOS_SUGERIDOS = ['ISS', 'IRRF', 'INSS', 'PIS', 'COFINS', 'CSLL', 'PIS/COFINS/CSLL', 'ICMS', 'Outro'];

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** Valor do imposto = base × alíquota%, em reais com 2 casas. */
export function calcularImposto(base: number, aliquotaPercentual: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(aliquotaPercentual)) return 0;
  return arredondar((base * aliquotaPercentual) / 100);
}

export function totalImpostos(impostos: Pick<ImpostoPagamento, 'valor'>[] | undefined): number {
  return arredondar((impostos ?? []).reduce((acc, i) => acc + (i.valor || 0), 0));
}

/** O que sobra pra pagar ao fornecedor depois dos impostos retidos. */
export function valorLiquido(valorBruto: number, impostos: Pick<ImpostoPagamento, 'valor'>[] | undefined): number {
  return arredondar(valorBruto - totalImpostos(impostos));
}

/** Total de impostos agrupado por conta contábil ('Sem conta' quando não informada). */
export function totalPorContaContabil(impostos: Pick<ImpostoPagamento, 'valor' | 'contaContabil'>[] | undefined): Record<string, number> {
  return (impostos ?? []).reduce<Record<string, number>>((acc, i) => {
    const conta = (i.contaContabil ?? '').trim() || 'Sem conta';
    acc[conta] = arredondar((acc[conta] ?? 0) + (i.valor || 0));
    return acc;
  }, {});
}

/** Última alíquota usada em cada imposto (do mais recente pro mais antigo) — pré-preenche a próxima vez. */
export function ultimasAliquotas(
  pagamentos: { impostos?: Pick<ImpostoPagamento, 'nome' | 'aliquota' | 'contaContabil'>[]; criado_em?: string }[],
): Record<string, { aliquota?: number; contaContabil?: string }> {
  const ordenados = [...pagamentos].sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''));
  const resultado: Record<string, { aliquota?: number; contaContabil?: string }> = {};
  ordenados.forEach((p) =>
    (p.impostos ?? []).forEach((i) => {
      const chave = i.nome.trim().toLowerCase();
      if (!chave || chave in resultado) return;
      resultado[chave] = { aliquota: i.aliquota, contaContabil: i.contaContabil };
    }),
  );
  return resultado;
}
