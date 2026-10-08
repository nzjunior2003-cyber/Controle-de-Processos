/**
 * Painel de Processos (ex-dashboard "procssos-cbmpa", agora dentro do sistema).
 * A lógica de status, KPIs, agrupamento de ritos e insights é a mesma do
 * dashboard original, só que lê os processos do próprio sistema (que já
 * sincronizam com a planilha a cada 5 minutos) em vez de baixar o CSV.
 */
import { differenceInDays } from 'date-fns';
import type { Processo } from '../types';

export type StatusPainel = 'finalizado' | 'arquivado' | 'contratado' | 'atrasado' | 'atencao' | 'andamento';

export const STATUS_PAINEL_META: Record<StatusPainel, { rotulo: string; classe: string }> = {
  atrasado: { rotulo: 'Atrasado (+30d)', classe: 'bg-red-100 text-red-800 border-red-200' },
  atencao: { rotulo: 'Atenção (15–30d)', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  andamento: { rotulo: 'Em andamento', classe: 'bg-blue-100 text-blue-800 border-blue-200' },
  contratado: { rotulo: 'Contratado/Aditivado', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  finalizado: { rotulo: 'Finalizado', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  arquivado: { rotulo: 'Arquivado', classe: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const ORDEM_STATUS_PAINEL: StatusPainel[] = ['atrasado', 'atencao', 'andamento', 'contratado', 'finalizado', 'arquivado'];

/** Processo do sistema já com os campos derivados que o painel usa. */
export interface ProcessoPainel {
  id: string;
  pae: string;
  objeto: string;
  descricao: string;
  demandante: string;
  natureza: string;
  fonte: string;
  vEstimado: number | null;
  rito: string;
  ritoAgrupado: string;
  fase: string;
  subfase: string;
  setorAtualPath: string[];
  setorAtual: string;
  andamento: string;
  /** Dias desde a última tramitação (parado no setor atual). */
  diasNoSetor: number | null;
  /** Dias desde a data de entrada. */
  tempoTotalDias: number | null;
  dataEntrada: Date | null;
  ultimaTramitacao: Date | null;
  previsaoPca: 'SIM' | 'NÃO' | '';
  status: StatusPainel;
  /** % do checklist do rito concluído (ou null quando não há checklist). */
  progresso: number | null;
  ativo: boolean;
}

const maiusculo = (t: string | undefined) => (t ?? '').trim().toUpperCase();
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "CBM > SETOR > LOCAL" -> ["CBM", "SETOR", "LOCAL"] */
export function parseCaminhoSetor(texto: string | undefined): string[] {
  return (texto ?? '')
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Rótulo curto do setor atual: o segundo segmento de "CBM > SETOR > LOCAL". */
export function rotuloSetorAtual(caminho: string[]): string {
  if (caminho.length >= 2) return caminho[1];
  return caminho[0] ?? '';
}

/** "8 PAGAMENTO" -> "PAGAMENTO" (a subfase vem da planilha com o número da etapa na frente). */
export function rotuloSubfase(subfase: string | undefined): string {
  const bruto = (subfase ?? '').trim();
  const m = bruto.match(/^(\d+)\s*(.*)$/);
  return m ? m[2].trim() || bruto : bruto;
}

/**
 * Agrupa ritos correlatos (dispensas, aditivos, inexigibilidades) numa categoria
 * só, como no dashboard original. Funciona com os nomes padronizados do sistema
 * e com as grafias antigas da planilha.
 */
export function agruparRito(rito: string | undefined): string {
  const original = (rito ?? '').trim();
  if (!original) return '';
  const chave = semAcento(original);
  if (chave.startsWith('dispensa')) return 'DISPENSA';
  if (chave.startsWith('inexigibilidade')) return 'INEXIGIBILIDADE';
  if (/(prorrog|acrescimo|reajuste|reequilibrio|aditivo)/.test(chave)) return 'ADITIVOS';
  return original;
}

/** Status colorido a partir do andamento, da subfase, do status do sistema e dos dias parado. */
export function derivarStatus(
  p: Pick<Processo, 'andamento' | 'status' | 'subfase_processo'>,
  diasNoSetor: number | null,
): StatusPainel {
  const andamento = maiusculo(p.andamento);
  if (andamento === 'FINALIZADO' || p.status === 'concluido') return 'finalizado';
  if (andamento === 'ARQUIVADO' || p.status === 'arquivado') return 'arquivado';
  if (maiusculo(rotuloSubfase(p.subfase_processo)) === 'CONTRATADO' || p.status === 'contratado_aditivado') return 'contratado';
  if (diasNoSetor != null && diasNoSetor > 30) return 'atrasado';
  if (diasNoSetor != null && diasNoSetor >= 15) return 'atencao';
  return 'andamento';
}

const dataValida = (iso: string | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function paraPainel(p: Processo, progresso: number | null, hoje: Date = new Date()): ProcessoPainel {
  const ultimaTramitacao = dataValida(p.ultima_tramitacao);
  const dataEntrada = dataValida(p.data_entrada);
  const diasNoSetor = ultimaTramitacao ? Math.max(0, differenceInDays(hoje, ultimaTramitacao)) : null;
  const status = derivarStatus(p, diasNoSetor);
  const caminho = parseCaminhoSetor(p.localizacao_atual);
  const previsao = maiusculo(p.previsao_pca);
  return {
    id: p.id,
    pae: p.numero_processo,
    objeto: p.objeto ?? '',
    descricao: p.descricao ?? '',
    demandante: p.unidade_demandante ?? '',
    natureza: p.natureza_despesa ?? '',
    fonte: p.fonte ?? '',
    vEstimado: typeof p.valor_estimado === 'number' && p.valor_estimado > 0 ? p.valor_estimado : null,
    rito: p.rito_processual ?? '',
    ritoAgrupado: agruparRito(p.rito_processual),
    fase: p.fase_processo ?? '',
    subfase: rotuloSubfase(p.subfase_processo),
    setorAtualPath: caminho,
    setorAtual: rotuloSetorAtual(caminho),
    andamento: p.andamento ?? '',
    diasNoSetor,
    tempoTotalDias: dataEntrada ? Math.max(0, differenceInDays(hoje, dataEntrada)) : null,
    dataEntrada,
    ultimaTramitacao,
    previsaoPca: previsao === 'SIM' || p.pca_id ? 'SIM' : previsao === 'NÃO' || previsao === 'NAO' ? 'NÃO' : '',
    status,
    progresso,
    ativo: status !== 'finalizado' && status !== 'arquivado',
  };
}

// ---------------------------------------------------------------- KPIs

export interface Kpis {
  total: number;
  ativos: number;
  finalizados: number;
  arquivados: number;
  parados30: number;
  somaEstimadoAtivos: number;
  semPrevisaoPca: number;
  contratadosAditivados: number;
  previstosPca: number;
}

export function calcularKpis(processos: ProcessoPainel[]): Kpis {
  const ativos = processos.filter((p) => p.ativo);
  return {
    total: processos.length,
    ativos: ativos.length,
    finalizados: processos.filter((p) => p.status === 'finalizado').length,
    arquivados: processos.filter((p) => p.status === 'arquivado').length,
    parados30: ativos.filter((p) => p.diasNoSetor != null && p.diasNoSetor > 30).length,
    somaEstimadoAtivos: ativos.reduce((acc, p) => acc + (p.vEstimado ?? 0), 0),
    semPrevisaoPca: processos.filter((p) => p.previsaoPca === 'NÃO').length,
    contratadosAditivados: processos.filter((p) => p.status === 'contratado').length,
    previstosPca: processos.filter((p) => p.previsaoPca === 'SIM').length,
  };
}

// ------------------------------------------------------------- agrupamentos

export interface ItemContagem {
  label: string;
  value: number;
}

const SEM_INFO = '(não informado)';

function contar(processos: ProcessoPainel[], chave: (p: ProcessoPainel) => string): ItemContagem[] {
  const mapa = new Map<string, number>();
  processos.forEach((p) => {
    const rotulo = chave(p).trim() || SEM_INFO;
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + 1);
  });
  return Array.from(mapa, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

const semInfoPorUltimo = (itens: ItemContagem[]) =>
  [...itens].sort((a, b) => (a.label === SEM_INFO ? 1 : b.label === SEM_INFO ? -1 : b.value - a.value));

export const contarPorDemandante = (ps: ProcessoPainel[], topo = 10) => contar(ps, (p) => p.demandante).slice(0, topo);
export const contarPorRito = (ps: ProcessoPainel[]) => semInfoPorUltimo(contar(ps, (p) => p.ritoAgrupado));
export const contarPorSetorAtual = (ps: ProcessoPainel[], topo = 10) => contar(ps, (p) => p.setorAtual).slice(0, topo);

export function somarEstimadoPorNatureza(processos: ProcessoPainel[]): ItemContagem[] {
  const mapa = new Map<string, number>();
  processos.forEach((p) => {
    const rotulo = p.natureza.trim() || SEM_INFO;
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + (p.vEstimado ?? 0));
  });
  return Array.from(mapa, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function valoresUnicos(processos: ProcessoPainel[], chave: (p: ProcessoPainel) => string): string[] {
  return Array.from(new Set(processos.map((p) => chave(p).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ------------------------------------------------------------------ insights

export interface Insight {
  id: string;
  tom: 'info' | 'warn' | 'danger' | 'ok';
  texto: string;
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const truncar = (t: string, max: number) => (t.length > max ? `${t.slice(0, max)}…` : t);

/** Insights automáticos (por regra, sem IA) sobre os processos ativos; cada regra só aparece com dado suficiente. */
export function calcularInsights(processos: ProcessoPainel[]): Insight[] {
  const insights: Insight[] = [];
  const ativos = processos.filter((p) => p.ativo);
  if (ativos.length === 0) return insights;
  const atrasados = ativos.filter((p) => p.status === 'atrasado');

  if (atrasados.length > 0) {
    const porSetor = new Map<string, number>();
    atrasados.forEach((p) => porSetor.set(p.setorAtual || SEM_INFO, (porSetor.get(p.setorAtual || SEM_INFO) ?? 0) + 1));
    const [setor, qtd] = [...porSetor.entries()].sort((a, b) => b[1] - a[1])[0];
    if (qtd >= 2) {
      insights.push({
        id: 'setor-atrasados',
        tom: 'danger',
        texto: `${setor} concentra ${qtd} dos ${atrasados.length} processos atrasados (+30 dias no mesmo setor).`,
      });
    }
  }

  const candidatos = ativos.filter((p) => p.status !== 'contratado' && p.diasNoSetor != null);
  if (candidatos.length > 0) {
    const maisAntigo = [...candidatos].sort((a, b) => (b.diasNoSetor ?? 0) - (a.diasNoSetor ?? 0))[0];
    const dias = maisAntigo.diasNoSetor ?? 0;
    if (dias > 30) {
      insights.push({
        id: 'mais-antigo-parado',
        tom: 'danger',
        texto: `Processo parado há mais tempo: ${maisAntigo.pae} (${truncar(maisAntigo.objeto, 60)}) — ${dias} dias em ${maisAntigo.setorAtual || SEM_INFO}.`,
      });
    }
  }

  const valorAtivos = ativos.reduce((acc, p) => acc + (p.vEstimado ?? 0), 0);
  const valorAtrasados = atrasados.reduce((acc, p) => acc + (p.vEstimado ?? 0), 0);
  if (atrasados.length > 0 && valorAtrasados > 0 && valorAtivos > 0) {
    insights.push({
      id: 'valor-atrasado',
      tom: 'warn',
      texto: `${moeda(valorAtrasados)} (${((valorAtrasados / valorAtivos) * 100).toFixed(0)}% do valor estimado dos processos ativos) está em processos atrasados.`,
    });
  }

  const porRito = new Map<string, number[]>();
  ativos.forEach((p) => {
    if (p.tempoTotalDias == null || p.tempoTotalDias <= 0 || !p.ritoAgrupado) return;
    porRito.set(p.ritoAgrupado, [...(porRito.get(p.ritoAgrupado) ?? []), p.tempoTotalDias]);
  });
  const ritos = [...porRito.entries()]
    .filter(([, dias]) => dias.length >= 3)
    .map(([rito, dias]) => ({ rito, n: dias.length, media: dias.reduce((a, b) => a + b, 0) / dias.length }))
    .sort((a, b) => b.media - a.media);
  if (ritos.length > 0) {
    insights.push({
      id: 'rito-mais-lento',
      tom: 'info',
      texto: `O rito ${ritos[0].rito} tem o maior tempo médio total entre os processos ativos: ${ritos[0].media.toFixed(0)} dias (${ritos[0].n} processos).`,
    });
  }

  const semPca = ativos.filter((p) => p.previsaoPca === 'NÃO');
  if (semPca.length > 0) {
    const valor = semPca.reduce((acc, p) => acc + (p.vEstimado ?? 0), 0);
    insights.push({
      id: 'sem-previsao-pca',
      tom: 'warn',
      texto: `${semPca.length} ${semPca.length === 1 ? 'processo ativo não tem' : 'processos ativos não têm'} previsão no PCA${valor > 0 ? `, somando ${moeda(valor)}` : ''}.`,
    });
  }

  return insights.slice(0, 5);
}
