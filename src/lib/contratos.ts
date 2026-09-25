/**
 * Regras de vigência de contratos compartilhadas por GestaoContratos e
 * FiscalContrato (antes duplicadas nas duas páginas).
 */
import { differenceInDays, format } from 'date-fns';
import type { Contrato, HistoricoFiscalContrato, ItemContrato } from '../types';

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

/** Anos distintos presentes nos números dos contratos, do mais recente pro mais antigo — alimenta o filtro "Ano". */
export function extrairAnosDisponiveis(contratos: Contrato[]): number[] {
  const anos = new Set<number>();
  for (const contrato of contratos) {
    const chave = extrairAnoNumeroContrato(contrato.numero ?? '');
    if (chave) anos.add(chave.ano);
  }
  return [...anos].sort((a, b) => b - a);
}

/** Filtra contratos pelo ano extraído do número — `null`/`undefined` devolve todos. */
export function filtrarContratosPorAno<T extends Contrato>(contratos: T[], ano: number | null): T[] {
  if (!ano) return contratos;
  return contratos.filter((c) => extrairAnoNumeroContrato(c.numero ?? '')?.ano === ano);
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

/**
 * Reconhece se um texto parece mesmo um nome de fiscal (não um valor de
 * outra coluna — moeda, número puro, data — sinal de que a linha da
 * planilha caiu no offset errado, ver `planilhaContratos.ts`).
 */
export function pareceNomeDeFiscal(texto: string): boolean {
  const valor = texto.trim();
  if (!valor) return false;
  if (/^r\$/i.test(valor)) return false;
  if (/^-?\d+([.,]\d+)?$/.test(valor)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(valor)) return false;
  return /[a-zà-öø-ÿ]/i.test(valor);
}

/**
 * Normaliza um nome de fiscal pra agrupar a mesma pessoa digitada de
 * formas ligeiramente diferentes entre contratos: espaço extra, caixa
 * diferente, ou um telefone anotado entre parênteses no final do nome.
 */
export function normalizarNomeFiscal(texto: string): string {
  return texto
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Restringe a lista aos contratos que um fiscal pode ver. */
export function filtrarContratosDoFiscal<T extends Contrato>(
  contratos: T[],
  usuario: { email: string; nome: string; mf?: string } | null,
): T[] {
  if (!usuario) return [];
  return contratos.filter(
    (c) =>
      // MF é a chave preferencial (única e imutável); e-mail/nome
      // continuam valendo como alternativa pros contratos que ainda não
      // tiverem a MF do fiscal/suplente preenchida.
      (!!usuario.mf && (c.fiscalTitularMf === usuario.mf || c.fiscalSuplenteMf === usuario.mf)) ||
      c.fiscalEmail === usuario.email ||
      c.fiscalSuplenteEmail === usuario.email ||
      (!!c.fiscalTitular && !!usuario.nome && c.fiscalTitular.includes(usuario.nome)) ||
      (!!c.fiscalSuplente && !!usuario.nome && c.fiscalSuplente.includes(usuario.nome)),
  );
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

/** Quantidade de um item do contrato consumida/recebida numa execução (NF). */
export interface ConsumoItemExecucao {
  itemId: string;
  quantidade: number;
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
  /** Itens do contrato (ver `Contrato.itens`) abatidos por esta execução, com a quantidade de cada um. */
  itensConsumidos?: ConsumoItemExecucao[];
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

/** Abate dos itens do contrato a quantidade consumida por uma execução (NF), pelo `itemId`. */
export function abaterItens(
  itens: ItemContrato[] | undefined,
  itensConsumidos: ConsumoItemExecucao[] | undefined,
): ItemContrato[] | undefined {
  if (!itens || !itensConsumidos || itensConsumidos.length === 0) return itens;
  const quantidadePorId = new Map(itensConsumidos.map((c) => [c.itemId, c.quantidade]));
  return itens.map((item) =>
    quantidadePorId.has(item.id)
      ? { ...item, quantidadeAtual: item.quantidadeAtual - (quantidadePorId.get(item.id) || 0) }
      : item,
  );
}

/** Devolve aos itens do contrato a quantidade de uma execução (NF) removida. */
export function devolverItens(
  itens: ItemContrato[] | undefined,
  itensConsumidos: ConsumoItemExecucao[] | undefined,
): ItemContrato[] | undefined {
  if (!itens || !itensConsumidos || itensConsumidos.length === 0) return itens;
  const quantidadePorId = new Map(itensConsumidos.map((c) => [c.itemId, c.quantidade]));
  return itens.map((item) =>
    quantidadePorId.has(item.id)
      ? { ...item, quantidadeAtual: item.quantidadeAtual + (quantidadePorId.get(item.id) || 0) }
      : item,
  );
}

/**
 * Aplica edições nos itens de um contrato (cadastro/edição no
 * `ContratoForm`) preservando, item a item (pelo `id`), o quanto já foi
 * consumido por execuções — assim, corrigir a quantidade inicial de um
 * item (ex.: por aditivo) não apaga o consumo já registrado.
 */
export function mesclarItensContrato(
  itensAntigos: ItemContrato[],
  itensEditados: Array<Pick<ItemContrato, 'id' | 'descricao' | 'unidade' | 'quantidadeInicial' | 'valorUnitario'>>,
): ItemContrato[] {
  const antigosPorId = new Map(itensAntigos.map((item) => [item.id, item]));
  return itensEditados.map((item) => {
    const antigo = antigosPorId.get(item.id);
    if (!antigo) return { ...item, quantidadeAtual: item.quantidadeInicial };
    const consumido = antigo.quantidadeInicial - antigo.quantidadeAtual;
    return { ...item, quantidadeAtual: Math.max(0, item.quantidadeInicial - consumido) };
  });
}

/** Soma do valor total (quantidade × valor unitário) de todos os itens — comparado ao Valor Global do contrato no cadastro. */
export function somaValorItens(itens: Array<Pick<ItemContrato, 'quantidadeInicial' | 'valorUnitario'>>): number {
  return itens.reduce((total, item) => total + item.quantidadeInicial * (item.valorUnitario || 0), 0);
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

export type TipoAditivo = 'FINANCEIRO' | 'PRAZO' | 'FINANCEIRO_E_PRAZO' | 'QUANTIDADE';

export const TIPO_ADITIVO_LABELS: Record<TipoAditivo, string> = {
  FINANCEIRO: 'Aditivo Financeiro',
  PRAZO: 'Aditivo de Prazo',
  FINANCEIRO_E_PRAZO: 'Aditivo Financeiro e de Prazo',
  QUANTIDADE: 'Aditivo de Quantidade (Itens)',
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
  /** Presente quando tipo === QUANTIDADE: itens do contrato e quanto foi acrescido a cada um. */
  itensAcrescidos?: ConsumoItemExecucao[];
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

/**
 * Aplica um aditivo de quantidade: soma o valor acrescido tanto à
 * quantidade inicial quanto à atual de cada item informado — diferente
 * de uma execução (que só abate a atual), um aditivo aumenta o total
 * contratado do item.
 */
export function aplicarAditivoQuantidade(
  itens: ItemContrato[] | undefined,
  itensAcrescidos: ConsumoItemExecucao[] | undefined,
): ItemContrato[] | undefined {
  if (!itens || !itensAcrescidos || itensAcrescidos.length === 0) return itens;
  const acrescimoPorId = new Map(itensAcrescidos.map((c) => [c.itemId, c.quantidade]));
  return itens.map((item) => {
    const acrescimo = acrescimoPorId.get(item.id);
    if (!acrescimo) return item;
    return {
      ...item,
      quantidadeInicial: item.quantidadeInicial + acrescimo,
      quantidadeAtual: item.quantidadeAtual + acrescimo,
    };
  });
}

/**
 * Fecha um novo período no histórico de Fiscal Titular/Suplente do
 * contrato sempre que esses campos mudam numa edição — devolve
 * `undefined` quando não houve mudança de fiscal (não escrever o campo,
 * pra não sobrescrever à toa) ou quando o contrato nunca teve fiscal
 * definido antes (nada a fechar/registrar na primeira atribuição).
 */
export function registrarTrocaFiscal(
  contrato: Pick<
    Contrato,
    | 'fiscalTitular'
    | 'fiscalEmail'
    | 'fiscalTitularContato'
    | 'fiscalSuplente'
    | 'fiscalSuplenteEmail'
    | 'fiscalSuplenteContato'
    | 'historicoFiscal'
    | 'criado_em'
  >,
  novosDados: Partial<Pick<Contrato, 'fiscalTitular' | 'fiscalEmail' | 'fiscalSuplente' | 'fiscalSuplenteEmail'>>,
  agora: string = new Date().toISOString(),
): HistoricoFiscalContrato[] | undefined {
  const mudou = (['fiscalTitular', 'fiscalEmail', 'fiscalSuplente', 'fiscalSuplenteEmail'] as const).some(
    (campo) => campo in novosDados && novosDados[campo] !== contrato[campo],
  );
  if (!mudou) return undefined;
  if (!contrato.fiscalTitular && !contrato.fiscalSuplente) return undefined;

  const historicoAnterior = contrato.historicoFiscal ?? [];
  const ultimaAte = historicoAnterior[historicoAnterior.length - 1]?.ate;
  // O Firestore rejeita `undefined` em qualquer campo (mesmo dentro de um
  // array) — vários contratos antigos nunca tiveram contato do fiscal
  // preenchido, então cada campo opcional só entra no objeto quando tem
  // valor de fato, em vez de sempre copiar `contrato.campo` (que pode ser
  // `undefined`).
  const entradaFechada: HistoricoFiscalContrato = {
    id: crypto.randomUUID(),
    ...(contrato.fiscalTitular ? { fiscalTitular: contrato.fiscalTitular } : {}),
    ...(contrato.fiscalEmail ? { fiscalEmail: contrato.fiscalEmail } : {}),
    ...(contrato.fiscalTitularContato ? { fiscalTitularContato: contrato.fiscalTitularContato } : {}),
    ...(contrato.fiscalSuplente ? { fiscalSuplente: contrato.fiscalSuplente } : {}),
    ...(contrato.fiscalSuplenteEmail ? { fiscalSuplenteEmail: contrato.fiscalSuplenteEmail } : {}),
    ...(contrato.fiscalSuplenteContato ? { fiscalSuplenteContato: contrato.fiscalSuplenteContato } : {}),
    desde: ultimaAte ?? contrato.criado_em ?? agora,
    ate: agora,
  };
  return [...historicoAnterior, entradaFechada];
}

export const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0,
  );

/**
 * Interpreta um valor monetário digitado tanto no formato BR ("19.239,92")
 * quanto no formato "cru" que um <input type="number"> devolve ("19239.92")
 * — um <input type="number"> comum aceita silenciosamente "19.239,92" como
 * "19.23992" (ponto = decimal, vírgula descartada), corrompendo o valor sem
 * nenhum aviso. Usado nos campos de dinheiro do formulário de contrato, que
 * por isso são <input type="text"> em vez de type="number".
 */
export function parseValorMonetario(texto: string): number {
  const limpo = texto.replace(/[^0-9.,-]/g, '').trim();
  if (!limpo) return 0;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal; o outro é de milhar.
    const decimalEhVirgula = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
    const normalizado = decimalEhVirgula
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
    return parseFloat(normalizado) || 0;
  }

  if (temVirgula) {
    return parseFloat(limpo.replace(',', '.')) || 0;
  }

  if (temPonto) {
    // Só ponto: ambíguo entre decimal ("19239.92") e milhar ("19.239").
    // Trata como milhar só quando há exatamente 3 dígitos depois do único
    // ponto — o padrão de "R$ 19.239" sem centavos.
    const partes = limpo.split('.');
    if (partes.length === 2 && partes[1].length === 3) {
      return parseFloat(limpo.replace('.', '')) || 0;
    }
    return parseFloat(limpo) || 0;
  }

  return parseFloat(limpo) || 0;
}

const COLUNAS_CSV_CONTRATOS = [
  'Nº Contrato', 'PAE', 'Empresa', 'CNPJ', 'Objeto', 'Início Vigência', 'Fim Vigência',
  'Valor Global', 'Saldo Atual', 'Fiscal Titular', 'Fiscal Suplente', 'Situação',
];

const formatarDataCsv = (valor?: string): string => {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : format(data, 'dd/MM/yyyy');
};

/** Monta colunas/linhas de contratos pra exportação em CSV (art. 6.8 da PIDS/DTIC). */
export function linhasCsvContratos(contratos: Contrato[]): { colunas: string[]; linhas: (string | number)[][] } {
  const linhas = contratos.map((c) => [
    c.numero ?? '',
    c.pae ?? '',
    c.empresa ?? '',
    c.cnpj ?? '',
    c.objeto ?? '',
    formatarDataCsv(c.inicioVigencia),
    formatarDataCsv(c.fimVigencia),
    c.valorGlobal ?? 0,
    c.saldoAtualFinanceiro ?? '',
    c.fiscalTitular ?? '',
    c.fiscalSuplente ?? '',
    c.concluido ? 'Concluído' : 'Em andamento',
  ]);
  return { colunas: COLUNAS_CSV_CONTRATOS, linhas };
}
