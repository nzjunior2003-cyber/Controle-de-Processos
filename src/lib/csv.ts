/**
 * Parsing de planilhas do PCA (Google Sheets exportado como CSV).
 * Lógica pura, extraída do AppContext para poder ser testada isoladamente.
 */
import type { PCA, StatusProcesso } from '../types';

/**
 * Converte um valor monetário no formato brasileiro para número.
 *
 * Exemplos:
 *   "R$ 1.500.000,50" -> 1500000.5
 *   "1.500"           -> 1500      (ponto como separador de milhar)
 *   "1500.75"         -> 1500.75   (ponto como separador decimal)
 *   ""/lixo           -> 0
 */
export function parseCurrencyBR(entrada: unknown): number {
  if (typeof entrada === 'number') {
    return Number.isFinite(entrada) ? entrada : 0;
  }
  if (entrada === null || entrada === undefined) return 0;

  let texto = String(entrada).trim();
  if (!texto) return 0;

  const negativo = /^\(.*\)$/.test(texto) || texto.includes('-');
  texto = texto.replace(/[^\d.,]/g, '');
  if (!texto) return 0;

  const temVirgula = texto.includes(',');
  const temPonto = texto.includes('.');

  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal.
    if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (temVirgula) {
    // Só vírgula: sempre decimal no padrão brasileiro.
    texto = texto.replace(/,(?=.*,)/g, '').replace(',', '.');
  } else if (temPonto) {
    // Só ponto: milhar quando há mais de um ponto ou grupo final de 3 dígitos.
    const pontos = (texto.match(/\./g) ?? []).length;
    if (pontos > 1 || /^\d+\.\d{3}$/.test(texto)) {
      texto = texto.replace(/\./g, '');
    }
  }

  const numero = parseFloat(texto);
  if (!Number.isFinite(numero)) return 0;
  return negativo ? -Math.abs(numero) : numero;
}

/** Uma linha da planilha lida com cabeçalho (PapaParse `header: true`). */
export type LinhaPlanilha = Record<string, string | undefined>;

/**
 * Mapeia uma linha da aba "GERAL PCA" (com cabeçalho) para um item de PCA.
 */
export function mapSheetRowToPca(
  linha: LinhaPlanilha,
  indice: number,
  exercicio: number = new Date().getFullYear(),
): PCA {
  const valor = (chave: string) => (linha[chave] ?? '').toString().trim();

  return {
    id: `pca-sheet-${indice}`,
    codigo_pca: valor('ORDEM'),
    objeto_pca: valor('DESCRIÇÃO'),
    exercicio,
    unidade_responsavel: valor('DEMANDANTE'),
    valor_previsto: parseCurrencyBR(valor('VALOR DO RECURSO')),
    item_pca: valor('ITEM'),
    grupo_pca: valor('GRUPO'),
    fonte_recurso: valor('FONTE DO RECURSO'),
  };
}

/**
 * Converte uma data no formato brasileiro (d/m/aaaa) para ISO 8601.
 * Devolve undefined para datas ausentes/incompletas (ex.: sem ano), em vez
 * de lançar ou gerar uma data inválida.
 */
export function parseDataBR(entrada: unknown): string | undefined {
  const texto = (entrada ?? '').toString().trim();
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!partes) return undefined;

  const [, dia, mes, ano] = partes;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
}

/** Lê uma célula da linha por nome de coluna, tolerando espaços extras no cabeçalho. */
function celula(linha: LinhaPlanilha, nomeColuna: string): string {
  const normalizado = nomeColuna.trim().toLowerCase();
  const chave = Object.keys(linha).find((k) => k.trim().toLowerCase() === normalizado);
  return chave ? (linha[chave] ?? '').toString().trim() : '';
}

function inferirStatusProcesso(subfase: string): StatusProcesso {
  const valor = subfase.toUpperCase();
  if (valor.includes('CANCELADO')) return 'arquivado';
  if (valor.includes('CONTRATADO')) return 'contratado_aditivado';
  if (valor.includes('FINALIZADO')) return 'concluido';
  return 'em_andamento';
}

