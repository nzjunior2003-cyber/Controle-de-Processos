/**
 * Mapeamento das colunas da planilha "GESTÃO DE CONTRATOS - 2026
 * DESPESAS MENSAIS" (aba `ABA_GESTAO_CONTRATOS`) usada para sincronizar em
 * mão dupla com o sistema: ao criar/editar um contrato no app, grava/
 * atualiza a linha correspondente na aba; ao clicar em "Sincronizar
 * Planilha", importa da aba os contratos que ainda não existem no app e
 * atualiza os que já existem. Colunas que o app não gerencia (Data de
 * Emissão, Alerta, Ano Exercício, Valor Global/Recebido/Saldo "da
 * Vigência", Recebimentos por ano, Valor Aditivado, Valor do
 * Empenho/Reforçado/Recebido/Liquidado — controle financeiro manual da
 * planilha) nunca são tocadas por essa sincronização.
 *
 * A planilha é, na prática, várias sub-tabelas coladas manualmente ao
 * longo do ano (cada uma com seu próprio título repetido e às vezes uma
 * segunda tabela solta com colunas deslocadas) — `linhaTemOrdemValida`
 * reconhece uma linha de contrato de verdade (a única constante entre
 * as sub-tabelas é ter um número inteiro na coluna "Nº"/Ordem).
 *
 * Pior: nem todas as sub-tabelas têm as mesmas colunas depois de "Fim da
 * Vigência" — algumas têm as 4 colunas extras "da Vigência" (Ano
 * Exercício, Valor Global/Recebido/Saldo da Vigência) antes de
 * Contratada, outras não. `detectarOffsetContrato` reconhece qual das
 * duas variantes uma linha específica usa, olhando se a célula onde a
 * Contratada deveria estar parece mesmo um nome de empresa (e não um
 * valor em R$ pertencente a outra coluna).
 */
import type { Contrato } from '../types';
import { parseCurrencyBR, parseDataBR } from './csv';

export const ABA_GESTAO_CONTRATOS = 'GERAL';

/**
 * Índices (0-based) das colunas que não mudam de posição entre as duas
 * variantes de layout observadas na planilha.
 */
const COLUNA_CONTRATO_BASE = {
  ORDEM: 0,
  EMPENHO: 1,
  PRD: 2,
  DATA_EMISSAO: 3,
  PAE: 4,
  N_CONTRATO: 5,
  INICIO_VIGENCIA: 6,
  ALERTA: 7,
  FIM_VIGENCIA: 8,
} as const;

/** Deslocamento de colunas da variante "sem as 4 colunas extras da Vigência" (a mais antiga). */
const OFFSET_LAYOUT_SEM_COLUNAS_VIGENCIA = 0;
/** Deslocamento da variante atual do cabeçalho, com as 4 colunas extras da Vigência. */
const OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA = 4;

/** Índices (0-based) das colunas deslocáveis, para um deslocamento (offset) já resolvido. */
function colunasDeslocadas(offset: number) {
  return {
    ...COLUNA_CONTRATO_BASE,
    CONTRATADA: 9 + offset,
    OBJETO: 10 + offset,
    VALOR_GLOBAL: 11 + offset,
    SALDO: 22 + offset,
    FISCAL_TITULAR: 23 + offset,
    FISCAL_SUPLENTE: 24 + offset,
    DEMANDANTE: 25 + offset,
    PCA: 26 + offset,
  } as const;
}

/**
 * Índices (0-based) das colunas da planilha que o app usa como padrão —
 * a variante atual do cabeçalho (com as 4 colunas extras da Vigência),
 * usada pra gravar um contrato novo (acrescentado no fim da aba).
 */
export const COLUNA_CONTRATO = colunasDeslocadas(OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA);

/** A..AE (0..30) — cobre até a coluna PCA na variante mais larga do cabeçalho. */
export const TOTAL_COLUNAS_PLANILHA_CONTRATOS = 31;

/**
 * Reconhece se um texto parece um nome de empresa (não um valor em R$,
 * uma data ou um número puro pertencente a outra coluna) — usado pra
 * decidir qual variante de layout uma linha específica usa.
 */
function pareceNomeDeEmpresa(texto: string): boolean {
  const valor = texto.trim();
  if (!valor) return false;
  if (/^r\$/i.test(valor)) return false;
  if (/^-?\d+([.,]\d+)?$/.test(valor)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(valor)) return false;
  return /[a-zà-öø-ÿ]/i.test(valor);
}

/**
 * Descobre qual das duas variantes de layout uma linha usa, olhando se a
 * célula onde a Contratada deveria estar (na variante atual, com as 4
 * colunas extras) parece mesmo um nome de empresa; senão, tenta a
 * posição da variante antiga. Sem uma linha existente (contrato novo),
 * usa sempre a variante atual do cabeçalho.
 */
export function detectarOffsetContrato(linhaExistente: string[] | undefined): number {
  if (!linhaExistente) return OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA;
  if (pareceNomeDeEmpresa(linhaExistente[9 + OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA] ?? '')) {
    return OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA;
  }
  if (pareceNomeDeEmpresa(linhaExistente[9 + OFFSET_LAYOUT_SEM_COLUNAS_VIGENCIA] ?? '')) {
    return OFFSET_LAYOUT_SEM_COLUNAS_VIGENCIA;
  }
  return OFFSET_LAYOUT_COM_COLUNAS_VIGENCIA;
}

