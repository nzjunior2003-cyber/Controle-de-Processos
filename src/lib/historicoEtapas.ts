/**
 * Histórico real das etapas (Fase D): a linha do tempo de cada processo
 * (etapa, início, fim) e a mediana real de dias por etapa. Funções puras.
 *
 * - "avançar": fecha a etapa em andamento e abre a próxima.
 * - "corrigir": a etapa registrada estava errada — substitui a passagem em
 *   andamento (não conta nas estatísticas).
 * - "confirmar": primeira confirmação (ou etapa ainda sem passagem aberta).
 * Processo confirmado antes desta fase (sem histórico) vale como UMA passagem
 * em andamento, derivada de `etapaAtualId` + `etapaConfirmadaEm`, sem gravar.
 */
import { ETAPAS, MAX_PASSAGENS_POR_PROCESSO, MIN_CASOS_HISTORICO } from '../config/fluxoCompras';
import type { PassagemEtapa, Processo } from '../types';

export type { PassagemEtapa };
export type ModoRegistro = 'confirmar' | 'avancar' | 'corrigir';

type ProcessoHistorico = Partial<
  Pick<Processo, 'historicoEtapas' | 'etapaAtualId' | 'etapaConfirmadaEm' | 'etapaConfirmadaPor' | 'etapaOrigem'>
>;

const DIA_MS = 86_400_000;
const tempo = (iso: string | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

/** Histórico do processo; se não houver, deriva a passagem em andamento da etapa já confirmada. */
export function historicoEfetivo(processo: ProcessoHistorico): PassagemEtapa[] {
  const gravado = (processo.historicoEtapas ?? []).filter((p) => ETAPAS.some((e) => e.id === p.etapaId) && tempo(p.inicio) !== null);
  if (gravado.length > 0) return gravado;
  if (processo.etapaAtualId && ETAPAS.some((e) => e.id === processo.etapaAtualId) && tempo(processo.etapaConfirmadaEm) !== null) {
    return [{ etapaId: processo.etapaAtualId, inicio: processo.etapaConfirmadaEm as string, por: processo.etapaConfirmadaPor, origem: processo.etapaOrigem }];
  }
  return [];
}

/** Passagem em andamento (a última sem `fim`), se houver. */
export function passagemEmAndamento(historico: PassagemEtapa[]): PassagemEtapa | null {
  const ultima = historico[historico.length - 1];
  return ultima && !ultima.fim ? ultima : null;
}

/** Valida a data de chegada: não pode ser futura nem anterior ao início da passagem anterior. */
export function validarChegada(chegada: Date, historico: PassagemEtapa[], modo: ModoRegistro, agora: Date = new Date()): void {
  if (Number.isNaN(chegada.getTime())) throw new Error('Data de chegada inválida.');
  if (chegada.getTime() > agora.getTime() + 60_000) throw new Error('A data de chegada não pode ser no futuro.');
  const aberta = passagemEmAndamento(historico);
  // Ao corrigir, a passagem aberta some: o limite é o fim/início da anterior.
  const referencia = modo === 'corrigir' && aberta ? historico.slice(0, -1) : historico;
  const ultima = referencia[referencia.length - 1];
  const limite = tempo(ultima?.fim) ?? tempo(ultima?.inicio);
  if (limite !== null && chegada.getTime() < limite) {
    throw new Error('A data de chegada não pode ser anterior ao início da etapa anterior.');
  }
}

/** Devolve o novo histórico depois de registrar a etapa `etapaId`. Não altera o original. */
export function registrarEtapa(
  historicoAtual: PassagemEtapa[],
  etapaId: string,
  modo: ModoRegistro,
  chegada: Date,
  por: string,
  origem: 'auto' | 'manual',
  agora: Date = new Date(),
): PassagemEtapa[] {
  if (!ETAPAS.some((e) => e.id === etapaId)) throw new Error(`Etapa inválida: ${etapaId}`);
  validarChegada(chegada, historicoAtual, modo, agora);
  const aberta = passagemEmAndamento(historicoAtual);
  const nova: PassagemEtapa = { etapaId, inicio: chegada.toISOString(), por, origem };
  let resultado: PassagemEtapa[];

  if (modo === 'corrigir') {
    resultado = [...(aberta ? historicoAtual.slice(0, -1) : historicoAtual), nova];
  } else if (modo === 'avancar' && aberta) {
    resultado = [...historicoAtual.slice(0, -1), { ...aberta, fim: chegada.toISOString() }, nova];
  } else if (aberta && aberta.etapaId === etapaId) {
    resultado = historicoAtual; // reconfirmar a mesma etapa: nada muda
  } else {
    resultado = [...historicoAtual, nova];
  }
  if (resultado.length > MAX_PASSAGENS_POR_PROCESSO) throw new Error('Histórico do processo muito longo.');
  return resultado;
}

/** Dias de uma passagem (as em andamento contam até `agora`). */
export function diasDaPassagem(p: PassagemEtapa, agora: Date = new Date()): number {
  const ini = tempo(p.inicio);
  const fim = tempo(p.fim) ?? agora.getTime();
  return ini === null ? 0 : Math.max(0, (fim - ini) / DIA_MS);
}

export interface LinhaDoTempoItem extends PassagemEtapa {
  dias: number;
  emAndamento: boolean;
}

export function linhaDoTempo(processo: ProcessoHistorico, agora: Date = new Date()): LinhaDoTempoItem[] {
  return historicoEfetivo(processo).map((p) => ({ ...p, dias: Math.round(diasDaPassagem(p, agora)), emAndamento: !p.fim }));
}

export interface MedianaEtapa {
  etapaId: string;
  /** Mediana, em dias, das passagens fechadas. */
  mediana: number;
  casos: number;
  /** Casos ≥ MIN_CASOS_HISTORICO. */
  suficiente: boolean;
}

function mediana(valores: number[]): number {
  const v = valores.slice().sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Mediana real de dias por etapa, usando as passagens FECHADAS de todos os processos. */
export function medianaPorEtapa(processos: ProcessoHistorico[], minimo: number = MIN_CASOS_HISTORICO): Map<string, MedianaEtapa> {
  const porEtapa = new Map<string, number[]>();
  processos.forEach((proc) => {
    historicoEfetivo(proc)
      .filter((p) => p.fim && tempo(p.fim) !== null)
      .forEach((p) => {
        const lista = porEtapa.get(p.etapaId) ?? [];
        lista.push(diasDaPassagem(p));
        porEtapa.set(p.etapaId, lista);
      });
  });
  const resultado = new Map<string, MedianaEtapa>();
  porEtapa.forEach((dias, etapaId) => {
    resultado.set(etapaId, { etapaId, mediana: mediana(dias), casos: dias.length, suficiente: dias.length >= minimo });
  });
  return resultado;
}
