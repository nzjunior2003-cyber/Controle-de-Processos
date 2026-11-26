/**
 * Prazos do fluxo de compras (Fase C): quantas etapas faltam até cada marco
 * (contrato, empenho, entrega, pagamento), em quantos dias o processo deve
 * chegar lá e se está no prazo. Funções puras.
 *
 * Como o tempo é calculado:
 *  - Prazo planejado de um marco = abertura do processo + soma dos dias das
 *    etapas do caminho (E01 até o marco). Os dias de E01–E19 são os "dias de
 *    referência" REPARTIDOS para que a soma bata com o prazo total do rito até
 *    a contratação (ex.: pregão 120 dias); E20–E35 usam dias fixos.
 *  - Previsão = início da etapa atual + o que ainda cabe nela (no mínimo hoje)
 *    + dias das etapas seguintes até o marco.
 *  - Início da etapa atual = quando foi confirmada (aproximação: é a data da
 *    confirmação, não a da chegada real); sem confirmação, a tramitação em
 *    curso ou a última tramitação; sem nada, a abertura.
 *  - Decisão ainda não respondida: contagem em faixa (mín–máx) e datas pelo
 *    caminho mais longo.
 */
import {
  CONTAR_ETAPAS_OPCIONAIS,
  DIAS_ATENCAO,
  DIAS_PADRAO_ETAPA,
  ETAPAS,
  ETAPA_FIM_PRAZO_RITO,
  MARCOS,
  RITO_ANTIGO_EQUIVALENTE,
  TRANSICOES,
  type MarcoFluxo,
  type RitoCompras,
} from '../config/fluxoCompras';
import { calcularFluxo, etapaPorId, etapasPossiveis, ritoEfetivo, type ProcessoFluxo, type TramitacaoFluxo } from './fluxoCompras';
import { prazoAlvoDoRito } from './prazosProcesso';
import { historicoEfetivo, passagemEmAndamento, type MedianaEtapa } from './historicoEtapas';

/** O que DAL/Master editam (guardado em `config_fluxo/prazos`). Tudo opcional: o que faltar vem do padrão. */
export interface ConfigPrazos {
  diasPorEtapa?: Record<string, number>;
  /** Prazo total, em dias, da abertura até a contratação (E19), por rito do fluxo. */
  prazoAteContratoPorRito?: Partial<Record<RitoCompras, number>>;
}

export type SituacaoPrazo = 'concluido' | 'no_prazo' | 'atencao' | 'atrasado' | 'sem_data';

export interface Faixa {
  min: number;
  max: number;
}

export interface ContagemMarco {
  total: Faixa;
  concluidas: Faixa;
  restantes: Faixa;
  percentual: Faixa;
  /** As faixas diferem porque há decisão ainda não respondida. */
  incerto: boolean;
  concluido: boolean;
}

export interface PrazoMarco {
  marco: MarcoFluxo;
  contagem: ContagemMarco;
  prazo: Date | null;
  previsao: Date | null;
  /** Previsão trocando a meta pela mediana REAL das etapas com casos suficientes (Fase D); null se não há. */
  previsaoHistorico: Date | null;
  /** Menor nº de casos entre as etapas que usaram a mediana na previsão pelo histórico. */
  casosHistorico: number;
  situacao: SituacaoPrazo;
  /** Dias de atraso (previsão depois do prazo); 0 se não estiver atrasado. */
  diasAtraso: number;
}

export interface PrazoEtapaAtual {
  etapaId: string;
  diasNaEtapa: number;
  metaDias: number;
  situacao: Exclude<SituacaoPrazo, 'concluido' | 'sem_data'>;
}

export interface PrazosCalculados {
  marcos: PrazoMarco[];
  etapaAtual: PrazoEtapaAtual | null;
  /** Situação do primeiro marco ainda não atingido (a que a lista mostra). */
  principal: SituacaoPrazo;
  /** Prazo total do rito (dias da abertura até a contratação) usado no cálculo; null se o rito não tem. */
  prazoTotalRito: number | null;
}

const DIA_MS = 86_400_000;
const indice = (id: string) => ETAPAS.findIndex((e) => e.id === id);
const ehOpcional = (id: string) => !CONTAR_ETAPAS_OPCIONAIS && !!etapaPorId(id)?.opcional;

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + Math.round(dias) * DIA_MS);
}

function dataValida(valor: string | undefined | null): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Caminhos

/** Próximas etapas possíveis; decisão em aberto devolve os dois lados. */
function proximosPossiveis(id: string, processo: ProcessoFluxo): string[] {
  const regra = TRANSICOES[id];
  if (regra === null) return [];
  if (typeof regra === 'string') return [regra];
  if (regra) {
    const resposta = processo[regra.campo];
    if (resposta === undefined || resposta === null) return [regra.sim, regra.nao];
    return [resposta ? regra.sim : regra.nao];
  }
  const seguinte = ETAPAS[indice(id) + 1];
  return seguinte ? [seguinte.id] : [];
}

