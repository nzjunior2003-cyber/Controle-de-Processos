/**
 * Regras de vigência de contratos compartilhadas por GestaoContratos e
 * FiscalContrato (antes duplicadas nas duas páginas).
 */
import { differenceInDays } from 'date-fns';
import type { Contrato } from '../types';

/** Opções fixas de Natureza de Despesa exibidas no cadastro/filtro de contratos. */
export const OPCOES_NATUREZA_DESPESA_CONTRATO = ['CONSUMO', 'PERMANENTE', 'SERVIÇO'];

/** Marcos (em dias) do alerta automático de vencimento enviado aos fiscais. */
export const MARCOS_ALERTA_VENCIMENTO = [180, 90, 60, 30] as const;

/**
 * Marco de alerta de vencimento em que um contrato se encaixa — o mais
 * apertado que ele já alcançou (ex.: com 25 dias restantes, cai no marco
 * de 30, não no de 60, 90 ou 180). Devolve null pra contratos já vencidos
 * (tratados como um alerta à parte) ou com mais de 180 dias pela frente.
 */
export function marcoAlertaVencimento(diasRestantes: number): 180 | 90 | 60 | 30 | null {
  if (diasRestantes < 0) return null;
  if (diasRestantes <= 30) return 30;
  if (diasRestantes <= 60) return 60;
  if (diasRestantes <= 90) return 90;
  if (diasRestantes <= 180) return 180;
  return null;
}

/** Opções fixas de Fonte de Recurso exibidas no cadastro/filtro de contratos. */
export const OPCOES_FONTE_RECURSO_CONTRATO = ['TESOURO', 'FEBOM', 'NOA', 'BNDES', 'TED', 'OUTRO'];

export interface ContratoComStatus extends Contrato {
  diasRestantes: number;
  status:
    | 'VIGENTE'
    | 'FALTA MENOS DE 90 DIAS'
    | 'FALTA MENOS DE 30 DIAS'
    | 'VENCIDO'
    | 'CONCLUÍDO';
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

