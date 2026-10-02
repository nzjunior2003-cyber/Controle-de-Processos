/**
 * Funções puras do módulo Financeiro — saldos, totais e validações do
 * controle de pagamentos da Diretoria de Finanças. Tudo é calculado a
 * partir dos registros lançados (nunca persistido), pra planilha-controle
 * não divergir de si mesma (ex.: total do mês que não bate com as NFs).
 */
import type { ExecucaoContrato } from './contratos';
import type {
  DotacaoOrcamentaria,
  Empenho,
  PagamentoContrato,
  StatusPagamento,
} from '../types';

/** Setores e etapas mais usados nas fichas de controle — só sugestões (o campo aceita texto livre). */
export const SETORES_PAGAMENTO = ['GAB', 'CPCI', 'DIRF', 'Almoxarifado', 'DTIC', 'SEPLAD', 'CONJUR'];
export const ETAPAS_PAGAMENTO = [
  'P/ ASS DE NE',
  'P/ ASS DE NE + OB',
  'P/ CONFORMIDADE',
  'AGUARDANDO ASS DO DIRF',
  'AGUARDANDO RETORNO DO ALMOXARIFADO',
];

/** Situação do pagamento; registros do modelo anterior (sem `status`) contam como pagos. */
export function statusDoPagamento(p: Pick<PagamentoContrato, 'status'>): StatusPagamento {
  return p.status ?? 'pago';
}

/** Valor da fatura: `valorTotal`, ou `valorPago` nos registros do modelo anterior. */
export function valorDoPagamento(p: Pick<PagamentoContrato, 'valorTotal' | 'valorPago'>): number {
  return p.valorTotal ?? p.valorPago ?? 0;
}

/** Mês de competência 'AAAA-MM': o informado, ou o da data de pagamento/criação (legado). */
export function competenciaDoPagamento(
  p: Pick<PagamentoContrato, 'competencia' | 'dataPagamento' | 'criado_em'>,
): string {
  if (p.competencia) return p.competencia;
  const data = p.dataPagamento ?? p.criado_em;
  return data ? data.slice(0, 7) : '';
}

/** Pagamentos que valem pra soma: tudo, menos os arquivados. */
export function pagamentosAtivos(pagamentos: PagamentoContrato[]): PagamentoContrato[] {
  return pagamentos.filter((p) => statusDoPagamento(p) !== 'arquivado');
}

/** Soma dos pagamentos (não arquivados) que apontam pra uma dotação específica. */
export function totalPagoDaDotacao(dotacaoId: string, pagamentos: PagamentoContrato[]): number {
  return pagamentosAtivos(pagamentos)
    .filter((p) => p.dotacaoId === dotacaoId)
    .reduce((acc, p) => acc + valorDoPagamento(p), 0);
}

/** Saldo disponível de uma dotação: valor dotado menos o já usado a partir dela. */
export function saldoDaDotacao(dotacao: DotacaoOrcamentaria, pagamentos: PagamentoContrato[]): number {
  return dotacao.valorDotado - totalPagoDaDotacao(dotacao.id, pagamentos);
}

/** Soma dos pagamentos (não arquivados) de um contrato. */
export function totalPagoDoContrato(contratoId: string, pagamentos: PagamentoContrato[]): number {
  return pagamentosAtivos(pagamentos)
    .filter((p) => p.contratoId === contratoId)
    .reduce((acc, p) => acc + valorDoPagamento(p), 0);
}

/** Total efetivamente pago (status 'pago', com OB) por fonte de recurso — dashboard executivo (DGA). */
export function totalPagoPorFonte(pagamentos: PagamentoContrato[]): Record<string, number> {
  return pagamentos
    .filter((p) => statusDoPagamento(p) === 'pago')
    .reduce<Record<string, number>>((acc, p) => {
      const fonte = p.fonteRecurso || 'Sem fonte';
      acc[fonte] = (acc[fonte] || 0) + valorDoPagamento(p);
      return acc;
    }, {});
}

