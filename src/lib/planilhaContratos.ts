/**
 * Mapeamento das colunas da planilha "Gestão de Contratos" usadas para
 * sincronizar em mão dupla com o sistema: ao criar/editar um contrato no
 * app, grava/atualiza a linha correspondente na aba
 * `ABA_GESTAO_CONTRATOS`; colunas que o app não gerencia (Tipo, Unidade
 * Gestora, Dados do Fiscal, pasta/rótulo do contrato etc. — algumas com
 * cabeçalho desalinhado dos dados reais nessa planilha legada) nunca são
 * tocadas por essa sincronização — continuam só do preenchimento manual.
 */

export const ABA_GESTAO_CONTRATOS = 'GESTÃO DE CONTRATOS - 2026 - GERAL';

/** Índices (0-based) das colunas da planilha que o app pode gravar/atualizar. */
export const COLUNA_CONTRATO = {
  ORDEM: 0,
  EMPRESA: 2,
  N_CONTRATO: 3,
  PRD: 4,
  VALOR_PRD: 5,
  N_EMPENHO: 6,
  STATUS: 7,
  OBJETO: 8,
  INICIO_VIGENCIA: 9,
  TERMINO_VIGENCIA: 10,
  CNPJ: 17,
} as const;

export const TOTAL_COLUNAS_PLANILHA_CONTRATOS = 27;

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

/** Mesmos rótulos de status usados na planilha para a coluna H, a partir do status calculado em `contratos.ts`. */
export function statusParaTextoPlanilha(
  status: 'VIGENTE' | 'FALTA MENOS DE 90 DIAS' | 'FALTA MENOS DE 30 DIAS' | 'VENCIDO',
): string {
  switch (status) {
    case 'FALTA MENOS DE 90 DIAS':
      return 'FALTA MENOS DE 90 DIAS PARA O FIM';
    case 'FALTA MENOS DE 30 DIAS':
      return 'FALTA MENOS DE 30 DIAS PARA O FIM';
    default:
      return status;
  }
}

export interface DadosContratoParaPlanilha {
  numero: string;
  empresa: string;
  objeto: string;
  cnpj?: string;
  prd?: string;
  valorPRD?: number;
  empenho?: string;
  inicioVigencia?: string;
  fimVigencia?: string;
  status: 'VIGENTE' | 'FALTA MENOS DE 90 DIAS' | 'FALTA MENOS DE 30 DIAS' | 'VENCIDO';
}

/**
 * Monta só os valores das colunas que o app gerencia, num mapa
 * índice-da-coluna -> valor — pra mesclar numa linha existente sem mexer
 * no resto (Tipo, Unidade Gestora, Dados do Fiscal etc.).
 */
export function montarValoresColunasContrato(
  dados: DadosContratoParaPlanilha,
): Record<number, string> {
  return {
    [COLUNA_CONTRATO.EMPRESA]: dados.empresa,
    [COLUNA_CONTRATO.N_CONTRATO]: dados.numero,
    [COLUNA_CONTRATO.PRD]: dados.prd || '',
    [COLUNA_CONTRATO.VALOR_PRD]: formatarValorParaPlanilha(dados.valorPRD),
    [COLUNA_CONTRATO.N_EMPENHO]: dados.empenho || '',
    [COLUNA_CONTRATO.STATUS]: statusParaTextoPlanilha(dados.status),
    [COLUNA_CONTRATO.OBJETO]: dados.objeto,
    [COLUNA_CONTRATO.INICIO_VIGENCIA]: paraDataBR(dados.inicioVigencia),
    [COLUNA_CONTRATO.TERMINO_VIGENCIA]: paraDataBR(dados.fimVigencia),
    [COLUNA_CONTRATO.CNPJ]: dados.cnpj || '',
  };
}

/**
 * Aplica os valores de `montarValoresColunasContrato` numa linha —
 * preservando o que já estava nas colunas que o app não gerencia.
 * `linhaExistente` pode vir mais curta que o total de colunas (ou nem
 * existir, pra uma linha nova); o resultado sempre tem o tamanho cheio.
 */
export function aplicarColunasNaLinhaContrato(
  linhaExistente: string[] | undefined,
  valoresColunas: Record<number, string>,
): string[] {
  const linha = new Array(TOTAL_COLUNAS_PLANILHA_CONTRATOS).fill('');
  (linhaExistente ?? []).forEach((valor, idx) => {
    if (idx < TOTAL_COLUNAS_PLANILHA_CONTRATOS) linha[idx] = valor ?? '';
  });
  Object.entries(valoresColunas).forEach(([idx, valor]) => {
    linha[Number(idx)] = valor;
  });
  return linha;
}

/** Próximo número sequencial pra coluna "Nº" (A), a partir do valor já preenchido na linha anterior. */
export function proximoNumeroSequencialContrato(valorLinhaAnterior: string | undefined): string {
  const numero = Number.parseInt((valorLinhaAnterior ?? '').trim(), 10);
  return Number.isFinite(numero) && numero > 0 ? String(numero + 1) : '1';
}

/**
 * Acha a linha (1-based, contando o cabeçalho como linha 1) onde gravar um
 * contrato: a que já tem o mesmo N° Contrato (coluna D), ou — se for um
 * contrato novo — a primeira linha em branco nessa coluna.
 */
export function acharLinhaParaContrato(
  colunaNumero: string[],
  numeroContrato: string,
): { linha: number; ehNova: boolean } {
  const numeroNormalizado = numeroContrato.trim();
  for (let i = 1; i < colunaNumero.length; i++) {
    if ((colunaNumero[i] ?? '').trim() === numeroNormalizado) {
      return { linha: i + 1, ehNova: false };
    }
  }
  for (let i = 1; i < colunaNumero.length; i++) {
    if (!(colunaNumero[i] ?? '').trim()) {
      return { linha: i + 1, ehNova: true };
    }
  }
  return { linha: colunaNumero.length + 1, ehNova: true };
}