/**
 * Resolve o mapa de índices de coluna certo para uma linha específica
 * (existente ou não) — combina `detectarOffsetContrato` com o cálculo
 * das colunas deslocáveis, pra quem for gravar (`montarValoresColunasContrato`)
 * não precisar lidar com offsets diretamente.
 */
export function resolverColunasContrato(linhaExistente: string[] | undefined): typeof COLUNA_CONTRATO {
  return colunasDeslocadas(detectarOffsetContrato(linhaExistente));
}

const REGEX_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

function paraDataBR(iso?: string): string {
  const data = iso ? new Date(iso) : undefined;
  if (!data || Number.isNaN(data.getTime())) return '';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function formatarValorParaPlanilha(valor?: number): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '';
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * A célula "Contratada" traz o nome da empresa e, às vezes, o CNPJ numa
 * linha separada dentro da mesma célula. Separa os dois; se não achar um
 * CNPJ reconhecível, devolve o texto inteiro como nome da empresa.
 */
function separarEmpresaECnpj(texto: string): { empresa: string; cnpj?: string } {
  const linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const linhaCnpj = linhas.find((l) => REGEX_CNPJ.test(l));
  const cnpj = linhaCnpj?.match(REGEX_CNPJ)?.[0];
  const empresa = linhas.filter((l) => l !== linhaCnpj).join(' ').trim();
  return { empresa: empresa || texto.trim(), cnpj };
}

/** Inverso de `separarEmpresaECnpj`, pra gravar de volta no mesmo formato da célula. */
function composeContratada(empresa: string, cnpj?: string): string {
  return cnpj ? `${empresa}\n${cnpj}` : empresa;
}

export interface DadosContratoParaPlanilha {
  numero: string;
  empresa: string;
  objeto: string;
  cnpj?: string;
  pae?: string;
  prd?: string;
  empenho?: string;
  valorGlobal?: number;
  saldoAtualFinanceiro?: number;
  inicioVigencia?: string;
  fimVigencia?: string;
  fiscalTitular?: string;
  fiscalSuplente?: string;
  /** Só é gravada na planilha quando informada — não existe campo próprio no cadastro do app hoje. */
  unidadeDemandante?: string;
  /** Idem: só é gravada quando informada, pra não apagar o preenchimento manual na planilha. */
  pcaCodigo?: string;
}

/** Monta um `DadosContratoParaPlanilha` a partir de um Contrato do app. */
export function contratoParaDadosPlanilha(
  contrato: Pick<
    Contrato,
    | 'numero'
    | 'empresa'
    | 'objeto'
    | 'cnpj'
    | 'pae'
    | 'prd'
    | 'empenho'
    | 'valorGlobal'
    | 'saldoAtualFinanceiro'
    | 'inicioVigencia'
    | 'fimVigencia'
    | 'fiscalTitular'
    | 'fiscalSuplente'
  >,
): DadosContratoParaPlanilha {
  return {
    numero: contrato.numero,
    empresa: contrato.empresa,
    objeto: contrato.objeto,
    cnpj: contrato.cnpj,
    pae: contrato.pae,
    prd: contrato.prd,
    empenho: contrato.empenho,
    valorGlobal: contrato.valorGlobal,
    saldoAtualFinanceiro: contrato.saldoAtualFinanceiro,
    inicioVigencia: contrato.inicioVigencia,
    fimVigencia: contrato.fimVigencia,
    fiscalTitular: contrato.fiscalTitular,
    fiscalSuplente: contrato.fiscalSuplente,
  };
}

/**
 * Monta só os valores das colunas que o app gerencia, num mapa
 * índice-da-coluna -> valor — pra mesclar numa linha existente sem mexer
 * no resto (Data de Emissão, Alerta, Recebimentos por ano etc.).
 * `colunas` é o mapa de índices já resolvido pra variante de layout da
 * linha em questão (ver `detectarOffsetContrato`) — o padrão é a
 * variante atual do cabeçalho, usada pra um contrato novo.
 * Demandante e PCA só entram no mapa quando informados, porque o
 * cadastro do app ainda não tem esses campos — sem essa checagem, gravar
 * um contrato existente apagaria o que já estava preenchido manualmente
 * na planilha.
 */
export function montarValoresColunasContrato(
  dados: DadosContratoParaPlanilha,
  colunas: typeof COLUNA_CONTRATO = COLUNA_CONTRATO,
): Record<number, string> {
  const valores: Record<number, string> = {
    [colunas.CONTRATADA]: composeContratada(dados.empresa, dados.cnpj),
    [colunas.N_CONTRATO]: dados.numero,
    [colunas.PAE]: dados.pae || '',
    [colunas.PRD]: dados.prd || '',
    [colunas.EMPENHO]: dados.empenho || '',
    [colunas.OBJETO]: dados.objeto,
    [colunas.VALOR_GLOBAL]: formatarValorParaPlanilha(dados.valorGlobal),
    [colunas.SALDO]: formatarValorParaPlanilha(dados.saldoAtualFinanceiro),
    [colunas.INICIO_VIGENCIA]: paraDataBR(dados.inicioVigencia),
    [colunas.FIM_VIGENCIA]: paraDataBR(dados.fimVigencia),
    [colunas.FISCAL_TITULAR]: dados.fiscalTitular || '',
    [colunas.FISCAL_SUPLENTE]: dados.fiscalSuplente || '',
  };
  if (dados.unidadeDemandante) valores[colunas.DEMANDANTE] = dados.unidadeDemandante;
  if (dados.pcaCodigo) valores[colunas.PCA] = dados.pcaCodigo;
  return valores;
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
 * A aba "GERAL" é, na prática, várias sub-tabelas coladas manualmente uma
 * embaixo da outra ao longo do ano (uma por leva de contratos), cada uma
 * com sua própria linha de título repetida e às vezes uma linha em
 * branco de separação — mas só as linhas de contrato de verdade têm um
 * número inteiro preenchido na coluna "Nº" (Ordem); título, separador e
 * a segunda tabela solta de controle avulso (mais abaixo, com colunas
 * deslocadas) sempre têm essa coluna em branco. Por isso, "a linha é de
 * um contrato" se resume a essa única checagem — sem precisar achar
 * onde a tabela "termina".
 */
export function linhaTemOrdemValida(valorOrdem: string | undefined): boolean {
  return /^\d+$/.test((valorOrdem ?? '').trim());
}

/** Dados de um Contrato extraídos de uma linha (posicional) da planilha. */
export interface ContratoDaPlanilha {
  numero: string;
  empresa: string;
  objeto: string;
  cnpj?: string;
  pae?: string;
  prd?: string;
  empenho?: string;
  valorGlobal?: number;
  saldoAtualFinanceiro?: number;
  inicioVigencia?: string;
  fimVigencia?: string;
  fiscalTitular?: string;
  fiscalSuplente?: string;
  unidadeDemandante?: string;
  pcaCodigo?: string;
}

/**
 * Mapeia uma linha posicional (array de colunas, sem cabeçalho) da aba
 * "GERAL" para os campos que o app consegue preencher. Devolve null
 * quando a linha não tem N° do Contrato (não dá pra localizar/atualizar
 * sem essa chave — é também o sinal de que a linha é de fato um contrato,
 * não uma linha em branco ou de outra seção da planilha).
 */
export function mapLinhaContratoDaPlanilha(linha: string[]): ContratoDaPlanilha | null {
  const numero = (linha[COLUNA_CONTRATO_BASE.N_CONTRATO] ?? '').trim();
  if (!numero) return null;

  const colunas = colunasDeslocadas(detectarOffsetContrato(linha));

  const { empresa, cnpj } = separarEmpresaECnpj((linha[colunas.CONTRATADA] ?? '').trim());
  const valorGlobalTexto = (linha[colunas.VALOR_GLOBAL] ?? '').trim();
  const saldoTexto = (linha[colunas.SALDO] ?? '').trim();

  return {
    numero,
    empresa,
    cnpj,
    objeto: (linha[colunas.OBJETO] ?? '').trim(),
    pae: (linha[colunas.PAE] ?? '').trim() || undefined,
    prd: (linha[colunas.PRD] ?? '').trim() || undefined,
    empenho: (linha[colunas.EMPENHO] ?? '').trim() || undefined,
    valorGlobal: valorGlobalTexto ? parseCurrencyBR(valorGlobalTexto) : undefined,
    saldoAtualFinanceiro: saldoTexto ? parseCurrencyBR(saldoTexto) : undefined,
    inicioVigencia: parseDataBR(linha[colunas.INICIO_VIGENCIA]),
    fimVigencia: parseDataBR(linha[colunas.FIM_VIGENCIA]),
    fiscalTitular: (linha[colunas.FISCAL_TITULAR] ?? '').trim() || undefined,
    fiscalSuplente: (linha[colunas.FISCAL_SUPLENTE] ?? '').trim() || undefined,
    unidadeDemandante: (linha[colunas.DEMANDANTE] ?? '').trim() || undefined,
    pcaCodigo: (linha[colunas.PCA] ?? '').trim() || undefined,
  };
}

/**
 * Acha a linha (1-based, contando o cabeçalho como linha 1) onde gravar um
 * contrato: a que já tem o mesmo N° Contrato (coluna F) — comparação
 * exata, então não corre risco de bater com um número de empenho da
 * segunda tabela solta da planilha (formato bem diferente). Um contrato
 * novo é sempre acrescentado depois da última linha com algum conteúdo
 * em `colunaNumero` (que deve cobrir a extensão real da aba, não só a
 * tabela principal) — nunca reaproveita uma célula em branco no meio,
 * porque na aba "GERAL" uma coluna "Nº Contrato" em branco não significa
 * uma linha livre: é comum uma linha já ter PRD/Empenho preenchidos e o
 * contrato ainda não ter sido formalizado.
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
  return { linha: colunaNumero.length + 1, ehNova: true };
}