export interface TotalMes {
  /** Mês 'AAAA-MM'. */
  mes: string;
  /** Soma de todas as faturas não arquivadas do mês (o "Valor mês" da planilha). */
  total: number;
  /** Parte já paga (com status 'pago'). */
  pago: number;
  quantidade: number;
}

/** Totais por mês de competência (só pagamentos não arquivados), em ordem cronológica. */
export function totaisPorMes(pagamentos: PagamentoContrato[]): TotalMes[] {
  const porMes = new Map<string, TotalMes>();
  pagamentosAtivos(pagamentos).forEach((p) => {
    const mes = competenciaDoPagamento(p);
    const atual = porMes.get(mes) ?? { mes, total: 0, pago: 0, quantidade: 0 };
    const valor = valorDoPagamento(p);
    atual.total += valor;
    if (statusDoPagamento(p) === 'pago') atual.pago += valor;
    atual.quantidade += 1;
    porMes.set(mes, atual);
  });
  return Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Soma dos documentos que têm valor informado. */
export function somaDocumentos(p: Pick<PagamentoContrato, 'documentos'>): number {
  return (p.documentos ?? []).reduce((acc, d) => acc + (d.valor ?? 0), 0);
}

/**
 * Diferença entre o valor da fatura e a soma das NFs — só quando **todas**
 * as NFs têm valor (se alguma não tem, não há como comparar). 0 = bate.
 */
export function diferencaDocumentos(p: Pick<PagamentoContrato, 'documentos' | 'valorTotal'>): number | null {
  const documentos = p.documentos ?? [];
  if (documentos.length === 0 || p.valorTotal === undefined) return null;
  if (documentos.some((d) => d.valor === undefined)) return null;
  return Math.round((p.valorTotal - somaDocumentos(p)) * 100) / 100;
}

export interface SaldoExercicio {
  /** Origem + reforços. */
  empenhado: number;
  /** Faturas não arquivadas já cobertas por NE. */
  comprometido: number;
  /** empenhado − comprometido (negativo = falta reforço). */
  saldo: number;
}

/**
 * Saldo de empenho de um contrato num exercício: soma das NEs (origem e
 * reforços) menos o valor das faturas não arquivadas que usam alguma delas.
 * É calculado no nível do contrato/exercício (e não por NE) porque uma
 * fatura pode ser coberta por mais de uma NE sem que se saiba a divisão.
 */
export function saldoDoExercicio(
  contratoId: string,
  exercicio: number,
  empenhos: Empenho[],
  pagamentos: PagamentoContrato[],
): SaldoExercicio {
  const doExercicio = empenhos.filter((e) => e.contratoId === contratoId && e.exercicio === exercicio);
  const ids = new Set(doExercicio.map((e) => e.id));
  const empenhado = doExercicio.reduce((acc, e) => acc + (e.valor || 0), 0);
  const comprometido = pagamentosAtivos(pagamentos)
    .filter((p) => p.contratoId === contratoId && (p.empenhoIds ?? []).some((id) => ids.has(id)))
    .reduce((acc, p) => acc + valorDoPagamento(p), 0);
  return { empenhado, comprometido, saldo: empenhado - comprometido };
}

/** Quanto falta reforçar pra cobrir uma fatura: 0 se o saldo já cobre. */
export function reforcoNecessario(valorFatura: number, saldoDisponivel: number): number {
  return Math.max(0, Math.round((valorFatura - saldoDisponivel) * 100) / 100);
}

/**
 * Histórico do "status do processo": devolve o histórico com uma nova
 * passagem no fim quando o setor ou a etapa mudaram (ou quando ainda não há
 * histórico e há setor/etapa); senão devolve o mesmo histórico.
 */
export function registrarAndamento(
  anterior: Pick<PagamentoContrato, 'setorAtual' | 'etapa' | 'historico'> | undefined,
  novo: { setorAtual?: string; etapa?: string },
  porNome: string,
  agora: string = new Date().toISOString(),
): NonNullable<PagamentoContrato['historico']> {
  const historico = anterior?.historico ?? [];
  const setor = (novo.setorAtual ?? '').trim();
  const etapa = (novo.etapa ?? '').trim();
  if (!setor && !etapa) return historico;
  const mudou = (anterior?.setorAtual ?? '') !== setor || (anterior?.etapa ?? '') !== etapa;
  if (!mudou && historico.length > 0) return historico;
  return [...historico, { setor, etapa, data: agora, porNome }];
}

/** "GAB - P/ ASS DE NE + OB": o status como aparece na planilha de controle. */
export function descreverAndamento(p: Pick<PagamentoContrato, 'setorAtual' | 'etapa' | 'status'>): string {
  const partes = [p.setorAtual, p.etapa].filter(Boolean).join(' - ');
  if (partes) return partes;
  const status = statusDoPagamento(p);
  return status === 'pago' ? 'Pago' : status === 'arquivado' ? 'Arquivado' : '-';
}

/**
 * Quanto uma fatura deve tirar do saldo financeiro do contrato: o valor total
 * quando está **paga**, menos o que veio de NFs antigas (já abatidas ao serem
 * lançadas — ver `ExecucaoContrato.saldoFinanceiroAbatido`). Em tramitação ou
 * arquivada, não abate nada.
 */
export function valorASerAbatido(
  p: Pick<PagamentoContrato, 'status' | 'valorTotal' | 'valorPago' | 'documentos'>,
  execucoes: Pick<ExecucaoContrato, 'id' | 'valor' | 'saldoFinanceiroAbatido'>[],
): number {
  if (statusDoPagamento(p) !== 'pago') return 0;
  const jaAbatido = (p.documentos ?? []).reduce((acc, d) => {
    const execucao = d.execucaoId ? execucoes.find((e) => e.id === d.execucaoId) : undefined;
    return execucao && execucao.saldoFinanceiroAbatido !== false ? acc + (execucao.valor || 0) : acc;
  }, 0);
  return Math.max(0, valorDoPagamento(p) - jaAbatido);
}

/**
 * Quanto o pagamento já tirou do saldo. Registros do modelo anterior (sem
 * `status`) nunca abateram nada além das NFs, então contam como "já em dia".
 */
export function valorJaAbatido(
  p: Pick<PagamentoContrato, 'status' | 'valorTotal' | 'valorPago' | 'documentos' | 'valorAbatidoSaldo'>,
  execucoes: Pick<ExecucaoContrato, 'id' | 'valor' | 'saldoFinanceiroAbatido'>[],
): number {
  if (p.valorAbatidoSaldo !== undefined) return p.valorAbatidoSaldo;
  return p.status === undefined ? valorASerAbatido(p, execucoes) : 0;
}

/**
 * NFs lançadas pelo fiscal (modelo novo) cujo pagamento ainda não foi
 * registrado como pago — o valor "comprometido" que ainda não saiu do saldo.
 */
export function valorAPagarDoContrato(
  contratoId: string,
  execucoes: Pick<ExecucaoContrato, 'id' | 'contratoId' | 'valor' | 'saldoFinanceiroAbatido'>[],
  pagamentos: Pick<PagamentoContrato, 'status' | 'documentos'>[],
): number {
  const pagas = new Set(
    pagamentos
      .filter((p) => statusDoPagamento(p) === 'pago')
      .flatMap((p) => (p.documentos ?? []).map((d) => d.execucaoId)),
  );
  return execucoes
    .filter((e) => e.contratoId === contratoId && e.saldoFinanceiroAbatido === false && !pagas.has(e.id))
    .reduce((acc, e) => acc + (e.valor || 0), 0);
}
