/**
 * Classificação orçamentária (os campos da ficha da Diretoria de Finanças) —
 * catálogo código→descrição e o controle de quanto já foi pago em cada um.
 */
import { statusDoPagamento, valorDoPagamento } from './financeiro';
import {
  CAMPOS_ORCAMENTARIOS,
  type CampoOrcamentario,
  type ClassificacaoOrcamentaria,
  type DotacaoOrcamentaria,
  type ItemCatalogoOrcamentario,
  type PagamentoContrato,
} from '../types';

/** O item do checklist é o da dotação orçamentária? (ignora acento/caixa; aceita variações do nome) */
export const ehItemDotacaoOrcamentaria = (item: string) =>
  item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('dotacao orcamentaria');

/** Código como foi digitado, sem espaços sobrando nas pontas/meio. */
export const normalizarCodigoOrcamentario = (codigo: string) => codigo.trim().replace(/\s+/g, ' ');

/** Chave de comparação: ignora caixa e espaços (ex.: "pae4108825c" = "PAE4108825C"). */
const chaveCodigo = (codigo: string) => normalizarCodigoOrcamentario(codigo).replace(/\s/g, '').toUpperCase();

/** Id determinístico do item de catálogo — o mesmo código nunca vira dois documentos. */
export function idItemCatalogo(campo: CampoOrcamentario, codigo: string): string {
  return `${campo}__${chaveCodigo(codigo).replace(/[/\\.#?[\]]/g, '_')}`;
}

/** Descrição cadastrada pra um código, ou '' quando não existe. */
export function descricaoDoCodigo(
  catalogo: Pick<ItemCatalogoOrcamentario, 'campo' | 'codigo' | 'descricao'>[],
  campo: CampoOrcamentario,
  codigo?: string,
): string {
  if (!codigo || !codigo.trim()) return '';
  const chave = chaveCodigo(codigo);
  return catalogo.find((i) => i.campo === campo && chaveCodigo(i.codigo) === chave)?.descricao ?? '';
}

/** Mantém só os campos preenchidos (o Firestore não aceita `undefined`) e tira linhas vazias. */
export function limparClassificacoes(linhas: ClassificacaoOrcamentaria[]): ClassificacaoOrcamentaria[] {
  return linhas
    .map((linha) =>
      Object.fromEntries(
        CAMPOS_ORCAMENTARIOS.map(({ chave }) => [chave, normalizarCodigoOrcamentario(linha[chave] ?? '')] as const).filter(
          ([, valor]) => valor !== '',
        ),
      ) as ClassificacaoOrcamentaria,
    )
    .filter((linha) => Object.keys(linha).length > 0);
}

/** Classificação de uma ficha orçamentária cadastrada no Financeiro (DotacaoOrcamentaria). */
export function classificacaoDaDotacao(d: DotacaoOrcamentaria): ClassificacaoOrcamentaria {
  const bruta: ClassificacaoOrcamentaria = {
    unidadeGestora: d.unidadeGestora,
    programaTrabalho: d.funcionalProgramatica,
    projetoAtividade: d.projetoAtividade,
    naturezaDespesa: d.naturezaDespesa,
    fonte: d.fonteCodigo ?? d.fonteRecurso,
    detalhamento: d.detalhamento,
    planoInterno: d.planoInterno,
  };
  return limparClassificacoes([bruta])[0] ?? {};
}

/** Classificação efetiva de um pagamento: a gravada nele, ou a da dotação ligada a ele. */
export function classificacaoDoPagamento(
  p: Pick<PagamentoContrato, 'classificacao' | 'dotacaoId'>,
  dotacoes: DotacaoOrcamentaria[],
): ClassificacaoOrcamentaria {
  if (p.classificacao && Object.keys(p.classificacao).length > 0) return p.classificacao;
  const dotacao = p.dotacaoId ? dotacoes.find((d) => d.id === p.dotacaoId) : undefined;
  return dotacao ? classificacaoDaDotacao(dotacao) : {};
}

export interface TotalOrcamentario {
  /** Código do campo; 'Sem classificação' quando o pagamento não informa. */
  codigo: string;
  pago: number;
  emTramitacao: number;
  quantidade: number;
}

export const SEM_CLASSIFICACAO = 'Sem classificação';

/**
 * Quanto já foi pago (OB feita) e quanto está em tramitação em cada código de
 * um campo (fonte, programa de trabalho, natureza, plano interno, unidade
 * gestora...). Arquivados ficam de fora; `exercicio` filtra pela competência.
 */
export function totaisPorCampoOrcamentario(
  pagamentos: PagamentoContrato[],
  dotacoes: DotacaoOrcamentaria[],
  campo: CampoOrcamentario,
  exercicio?: number,
): TotalOrcamentario[] {
  const porCodigo = new Map<string, TotalOrcamentario>();
  pagamentos.forEach((p) => {
    const status = statusDoPagamento(p);
    if (status === 'arquivado') return;
    if (exercicio !== undefined && !(p.competencia ?? p.dataPagamento ?? p.criado_em ?? '').startsWith(String(exercicio))) return;
    const codigo = classificacaoDoPagamento(p, dotacoes)[campo] || SEM_CLASSIFICACAO;
    const chave = chaveCodigo(codigo);
    const atual = porCodigo.get(chave) ?? { codigo, pago: 0, emTramitacao: 0, quantidade: 0 };
    const valor = valorDoPagamento(p);
    if (status === 'pago') atual.pago += valor;
    else atual.emTramitacao += valor;
    atual.quantidade += 1;
    porCodigo.set(chave, atual);
  });
  return Array.from(porCodigo.values()).sort((a, b) => b.pago + b.emTramitacao - (a.pago + a.emTramitacao));
}