/** Todos os caminhos possíveis de `origem` até `destino` (inclusive os dois), sem repetir etapa. */
export function caminhosAteMarco(processo: ProcessoFluxo, destino: string, origem: string = ETAPAS[0].id): string[][] {
  const resultado: string[][] = [];
  const andar = (id: string, trilha: string[]) => {
    if (trilha.includes(id) || indice(id) > indice(destino)) return;
    const nova = [...trilha, id];
    if (id === destino) {
      resultado.push(nova);
      return;
    }
    proximosPossiveis(id, processo).forEach((prox) => andar(prox, nova));
  };
  andar(origem, []);
  return resultado;
}

// ---------------------------------------------------------------------------
// Dias por etapa

/** Prazo total (dias) da abertura até a contratação para o rito do processo, ou null. */
export function prazoTotalDoRito(processo: ProcessoFluxo, config?: ConfigPrazos): number | null {
  const { rito } = ritoEfetivo(processo);
  if (!rito) return null;
  const editado = config?.prazoAteContratoPorRito?.[rito];
  if (typeof editado === 'number' && editado > 0) return editado;
  const antigo = RITO_ANTIGO_EQUIVALENTE[rito];
  return prazoAlvoDoRito(processo.rito_processual) ?? (antigo ? prazoAlvoDoRito(antigo) : undefined) ?? null;
}

/** Dias de cada etapa para ESTE processo (E01–E19 escalados ao prazo total do rito). */
export function diasPorEtapaDoProcesso(processo: ProcessoFluxo, config?: ConfigPrazos): Record<string, number> {
  const referencia = { ...DIAS_PADRAO_ETAPA, ...(config?.diasPorEtapa ?? {}) };
  const alvo = prazoTotalDoRito(processo, config);
  const possiveis = etapasPossiveis(processo);
  const fim = indice(ETAPA_FIM_PRAZO_RITO);
  const somaRef = ETAPAS.filter((e, i) => i <= fim && possiveis.has(e.id) && !ehOpcional(e.id))
    .reduce((acc, e) => acc + (referencia[e.id] ?? 0), 0);
  const fator = alvo && somaRef > 0 ? alvo / somaRef : 1;
  const dias: Record<string, number> = {};
  ETAPAS.forEach((e, i) => {
    const base = referencia[e.id] ?? 0;
    dias[e.id] = ehOpcional(e.id) ? 0 : i <= fim ? base * fator : base;
  });
  return dias;
}

// ---------------------------------------------------------------------------
// Contagem