  if (contrato.concluido) {
    return {
      ...contrato,
      diasRestantes,
      status: 'CONCLUÍDO',
      cor: 'bg-slate-100 text-slate-700 border-slate-200',
      badge: 'Concluído',
    };
  }

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

/**
 * Extrai (ano, número) do "Nº do Contrato" pra permitir ordenação — o
 * campo é texto livre (às vezes só "nnn/aaaa", às vezes algo como "4º
 * Termo Aditivo ao Contrato 021/2022/CBMPA"), então usa o último trecho
 * "nnn/aaaa" encontrado na string. Devolve null quando não acha nenhum.
 */
export function extrairAnoNumeroContrato(numero: string): { ano: number; numero: number } | null {
  const ocorrencias = [...numero.matchAll(/(\d+)\s*\/\s*(\d{4})/g)];
  if (ocorrencias.length === 0) return null;
  const ultima = ocorrencias[ocorrencias.length - 1];
  return { numero: Number(ultima[1]), ano: Number(ultima[2]) };
}

/**
 * Ordena contratos por ano e número (extraídos de `numero` via
 * `extrairAnoNumeroContrato`); contratos sem um número reconhecível vão
 * para o fim, independente da direção. `direcao: 'desc'` inverte a ordem.
 */
export function ordenarContratosPorNumero<T extends Contrato>(
  contratos: T[],
  direcao: 'asc' | 'desc' = 'asc',
): T[] {
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...contratos].sort((a, b) => {
    const chaveA = extrairAnoNumeroContrato(a.numero ?? '');
    const chaveB = extrairAnoNumeroContrato(b.numero ?? '');
    if (!chaveA && !chaveB) return 0;
    if (!chaveA) return 1;
    if (!chaveB) return -1;
    if (chaveA.ano !== chaveB.ano) return (chaveA.ano - chaveB.ano) * sinal;
    return (chaveA.numero - chaveB.numero) * sinal;
  });
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

/**
 * Id do Gestor "raiz" responsável por um usuário: ele mesmo, se for raiz
 * (sem `gestorResponsavelId`), ou o `gestorResponsavelId`, se for
 * Auxiliar de outro Gestor.
 */
export function gestorRaizDe(
  usuario: { id: string; gestorResponsavelId?: string } | null | undefined,
): string | undefined {
  if (!usuario) return undefined;
  return usuario.gestorResponsavelId || usuario.id;
}

/**
 * Qualquer usuário do perfil Gestão de Contratos (Gestor "raiz" ou
 * Auxiliar) vê e gerencia todos os contratos, sem distinção — a
 * restrição por `gestorGeralId`/`gestorResponsavelId` foi removida a
 * pedido: um Auxiliar não deve ficar travado sem enxergar contratos só
 * porque a hierarquia de Gestores não bate. A função continua existindo
 * (sem filtrar nada) pra não exigir mudar os dois lugares que já a
 * chamam (GestaoContratos e seu dashboard).
 */
export function filtrarContratosPorGestor<T extends Contrato>(
  contratos: T[],
  _usuario?: { gestorResponsavelId?: string } | null,
): T[] {
  return contratos;
}

/** Máximo de contratos ativos que um mesmo Fiscal Titular pode acumular. */
export const LIMITE_CONTRATOS_FISCAL = 3;

/**
 * Verifica se um Fiscal Titular pode assumir mais um contrato sem
 * ultrapassar o limite de {@link LIMITE_CONTRATOS_FISCAL} contratos ativos
 * simultâneos. "Ativo" é todo contrato cujo status (via
 * `calcularStatusContrato`) não seja 'VENCIDO'. Em edição, informe
 * `contratoIdExcluir` para não contar o próprio contrato sendo editado.
 */
export function validarLimiteFiscal(
  contratos: Contrato[],
  fiscalEmail: string,
  contratoIdExcluir?: string,
): { valido: boolean; contratosAtivos: number } {
  const contratosAtivos = contratos.filter(
    (c) =>
      c.fiscalEmail === fiscalEmail &&
      c.id !== contratoIdExcluir &&
      calcularStatusContrato(c).status !== 'VENCIDO',
  ).length;

  return { valido: contratosAtivos < LIMITE_CONTRATOS_FISCAL, contratosAtivos };
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

export type TipoOcorrencia = 'OCORRENCIA' | 'ADITIVO' | 'ESCLARECIMENTO';

export const TIPO_OCORRENCIA_LABELS: Record<TipoOcorrencia, string> = {
  OCORRENCIA: 'Ocorrência',
  ADITIVO: 'Solicitação de Aditivo',
  ESCLARECIMENTO: 'Solicitação de Esclarecimento',
};

/**
 * Ocorrência registrada sobre um contrato: tanto um apontamento do Gestor
 * ou do Fiscal (atraso na entrega, atraso de pagamento, desconformidade,
 * item não entregue etc. — descritos livremente em `descricao`) quanto uma
 * solicitação de aditivo/esclarecimento — sem workflow de aprovação, é só
 * registro histórico.
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

export type TipoAditivo = 'FINANCEIRO' | 'PRAZO' | 'FINANCEIRO_E_PRAZO';

export const TIPO_ADITIVO_LABELS: Record<TipoAditivo, string> = {
  FINANCEIRO: 'Aditivo Financeiro',
  PRAZO: 'Aditivo de Prazo',
  FINANCEIRO_E_PRAZO: 'Aditivo Financeiro e de Prazo',
};

/**
 * Aditivo (ou apostilamento) formalmente registrado sobre um contrato:
 * altera de fato o valor e/ou a vigência do contrato, com número/processo
 * e data do instrumento, para histórico e auditoria. Diferente da
 * 'Solicitação de Aditivo' (um tipo de Ocorrencia, que é só um pedido
 * informal) — este é o registro do aditivo já formalizado.
 */
export interface Aditivo {
  id: string;
  contratoId: string;
  tipo: TipoAditivo;
  numero: string;
  data: string;
  /** Presente quando tipo inclui FINANCEIRO: valor acrescido ao contrato. */
  valorAcrescido?: number;
  /** Presente quando tipo inclui PRAZO: nova data de fim de vigência. */
  novaFimVigencia?: string;
  observacao?: string;
  registradoPorId: string;
  registradoPorNome: string;
  criado_em?: string;
}

/**
 * Aplica um aditivo financeiro ao contrato: o valor acrescido soma ao
 * valor global, ao saldo inicial de referência e ao saldo atual (o
 * contrato passa a ter mais saldo disponível para novas execuções).
 */
export function aplicarAditivoFinanceiro(
  contrato: Pick<Contrato, 'valorGlobal' | 'saldoInicialFinanceiro' | 'saldoAtualFinanceiro'>,
  valorAcrescido: number,
): Pick<Contrato, 'valorGlobal' | 'saldoInicialFinanceiro' | 'saldoAtualFinanceiro'> {
  return {
    valorGlobal: (contrato.valorGlobal || 0) + valorAcrescido,
    saldoInicialFinanceiro: (contrato.saldoInicialFinanceiro || 0) + valorAcrescido,
    saldoAtualFinanceiro: (contrato.saldoAtualFinanceiro || 0) + valorAcrescido,
  };
}

export const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0,
  );
