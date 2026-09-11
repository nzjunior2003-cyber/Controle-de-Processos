/**
 * Mapeamento das colunas da planilha de controle de processos usadas
 * para sincronizar em mão dupla com o sistema: ao criar/editar um
 * processo no app, grava/atualiza a linha correspondente; colunas que o
 * app não gerencia (Setor Atual, Última Tramitação, Status SEPLAD/GTAF,
 * valores homologado/executado, Fase/Subfase) nunca são tocadas por essa
 * sincronização — continuam só do RPA/preenchimento manual.
 */
import type { Processo } from '../types';

export const OPCOES_NATUREZA_DESPESA = [
  'CONSUMO',
  'CONSUMO E PERMANENTE',
  'PERMANENTE',
  'PERMANENTE E SERVIÇO',
  'SERVIÇO',
  'SERVIÇO E INVESTIMENTO',
];

export const OPCOES_FONTE_PROCESSO = [
  'A DEFINIR',
  'BNDES',
  'FEBOM',
  'NOA',
  'PREGÃO ELETRÔNICO',
  'SRP',
  'TED MPPA',
  'TESOURO',
];

/** Rótulo gravado na coluna Q (Subfase do Processo) ao marcar um processo como contratado/aditivado pelo app. */
export const SUBFASE_CONTRATADO_ADITIVADO = 'CONTRATADO/ADITIVADO';

/** Índices (0-based) das colunas da planilha que o app pode gravar/atualizar. */
export const COLUNA = {
  ORDEM: 0,
  N_PAE: 1,
  OBJETO: 2,
  OBSERVACAO: 6,
  SETOR_DEMANDANTE: 7,
  NATUREZA_DESPESA: 8,
  FONTE: 9,
  V_ESTIMADO: 11,
  RITO_PROCESSUAL: 14,
  SUBFASE_PROCESSO: 16,
  ANDAMENTO: 18,
  DATA_ENTRADA: 20,
  ANO_ENTRADA: 23,
  PREVISAO_NO_PCA: 24,
} as const;

export const TOTAL_COLUNAS_PLANILHA = 26;

function paraDataBR(iso?: string): string {
  const data = iso ? new Date(iso) : undefined;
  if (!data || Number.isNaN(data.getTime())) return '';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function formatarValorParaPlanilha(valor?: number): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor === 0) return '';
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DadosProcessoParaPlanilha {
  numero_processo: string;
  objeto: string;
  descricao?: string;
  unidade_demandante: string;
  natureza_despesa?: string;
  fonte?: string;
  valor_estimado?: number;
  rito_processual?: string;
  andamento?: string;
  data_entrada?: string;
  pca_id?: string;
  /**
   * Só é gravada na planilha quando informada — o app não gerencia essa
   * coluna no dia a dia (é do RPA/preenchimento manual), então omitir a
   * chave preserva o que já estava lá. Hoje só é usada pra marcar
   * `SUBFASE_CONTRATADO_ADITIVADO` a partir do app.
   */
  subfase_processo?: string;
}

/**
 * Monta só os valores das colunas que o app gerencia, num mapa
 * índice-da-coluna -> valor — pra mesclar numa linha existente sem
 * mexer no resto (Setor Atual, Última Tramitação etc.).
 */
export function montarValoresColunasProcesso(
  dados: DadosProcessoParaPlanilha,
): Record<number, string> {
  const valores: Record<number, string> = {
    [COLUNA.N_PAE]: /^E-/i.test(dados.numero_processo) ? dados.numero_processo : `E-${dados.numero_processo}`,
    [COLUNA.OBJETO]: dados.objeto,
    [COLUNA.OBSERVACAO]: dados.descricao || '',
    [COLUNA.SETOR_DEMANDANTE]: dados.unidade_demandante,
    [COLUNA.NATUREZA_DESPESA]: dados.natureza_despesa || '',
    [COLUNA.FONTE]: dados.fonte || '',
    [COLUNA.V_ESTIMADO]: formatarValorParaPlanilha(dados.valor_estimado),
    [COLUNA.RITO_PROCESSUAL]: dados.rito_processual || '',
    [COLUNA.ANDAMENTO]: dados.andamento || '',
    [COLUNA.DATA_ENTRADA]: paraDataBR(dados.data_entrada),
    [COLUNA.ANO_ENTRADA]: dados.data_entrada ? paraDataBR(dados.data_entrada).slice(-4) : '',
    [COLUNA.PREVISAO_NO_PCA]: dados.pca_id ? 'SIM' : 'NÃO',
  };
  if (dados.subfase_processo !== undefined) {
    valores[COLUNA.SUBFASE_PROCESSO] = dados.subfase_processo;
  }
  return valores;
}