/**
 * Campos de um Processo extraídos da planilha de controle (a mesma
 * atualizada pelo RPA de acompanhamento no PAE). Não inclui os campos que o
 * próprio sistema gerencia (id, criado_em, atualizado_em, demandante_id,
 * pca_id, checklist_rito) — esses ficam por conta de quem grava.
 */
export interface ProcessoDaPlanilha {
  numero_processo: string;
  objeto: string;
  unidade_demandante: string;
  status: StatusProcesso;
  fonte?: string;
  natureza_despesa?: string;
  valor_estimado?: number;
  rito_processual?: string;
  fase_processo?: string;
  subfase_processo?: string;
  localizacao_atual?: string;
  andamento?: string;
  data_entrada?: string;
  ultima_tramitacao?: string;
}

/**
 * Mapeia uma linha (com cabeçalho) da planilha de controle de processos.
 * Devolve null quando a linha não tem número de processo (não dá pra
 * localizar/atualizar sem essa chave).
 */
export function mapSheetRowToProcesso(linha: LinhaPlanilha): ProcessoDaPlanilha | null {
  const numeroBruto = celula(linha, 'N° PAE');
  if (!numeroBruto) return null;

  const subfase = celula(linha, 'SUBFASE DO PROCESSO');

  return {
    numero_processo: numeroBruto.replace(/^E-/i, ''),
    objeto: celula(linha, 'OBJETO'),
    unidade_demandante: celula(linha, 'SETOR DEMANDANTE'),
    status: inferirStatusProcesso(subfase),
    fonte: celula(linha, 'FONTE') || undefined,
    natureza_despesa: celula(linha, 'NATUREZA DE DESPESA') || undefined,
    valor_estimado: celula(linha, 'V. ESTIMADO') ? parseCurrencyBR(celula(linha, 'V. ESTIMADO')) : undefined,
    rito_processual: celula(linha, 'RITO PROCESSUAL') || undefined,
    fase_processo: celula(linha, 'FASE DO PROCESSO') || undefined,
    subfase_processo: subfase || undefined,
    localizacao_atual: celula(linha, 'SETOR ATUAL') || undefined,
    andamento: celula(linha, 'ANDAMENTO') || undefined,
    data_entrada: parseDataBR(celula(linha, 'DATA DE CADASTRO') || celula(linha, 'DATA DE ENTRADA')),
    ultima_tramitacao: parseDataBR(celula(linha, 'ÚLTIMA TRAMITAÇÃO')),
  };
}

/** Id da planilha de controle de processos (compartilhada por leitura e escrita). */
export const ID_PLANILHA_PROCESSOS = '1deakLqP8-enEgY384EkFyYedgo5WYSONjvYIBJDwqXE';
export const URL_PLANILHA_PROCESSOS = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_PROCESSOS}/edit?usp=sharing`;

/** Id da planilha de Gestão de Contratos (aba "GERAL" da "GESTÃO DE CONTRATOS - 2026 DESPESAS MENSAIS"). */
export const ID_PLANILHA_CONTRATOS = '1pL_00gdCSdduzJjGxCO-H1xjbQx-yo4QqHAN8g6ef8c';
export const URL_PLANILHA_CONTRATOS = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_CONTRATOS}/edit?usp=sharing`;

/**
 * Mapeia uma linha posicional (planilha sem cabeçalho reconhecido) para um PCA.
 * Usado na sincronização manual a partir de uma URL pública qualquer.
 */
export function mapSheetArrayToPca(
  colunas: string[],
  indice: number,
  exercicio: number = new Date().getFullYear(),
): PCA {
  const valor = (posicao: number) => (colunas[posicao] ?? '').toString().trim();

  return {
    id: `pca-sheet-${indice}`,
    codigo_pca: valor(0) || `PCA-X-${indice}`,
    objeto_pca: valor(1) || 'Sem Objeto',
    exercicio: parseInt(valor(2), 10) || exercicio,
    unidade_responsavel: valor(3) || 'Desconhecida',
    valor_previsto: parseCurrencyBR(valor(4)),
    item_pca: valor(5),
    grupo_pca: valor(6),
    fonte_recurso: valor(7),
  };
}