export function contarEtapasAteMarco(processo: ProcessoFluxo, marco: MarcoFluxo, atualId: string | null): ContagemMarco {
  const iAtual = atualId ? indice(atualId) : -1;
  const iMarco = indice(marco.etapaId);
  const concluido = iAtual > iMarco;
  const caminhos = caminhosAteMarco(processo, marco.etapaId).map((c) => c.filter((id) => !ehOpcional(id)));
  const medidas = caminhos.map((c) => {
    const feitas = concluido ? c.length : c.filter((id) => indice(id) < iAtual).length;
    return { total: c.length, feitas, restantes: c.length - feitas, pct: c.length ? Math.round((feitas / c.length) * 100) : 100 };
  });
  const faixa = (f: (m: (typeof medidas)[number]) => number): Faixa => {
    const v = medidas.map(f);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  const vazio = medidas.length === 0;
  const total = vazio ? { min: 0, max: 0 } : faixa((m) => m.total);
  const concluidas = vazio ? { min: 0, max: 0 } : faixa((m) => m.feitas);
  const restantes = vazio ? { min: 0, max: 0 } : faixa((m) => m.restantes);
  const percentual = vazio ? { min: 0, max: 0 } : faixa((m) => m.pct);
  const incerto = total.min !== total.max || restantes.min !== restantes.max;
  return { total, concluidas, restantes, percentual, incerto, concluido };
}

// ---------------------------------------------------------------------------
// Datas e situação

/** Início (aproximado) da etapa atual. */
export function inicioDaEtapaAtual(processo: ProcessoFluxo, tramitacoes: TramitacaoFluxo[], abertura: Date | null): Date | null {
  // 1) Histórico real: a passagem em andamento pela etapa atual (data de chegada informada).
  const emAndamento = passagemEmAndamento(historicoEfetivo(processo));
  if (emAndamento && emAndamento.etapaId === processo.etapaAtualId) {
    const chegada = dataValida(emAndamento.inicio);
    if (chegada) return chegada;
  }
  const confirmada = etapaPorId(processo.etapaAtualId) ? dataValida(processo.etapaConfirmadaEm) : null;
  if (confirmada) return confirmada;
  const aberta = tramitacoes
    .filter((t) => !t.data_fim && dataValida(t.data_inicio))
    .sort((a, b) => (dataValida(b.data_inicio)!.getTime() - dataValida(a.data_inicio)!.getTime()))[0];
  return dataValida(aberta?.data_inicio) ?? dataValida(processo.ultima_tramitacao) ?? abertura;
}

function situacaoPorFolga(diasDeFolga: number): Exclude<SituacaoPrazo, 'concluido' | 'sem_data'> {
  if (diasDeFolga < 0) return 'atrasado';
  return diasDeFolga <= DIAS_ATENCAO ? 'atencao' : 'no_prazo';
}

type ProcessoPrazos = ProcessoFluxo & { data_entrada?: string; data_abertura?: string };

export function calcularPrazos(
  processo: ProcessoPrazos,
  tramitacoes: TramitacaoFluxo[] = [],
  config?: ConfigPrazos,
  agora: Date = new Date(),
  medianas?: Map<string, MedianaEtapa>,
): PrazosCalculados {
  const fluxo = calcularFluxo(processo, tramitacoes, agora);
  const atualId = fluxo.etapaAtual?.id ?? null;
  const abertura = dataValida(processo.data_entrada) ?? dataValida(processo.data_abertura);
  const dias = diasPorEtapaDoProcesso(processo, config);
  const soma = (ids: string[]) => ids.reduce((acc, id) => acc + (dias[id] ?? 0), 0);
  const maisLongo = (caminhos: string[][]) =>
    caminhos.slice().sort((a, b) => soma(b) - soma(a))[0] ?? [];
  const inicioAtual = inicioDaEtapaAtual(processo, tramitacoes, abertura);

  const marcos: PrazoMarco[] = MARCOS.map((marco) => {
    const contagem = contarEtapasAteMarco(processo, marco, atualId);
    const semPrevisao = { previsaoHistorico: null, casosHistorico: 0 };
    if (contagem.concluido) return { marco, contagem, prazo: null, previsao: null, ...semPrevisao, situacao: 'concluido' as const, diasAtraso: 0 };
    if (!abertura) return { marco, contagem, prazo: null, previsao: null, ...semPrevisao, situacao: 'sem_data' as const, diasAtraso: 0 };

    const prazo = somarDias(abertura, soma(maisLongo(caminhosAteMarco(processo, marco.etapaId))));

    // Previsão: etapa atual (ou a primeira, sem etapa) e as seguintes até o marco.
    const origem = atualId ?? ETAPAS[0].id;
    const restante = maisLongo(caminhosAteMarco(processo, marco.etapaId, origem));
    const inicio = inicioAtual ?? abertura;
    const prever = (diasUsados: Record<string, number>) => {
      const somaUsada = (ids: string[]) => ids.reduce((acc, id) => acc + (diasUsados[id] ?? 0), 0);
      const fim = somarDias(inicio, diasUsados[origem] ?? 0);
      const base = fim.getTime() > agora.getTime() ? fim : agora;
      return somarDias(base, somaUsada(restante.filter((id) => id !== origem)));
    };
    const previsao = prever(dias);

    // Pela mediana real (Fase D): só se alguma etapa do trecho tem casos suficientes.
    const comMediana = restante.filter((id) => !ehOpcional(id) && medianas?.get(id)?.suficiente);
    const diasHistorico = { ...dias };
    comMediana.forEach((id) => { diasHistorico[id] = medianas!.get(id)!.mediana; });
    const previsaoHistorico = comMediana.length > 0 ? prever(diasHistorico) : null;
    const casosHistorico = comMediana.length > 0 ? Math.min(...comMediana.map((id) => medianas!.get(id)!.casos)) : 0;

    const folga = Math.floor((prazo.getTime() - previsao.getTime()) / DIA_MS);
    const situacao = situacaoPorFolga(folga);
    return { marco, contagem, prazo, previsao, previsaoHistorico, casosHistorico, situacao, diasAtraso: situacao === 'atrasado' ? -folga : 0 };
  });

  let etapaAtual: PrazoEtapaAtual | null = null;
  if (atualId && inicioAtual) {
    const diasNaEtapa = Math.max(0, Math.floor((agora.getTime() - inicioAtual.getTime()) / DIA_MS));
    const metaDias = Math.round(dias[atualId] ?? 0);
    etapaAtual = { etapaId: atualId, diasNaEtapa, metaDias, situacao: situacaoPorFolga(metaDias - diasNaEtapa) };
  }

  const primeiro = marcos.find((m) => m.situacao !== 'concluido');
  return { marcos, etapaAtual, principal: primeiro?.situacao ?? 'concluido', prazoTotalRito: prazoTotalDoRito(processo, config) };
}

export const ROTULO_SITUACAO: Record<SituacaoPrazo, string> = {
  concluido: 'Concluído',
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
  sem_data: 'Sem data de abertura',
};

/** Texto de uma faixa: "6" ou "6 a 8". */
export function textoFaixa(f: Faixa): string {
  return f.min === f.max ? String(f.min) : `${f.min} a ${f.max}`;
}