/** Monta um `DadosProcessoParaPlanilha` a partir de um Processo do app, pra reaproveitar em qualquer tela que precise sincronizar. */
export function processoParaDadosPlanilha(
  processo: Pick<
    Processo,
    | 'numero_processo'
    | 'objeto'
    | 'descricao'
    | 'unidade_demandante'
    | 'natureza_despesa'
    | 'fonte'
    | 'valor_estimado'
    | 'rito_processual'
    | 'andamento'
    | 'data_entrada'
    | 'pca_id'
  >,
): DadosProcessoParaPlanilha {
  return {
    numero_processo: processo.numero_processo,
    objeto: processo.objeto,
    descricao: processo.descricao,
    unidade_demandante: processo.unidade_demandante,
    natureza_despesa: processo.natureza_despesa,
    fonte: processo.fonte,
    valor_estimado: processo.valor_estimado,
    rito_processual: processo.rito_processual,
    andamento: processo.andamento,
    data_entrada: processo.data_entrada,
    pca_id: processo.pca_id,
  };
}

/**
 * Aplica os valores de `montarValoresColunasProcesso` numa linha —
 * preservando o que já estava nas colunas que o app não gerencia.
 * `linhaExistente` pode vir mais curta que o total de colunas (ou nem
 * existir, pra uma linha nova); o resultado sempre tem o tamanho cheio.
 */
export function aplicarColunasNaLinha(
  linhaExistente: string[] | undefined,
  valoresColunas: Record<number, string>,
): string[] {
  const linha = new Array(TOTAL_COLUNAS_PLANILHA).fill('');
  (linhaExistente ?? []).forEach((valor, idx) => {
    if (idx < TOTAL_COLUNAS_PLANILHA) linha[idx] = valor ?? '';
  });
  Object.entries(valoresColunas).forEach(([idx, valor]) => {
    linha[Number(idx)] = valor;
  });
  return linha;
}

/**
 * Próximo número sequencial pra coluna "Ordem" (A), a partir do valor
 * já preenchido na linha anterior — soma 1 se for numérico, senão
 * recomeça em 1 (primeira linha de dados, ou número anterior não numérico).
 */
export function proximoNumeroSequencial(valorLinhaAnterior: string | undefined): string {
  const numero = Number.parseInt((valorLinhaAnterior ?? '').trim(), 10);
  return Number.isFinite(numero) && numero > 0 ? String(numero + 1) : '1';
}

/**
 * Acha a linha (1-based, contando o cabeçalho como linha 1) onde gravar
 * um processo: a que já tem o mesmo N° PAE, ou — se for um processo
 * novo — a primeira linha em branco na coluna do N° PAE.
 */
export function acharLinhaParaProcesso(
  colunaPae: string[],
  numeroProcessoComPrefixo: string,
): { linha: number; ehNova: boolean } {
  for (let i = 1; i < colunaPae.length; i++) {
    if ((colunaPae[i] ?? '').trim() === numeroProcessoComPrefixo) {
      return { linha: i + 1, ehNova: false };
    }
  }
  for (let i = 1; i < colunaPae.length; i++) {
    if (!(colunaPae[i] ?? '').trim()) {
      return { linha: i + 1, ehNova: true };
    }
  }
  return { linha: colunaPae.length + 1, ehNova: true };
}
