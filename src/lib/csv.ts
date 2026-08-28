/**
 * Parsing de planilhas do PCA (Google Sheets exportado como CSV).
 * Lógica pura, extraída do AppContext para poder ser testada isoladamente.
 */
import type { PCA } from '../types';

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
