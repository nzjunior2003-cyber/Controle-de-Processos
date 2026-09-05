/**
 * Regras de vigência de contratos compartilhadas por GestaoContratos e
 * FiscalContrato (antes duplicadas nas duas páginas).
 */
import { differenceInDays } from 'date-fns';
import type { Contrato } from '../types';

export interface ContratoComStatus extends Contrato {
  diasRestantes: number;
  status: 'VIGENTE' | 'FALTA MENOS DE 90 DIAS' | 'FALTA MENOS DE 30 DIAS' | 'VENCIDO';
  cor: string;
  badge: string;
}

export function calcularStatusContrato(
  contrato: Contrato,
  hoje: Date = new Date(),
): ContratoComStatus {
  const dataFim = new Date(contrato.fimVigencia);
  const diasRestantes = Number.isNaN(dataFim.getTime())
    ? 0
    : differenceInDays(dataFim, hoje);

  let status: ContratoComStatus['status'] = 'VIGENTE';
  let cor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  let badge = 'Vigente';

  if (diasRestantes < 0) {
    status = 'VENCIDO';
    cor = 'bg-red-100 text-red-800 border-red-200';
    badge = 'Vencido';
  } else if (diasRestantes <= 30) {
    status = 'FALTA MENOS DE 30 DIAS';
    cor = 'bg-orange-100 text-orange-800 border-orange-200';
    badge = '< 30 Dias';
  } else if (diasRestantes <= 90) {
    status = 'FALTA MENOS DE 90 DIAS';
    cor = 'bg-amber-100 text-amber-800 border-amber-200';
    badge = '< 90 Dias';
  }

  return { ...contrato, diasRestantes, status, cor, badge };
}

/** Restringe a lista aos contratos que um fiscal pode ver. */
export function filtrarContratosDoFiscal<T extends Contrato>(
  contratos: T[],
  usuario: { email: string; nome: string } | null,
): T[] {
  if (!usuario) return [];
  return contratos.filter(
    (c) =>
      c.fiscalEmail === usuario.email ||
      c.fiscalSuplenteEmail === usuario.email ||
      (!!c.fiscalTitular && !!usuario.nome && c.fiscalTitular.includes(usuario.nome)) ||
      (!!c.fiscalSuplente && !!usuario.nome && c.fiscalSuplente.includes(usuario.nome)),
  );
}

/** Busca textual usada nas telas de contratos. */
export function buscarContratos<T extends Contrato>(contratos: T[], busca: string): T[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return contratos;
  return contratos.filter(
    (c) =>
      (c.empresa ?? '').toLowerCase().includes(termo) ||
      (c.numero ?? '').toLowerCase().includes(termo) ||
      (c.objeto ?? '').toLowerCase().includes(termo) ||
      (c.pae ?? '').toLowerCase().includes(termo),
  );
}

/** Lançamento de execução financeira (NF/fatura/recibo) de um contrato. */
export interface ExecucaoContrato {
  id: string;
  contratoId: string;
  tipo?: string;
  nf: string;
  data: string;
  valor: number;
  quantidade?: number;
  observacao?: string;
  arquivoLink?: string | null;
  criado_em?: string;
}

export interface SaldoContrato {
  saldoAtualFinanceiro: number;
  saldoAtualQuantitativo?: number;
}

/** Abate valor (e quantidade, quando controlada) de uma execução (NF) lançada do saldo atual do contrato. */
export function abaterSaldo(
  saldo: SaldoContrato,
  execucao: Pick<ExecucaoContrato, 'valor' | 'quantidade'>,
): SaldoContrato {
  const controlaQuantidade = typeof saldo.saldoAtualQuantitativo === 'number';
  return {
    saldoAtualFinanceiro: (saldo.saldoAtualFinanceiro ?? 0) - (execucao.valor || 0),
    ...(controlaQuantidade
      ? {
          saldoAtualQuantitativo:
            (saldo.saldoAtualQuantitativo ?? 0) - (execucao.quantidade || 0),
        }
      : {}),
  };
}

/** Devolve ao saldo atual do contrato o valor/quantidade de uma execução removida. */
export function devolverSaldo(
  saldo: SaldoContrato,
  execucao: Pick<ExecucaoContrato, 'valor' | 'quantidade'>,
): SaldoContrato {
  const controlaQuantidade = typeof saldo.saldoAtualQuantitativo === 'number';
  return {
    saldoAtualFinanceiro: (saldo.saldoAtualFinanceiro ?? 0) + (execucao.valor || 0),
    ...(controlaQuantidade
      ? {
          saldoAtualQuantitativo:
            (saldo.saldoAtualQuantitativo ?? 0) + (execucao.quantidade || 0),
        }
      : {}),
  };
}

export type TipoOcorrencia =
  | 'OCORRENCIA'
  | 'ADITIVO'
  | 'ESCLARECIMENTO'
  | 'ATRASO_ENTREGA'
  | 'DESCONFORMIDADE'
  | 'ITEM_NAO_ENTREGUE'
  | 'OUTRO';

export const TIPO_OCORRENCIA_LABELS: Record<TipoOcorrencia, string> = {
  OCORRENCIA: 'Ocorrência',
  ADITIVO: 'Solicitação de Aditivo',
  ESCLARECIMENTO: 'Solicitação de Esclarecimento',
  ATRASO_ENTREGA: 'Atraso na Entrega',
  DESCONFORMIDADE: 'Item em Desconformidade',
  ITEM_NAO_ENTREGUE: 'Item Não Entregue',
  OUTRO: 'Outro',
};

/**
 * Ocorrência registrada sobre um contrato: um apontamento simples do
 * Gestor, uma solicitação de aditivo/esclarecimento, ou um apontamento do
 * Fiscal sobre a execução (atraso, desconformidade, item não entregue
 * etc.) — sem workflow de aprovação, é só registro histórico.
 */
export interface Ocorrencia {
  id: string;
  contratoId: string;
  descricao: string;
  data: string;
  registradoPorId: string;
  registradoPorNome: string;
  tipo: TipoOcorrencia;
  criado_em?: string;
}

export const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0,
  );
