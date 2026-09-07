/**
 * Fluxo real de um processo: em quais localizações ele já passou (a
 * mesma "Setor Atual" da planilha de controle, texto livre — não o
 * fluxo fixo de 7 setores usado internamente antes desta funcionalidade)
 * e quantos dias ficou em cada uma. Alimenta o gráfico de Gantt e as
 * estimativas de tempo por setor/tipo de contratação.
 */
import { differenceInDays } from 'date-fns';
import type { Processo } from '../types';

/** Um período em que o processo ficou numa localização (setor/unidade). */
export interface EstadaProcesso {
  id: string;
  processo_id: string;
  localizacao: string;
  data_inicio: string;
  /** null = estadia em curso (é onde o processo está agora). */
  data_fim: string | null;
  criado_em?: string;
}

/** Quantos dias um processo passou (ou já passou) numa estadia. */
export function calcularDiasEstada(
  estada: Pick<EstadaProcesso, 'data_inicio' | 'data_fim'>,
  agora: Date = new Date(),
): number {
  const fim = estada.data_fim ? new Date(estada.data_fim) : agora;
  return Math.max(0, differenceInDays(fim, new Date(estada.data_inicio)));
}

/** Linha do tempo de um processo (estadias ordenadas), com a duração de cada uma. */
export function montarLinhaDoTempo(
  estadas: EstadaProcesso[],
  agora: Date = new Date(),
): Array<EstadaProcesso & { dias: number }> {
  return estadas
    .slice()
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    .map((estada) => ({ ...estada, dias: calcularDiasEstada(estada, agora) }));
}

/** Tempo total do processo: soma da duração de todas as suas estadias. */
export function calcularTempoTotal(estadas: EstadaProcesso[], agora: Date = new Date()): number {
  return estadas.reduce((total, estada) => total + calcularDiasEstada(estada, agora), 0);
}

/**
 * Média de dias por localização, considerando as estadias de todos os
 * processos que já passaram por cada lugar — usado para identificar em
 * quais setores os processos demoram mais. Ordenado do mais lento pro
 * mais rápido.
 */
export function calcularMediaDiasPorLocalizacao(
  estadas: EstadaProcesso[],
  agora: Date = new Date(),
): Array<{ localizacao: string; mediaDias: number; ocorrencias: number }> {
  const agrupado = new Map<string, number[]>();
  estadas.forEach((estada) => {
    const lista = agrupado.get(estada.localizacao) ?? [];
    lista.push(calcularDiasEstada(estada, agora));
    agrupado.set(estada.localizacao, lista);
  });

  return Array.from(agrupado.entries())
    .map(([localizacao, dias]) => ({
      localizacao,
      mediaDias: dias.reduce((a, b) => a + b, 0) / dias.length,
      ocorrencias: dias.length,
    }))
    .sort((a, b) => b.mediaDias - a.mediaDias);
}

/**
 * Média de tempo total por tipo de contratação (rito processual) — só
 * considera processos concluídos/arquivados, pra não misturar com
 * processos ainda em andamento (que teriam tempo parcial, subestimado).
 */
export function calcularMediaDiasPorRito(
  processos: Processo[],
  estadasPorProcesso: Map<string, EstadaProcesso[]>,
  agora: Date = new Date(),
): Array<{ rito: string; mediaDias: number; ocorrencias: number }> {
  const agrupado = new Map<string, number[]>();

  processos
    .filter((p) => p.rito_processual && (p.status === 'concluido' || p.status === 'arquivado'))
    .forEach((processo) => {
      const estadas = estadasPorProcesso.get(processo.id) ?? [];
      if (estadas.length === 0) return;
      const lista = agrupado.get(processo.rito_processual as string) ?? [];
      lista.push(calcularTempoTotal(estadas, agora));
      agrupado.set(processo.rito_processual as string, lista);
    });

  return Array.from(agrupado.entries())
    .map(([rito, dias]) => ({
      rito,
      mediaDias: dias.reduce((a, b) => a + b, 0) / dias.length,
      ocorrencias: dias.length,
    }))
    .sort((a, b) => b.mediaDias - a.mediaDias);
}

/** Localização "efetiva" de um processo: a real (planilha) ou a sigla do setor interno fixo. */
export function localizacaoEfetiva(
  processo: Pick<Processo, 'localizacao_atual' | 'fase_atual_id'>,
  siglaDoSetor: (id: string) => string | undefined,
): string {
  return processo.localizacao_atual || siglaDoSetor(processo.fase_atual_id) || 'Desconhecido';
}

/** Agrupa uma lista de estadias por processo, num Map por processo_id. */
export function agruparEstadasPorProcesso(
  estadas: EstadaProcesso[],
): Map<string, EstadaProcesso[]> {
  const mapa = new Map<string, EstadaProcesso[]>();
  estadas.forEach((estada) => {
    const lista = mapa.get(estada.processo_id) ?? [];
    lista.push(estada);
    mapa.set(estada.processo_id, lista);
  });
  return mapa;
}
