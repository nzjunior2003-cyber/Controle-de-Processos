/**
 * Painel do PCA (ex-dashboard "dashboard-pca-cbmpa", agora dentro do sistema).
 * Mesma lógica de status/KPIs/insights do original, lendo os itens do PCA e os
 * processos do próprio sistema (em vez de baixar duas planilhas pelo navegador).
 */
import type { PCA, Processo } from '../types';

export type PrioridadePca = 'ALTA' | 'MÉDIA' | 'BAIXA' | 'NÃO INFORMADA';
export type StatusPca = 'contratado' | 'andamento' | 'aguardando';

export const STATUS_PCA_META: Record<StatusPca, { rotulo: string; cor: string; classe: string }> = {
  contratado: { rotulo: 'Contratado', cor: '#34a56f', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  andamento: { rotulo: 'Em andamento', cor: '#e0b425', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  aguardando: { rotulo: 'Aguardando instrução', cor: '#dc5a4a', classe: 'bg-red-100 text-red-800 border-red-200' },
};

export interface ItemPca {
  id: string;
  ordem: string;
  origem: string;
  demandante: string;
  item: string;
  subitem: string;
  grupo: string;
  descricao: string;
  quantidade: string;
  valorUnitario: number | null;
  /** Quantidade × valor unitário quando dá para calcular; senão, o valor do recurso. */
  valorTotalEstimado: number | null;
  /** "Valor do Recurso" (coluna O da planilha do PCA). */
  valorRecurso: number | null;
  prioridade: string;
  prioridadeKey: PrioridadePca;
  dataDesejada: string;
  contratoNovo: boolean | undefined;
  fonteRecurso: string;
  modalidade: string;
  paeRaw: string;
  paeList: string[];
  temPae: boolean;
  status: StatusPca;
}

/** "E-2026/2432699" -> "2026/2432699" (para comparar PAEs escritos de jeitos diferentes). */
export function normalizarPae(pae: string): string {
  return pae.trim().toUpperCase().replace(/^E\s*-?\s*/, '').replace(/\s+/g, '');
}

/**
 * Extrai os PAEs de uma célula que pode ter um ou vários, em formatos como
 * "E-2026/2432699", "2026/2741168" ou "E - 2025/2738090". Ignora placeholders
 * como "2026/XXXXX (em instrução)".
 */
export function extrairPaes(texto: string | undefined): string[] {
  if (!texto) return [];
  const achados = texto.match(/\b[Ee]?\s*-?\s*\d{4}\s*\/\s*\d{5,9}\b/g) ?? [];
  // Sempre no formato "E-AAAA/NNNNNNN", venha a célula com ou sem o "E-".
  return achados.map((m) => `E-${m.replace(/\s+/g, '').replace(/^E-?/i, '')}`);
}

export function prioridadeDe(texto: string | undefined): PrioridadePca {
  const t = (texto ?? '').trim().toUpperCase();
  if (t.startsWith('ALTA')) return 'ALTA';
  if (t.startsWith('MEDIA') || t.startsWith('MÉDIA')) return 'MÉDIA';
  if (t.startsWith('BAIXA')) return 'BAIXA';
  return 'NÃO INFORMADA';
}

/** Conjunto dos PAEs (normalizados) de processos já contratados/aditivados. */
export function paesContratados(processos: Pick<Processo, 'numero_processo' | 'status' | 'subfase_processo'>[]): Set<string> {
  const conjunto = new Set<string>();
  processos.forEach((p) => {
    const subfase = (p.subfase_processo ?? '').replace(/^\d+\s*/, '').trim().toUpperCase();
    if (p.status === 'contratado_aditivado' || subfase === 'CONTRATADO') conjunto.add(normalizarPae(p.numero_processo));
  });
  return conjunto;
}

const numeroDe = (texto: string | undefined): number | null => {
  if (!texto) return null;
  const n = Number(texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && texto.trim() !== '' ? n : null;
};

export function paraItemPca(pca: PCA, contratados: Set<string>): ItemPca {
  const paeList = extrairPaes(pca.numero_pae);
  const quantidade = numeroDe(pca.quantidade);
  const unitario = typeof pca.valor_unitario_estimado === 'number' && pca.valor_unitario_estimado > 0 ? pca.valor_unitario_estimado : null;
  const recurso = typeof pca.valor_previsto === 'number' && pca.valor_previsto > 0 ? pca.valor_previsto : null;
  const total = quantidade != null && quantidade > 0 && unitario != null ? Math.round(quantidade * unitario * 100) / 100 : recurso;
  const contratado = paeList.some((p) => contratados.has(normalizarPae(p)));
  return {
    id: pca.id,
    ordem: pca.codigo_pca ?? '',
    origem: pca.origem ?? '',
    demandante: pca.unidade_responsavel ?? '',
    item: pca.item_pca ?? '',
    subitem: pca.subitem ?? '',
    grupo: pca.grupo_pca ?? '',
    descricao: pca.objeto_pca ?? '',
    quantidade: pca.quantidade ?? '',
    valorUnitario: unitario,
    valorTotalEstimado: total,
    valorRecurso: recurso,
    prioridade: pca.prioridade ?? '',
    prioridadeKey: prioridadeDe(pca.prioridade),
    dataDesejada: pca.data_desejada ?? '',
    contratoNovo: pca.contrato_novo,
    fonteRecurso: pca.fonte_recurso ?? '',
    modalidade: pca.modalidade_licitacao ?? '',
    paeRaw: pca.numero_pae ?? '',
    paeList,
    temPae: paeList.length > 0,
    status: contratado ? 'contratado' : paeList.length > 0 ? 'andamento' : 'aguardando',
  };
}

// ------------------------------------------------------------------ KPIs

export interface KpisPca {
  totalItens: number;
  valorTotalEstimado: number;
  valorRecurso: number;
  itensComPae: number;
  itensSemPae: number;
  altaPrioridadeSemPae: number;
  valorSemPae: number;
}

const soma = (itens: ItemPca[], valor: (i: ItemPca) => number) => itens.reduce((acc, i) => acc + valor(i), 0);

export function calcularKpisPca(itens: ItemPca[]): KpisPca {
  const semPae = itens.filter((i) => !i.temPae);
  return {
    totalItens: itens.length,
    valorTotalEstimado: soma(itens, (i) => i.valorTotalEstimado ?? 0),
    valorRecurso: soma(itens, (i) => i.valorRecurso ?? 0),
    itensComPae: itens.length - semPae.length,
    itensSemPae: semPae.length,
    altaPrioridadeSemPae: semPae.filter((i) => i.prioridadeKey === 'ALTA').length,
    valorSemPae: soma(semPae, (i) => i.valorTotalEstimado ?? 0),
  };
}

// ----------------------------------------------------------- agrupamentos

const SEM_INFO = '(não informado)';

export interface DemandanteEmpilhado {
  demandante: string;
  comPae: number;
  semPae: number;
  total: number;
}

/** Itens por demandante divididos em com/sem PAE (gráfico empilhado). */
export function empilhadoPorDemandante(itens: ItemPca[], topo = 10): DemandanteEmpilhado[] {
  const mapa = new Map<string, DemandanteEmpilhado>();
  itens.forEach((i) => {
    const rotulo = i.demandante.trim() || SEM_INFO;
    const atual = mapa.get(rotulo) ?? { demandante: rotulo, comPae: 0, semPae: 0, total: 0 };
    if (i.temPae) atual.comPae += 1;
    else atual.semPae += 1;
    atual.total += 1;
    mapa.set(rotulo, atual);
  });
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, topo);
}

export interface FonteEmpilhada {
  fonte: string;
  contratadoValor: number;
  contratadoQtd: number;
  andamentoValor: number;
  andamentoQtd: number;
  aguardandoValor: number;
  aguardandoQtd: number;
  total: number;
  totalQtd: number;
}

/** Valor do recurso e nº de itens por fonte, divididos pelos 3 status (gráfico empilhado). */
export function empilhadoPorFonte(itens: ItemPca[], topo = 12): FonteEmpilhada[] {
  const mapa = new Map<string, FonteEmpilhada>();
  itens.forEach((i) => {
    const rotulo = i.fonteRecurso.trim() || SEM_INFO;
    const atual =
      mapa.get(rotulo) ??
      { fonte: rotulo, contratadoValor: 0, contratadoQtd: 0, andamentoValor: 0, andamentoQtd: 0, aguardandoValor: 0, aguardandoQtd: 0, total: 0, totalQtd: 0 };
    // A coluna "Fonte" se refere ao recurso: o valor associado é o "Valor do Recurso".
    const valor = i.valorRecurso ?? 0;
    if (i.status === 'contratado') {
      atual.contratadoValor += valor;
      atual.contratadoQtd += 1;
    } else if (i.status === 'andamento') {
      atual.andamentoValor += valor;
      atual.andamentoQtd += 1;
    } else {
      atual.aguardandoValor += valor;
      atual.aguardandoQtd += 1;
    }
    atual.total += valor;
    atual.totalQtd += 1;
    mapa.set(rotulo, atual);
  });
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, topo);
}

export interface FatiaPizza {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
  /** % do filtro, já arredondado para que as fatias somem exatamente 100. */
  pctFiltro: number;
  /** % do total geral (sem filtro). */
  pctTotal: number;
}

/** Arredonda percentuais para inteiros que somam 100 (método do maior resto). */
export function arredondarPara100(brutos: number[]): number[] {
  if (brutos.length === 0) return [];
  const pisos = brutos.map((v) => Math.floor(v));
  const falta = 100 - pisos.reduce((a, b) => a + b, 0);
  const ordem = brutos.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  const resultado = [...pisos];
  for (let k = 0; k < falta && k < ordem.length; k++) resultado[ordem[k].i] += 1;
  return resultado;
}

export function fatiasPizza(
  itens: ItemPca[],
  totalGeral: number,
  grupos: { chave: string; rotulo: string; cor: string; pertence: (i: ItemPca) => boolean }[],
): FatiaPizza[] {
  const valores = grupos.map((g) => itens.filter(g.pertence).length);
  const brutos = valores.map((v) => (itens.length > 0 ? (v / itens.length) * 100 : 0));
  const arredondados = itens.length > 0 ? arredondarPara100(brutos) : valores.map(() => 0);
  return grupos.map((g, idx) => ({
    chave: g.chave,
    rotulo: g.rotulo,
    valor: valores[idx],
    cor: g.cor,
    pctFiltro: arredondados[idx],
    pctTotal: totalGeral > 0 ? (valores[idx] / totalGeral) * 100 : 0,
  }));
}

export function valoresUnicosPca(itens: ItemPca[], chave: (i: ItemPca) => string): string[] {
  return Array.from(new Set(itens.map((i) => chave(i).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ---------------------------------------------------------------- filtros

export interface FiltrosPca {
  demandante: string[];
  status: string[];
  fonte: string[];
  grupo: string[];
  temPae: string[];
  qdqq: string[];
}

export const FILTROS_PCA_VAZIOS: FiltrosPca = { demandante: [], status: [], fonte: [], grupo: [], temPae: [], qdqq: [] };

/** Passa em todos os filtros ativos (lista vazia = sem restrição). */
export function passaFiltrosPca(i: ItemPca, f: FiltrosPca): boolean {
  if (f.demandante.length > 0 && !f.demandante.includes(i.demandante)) return false;
  if (f.status.length > 0 && !f.status.includes(STATUS_PCA_META[i.status].rotulo)) return false;
  if (f.fonte.length > 0 && !f.fonte.includes(i.fonteRecurso)) return false;
  if (f.grupo.length > 0 && !f.grupo.includes(i.grupo)) return false;
  if (f.qdqq.length > 0 && !f.qdqq.includes(i.dataDesejada)) return false;
  if (f.temPae.length > 0) {
    const com = f.temPae.includes('Com PAE');
    const sem = f.temPae.includes('Sem PAE');
    if (com && !sem && !i.temPae) return false;
    if (sem && !com && i.temPae) return false;
  }
  return true;
}

export const filtrosAtivosPca = (f: FiltrosPca) => Object.values(f).filter((v) => v.length > 0).length;

// ---------------------------------------------------------------- insights

export interface InsightPca {
  id: string;
  tom: 'info' | 'warn' | 'danger' | 'ok';
  texto: string;
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function maiorPorValor(itens: ItemPca[], chave: (i: ItemPca) => string): [string, number] | null {
  const mapa = new Map<string, number>();
  itens.forEach((i) => {
    const rotulo = chave(i).trim() || SEM_INFO;
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + (i.valorTotalEstimado ?? 0));
  });
  const ordenado = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  return ordenado[0] ?? null;
}

/** Insights automáticos (por regra, sem IA) sobre os itens atualmente filtrados. */
export function calcularInsightsPca(itens: ItemPca[]): InsightPca[] {
  const insights: InsightPca[] = [];
  if (itens.length === 0) return insights;
  const semPae = itens.filter((i) => !i.temPae);
  const valorSemPae = soma(semPae, (i) => i.valorTotalEstimado ?? 0);
  const valorGeral = soma(itens, (i) => i.valorTotalEstimado ?? 0);

  if (semPae.length > 0 && valorSemPae > 0) {
    const topo = maiorPorValor(semPae, (i) => i.demandante);
    if (topo) {
      const pct = (topo[1] / valorSemPae) * 100;
      if (pct >= 20) insights.push({ id: 'demandante-sem-pae', tom: 'warn', texto: `${topo[0]} concentra ${moeda(topo[1])} (${pct.toFixed(0)}%) do valor ainda sem PAE.` });
    }
  }

  const altaSemPae = semPae.filter((i) => i.prioridadeKey === 'ALTA');
  if (altaSemPae.length > 0) {
    insights.push({
      id: 'alta-prioridade-sem-pae',
      tom: 'danger',
      texto: `${altaSemPae.length} ${altaSemPae.length === 1 ? 'item de prioridade ALTA está' : 'itens de prioridade ALTA estão'} sem PAE, somando ${moeda(soma(altaSemPae, (i) => i.valorTotalEstimado ?? 0))}.`,
    });
  }

  const contratados = itens.filter((i) => i.status === 'contratado');
  const pct = (contratados.length / itens.length) * 100;
  insights.push({ id: 'execucao', tom: pct >= 50 ? 'ok' : 'info', texto: `${pct.toFixed(0)}% dos itens (${contratados.length} de ${itens.length}) já estão contratados.` });

  if (valorGeral > 0) {
    const topo = maiorPorValor(itens, (i) => i.fonteRecurso);
    if (topo) {
      const p = (topo[1] / valorGeral) * 100;
      if (p >= 25) insights.push({ id: 'fonte-concentracao', tom: 'info', texto: `A fonte ${topo[0]} responde por ${p.toFixed(0)}% do valor total estimado (${moeda(topo[1])}).` });
    }
  }

  if (semPae.length > 0) {
    const maior = [...semPae].sort((a, b) => (b.valorTotalEstimado ?? 0) - (a.valorTotalEstimado ?? 0))[0];
    const valor = maior.valorTotalEstimado ?? 0;
    if (valor > 0) {
      const desc = maior.descricao.length > 60 ? `${maior.descricao.slice(0, 60)}…` : maior.descricao;
      insights.push({ id: 'maior-item-sem-pae', tom: 'warn', texto: `Maior item ainda sem PAE: "${desc}" (${moeda(valor)}, ${maior.demandante}).` });
    }
  }
  return insights.slice(0, 5);
}
