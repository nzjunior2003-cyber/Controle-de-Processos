/**
 * Motor do fluxo oficial de compras (DAL/CBMPA). Funções PURAS: recebem o
 * processo (e, se houver, as estadas/tramitações) e devolvem a etapa atual
 * sugerida, a próxima etapa, as perguntas pendentes e os itens que faltam.
 * Todo o conteúdo do fluxo (etapas, desvios, checklists) vem de
 * src/config/fluxoCompras.ts — aqui só há a lógica.
 *
 * A etapa SUGERIDA nunca é gravada aqui: quem confirma é o usuário (Fase B).
 */
import {
  CHECKLIST_E07,
  CHECKLIST_E07_DISPENSA_ATE_METADE,
  ETAPAS,
  ETAPA_ARTEFATOS,
  ETAPA_DEFINIR_RITO,
  ETAPA_FINAL,
  MAPA_RITO_ANTIGO,
  PERGUNTAS,
  PISTAS_ANDAMENTO,
  REGRAS_LOCALIZACAO,
  RITOS_COM_PERGUNTA_DISPENSA,
  RITOS_FORA_DO_FLUXO,
  TRANSICOES,
  type Desvio,
  type EtapaFluxo,
  type ItemE07,
  type PerguntaFluxo,
  type RitoCompras,
} from '../config/fluxoCompras';
import type { Processo } from '../types';
import { normalizarRito } from './ritosProcessuais';

/** Só os campos do processo que o motor lê. */
export type ProcessoFluxo = Partial<
  Pick<
    Processo,
    | 'ritoProcessual'
    | 'rito_processual'
    | 'checklist_rito'
    | 'dispensaAteMetadeLimite'
    | 'necessitaDotacao'
    | 'cbmGerenciadorOuParticipeArp'
    | 'parecerJuridicoAprovadoSemRecomendacoes'
    | 'haveraFaseExterna'
    | 'etapaAtualId'
    | 'etapaOrigem'
    | 'etapaConfirmadaEm'
    | 'etapaConfirmadaPor'
    | 'historicoEtapas'
    | 'andamento'
    | 'localizacao_atual'
    | 'ultima_tramitacao'
    | 'prd'
    | 'status'
  >
>;

/** Tramitação (estada) — só o necessário. `data_fim` vazio = é onde o processo está agora. */
export interface TramitacaoFluxo {
  localizacao: string;
  data_inicio?: string;
  data_fim?: string | null;
}

export type Confianca = 'alta' | 'media' | 'baixa';

export interface SugestaoEtapa {
  etapaId: string;
  confianca: Confianca;
  /** Por que o sistema sugeriu esta etapa (para mostrar ao usuário confirmar). */
  motivos: string[];
}

export interface PendenciaDecisao extends PerguntaFluxo {
  /** true = sem a resposta não dá para dizer qual é a próxima etapa. */
  bloqueiaProximo: boolean;
}

export interface AvaliacaoE07 {
  /** Itens exigidos para o rito (vazio se não há rito). */
  exigidos: ItemE07[];
  faltando: ItemE07[];
  completo: boolean;
  /** true = a lista pode mudar quando `dispensaAteMetadeLimite` for respondida. */
  provisorio: boolean;
}

export interface FluxoCalculado {
  /** Rito não é compra (prorrogação, acréscimo etc.): o fluxo não se aplica. */
  foraDoFluxo: boolean;
  rito: RitoCompras | null;
  etapaAtual: EtapaFluxo | null;
  /** 'auto'/'manual' se confirmada pelo usuário; null se é só sugestão. */
  etapaOrigem: 'auto' | 'manual' | null;
  confirmada: boolean;
  sugestao: SugestaoEtapa | null;
  /** Há etapa confirmada e a sugestão automática é outra (ex.: o processo andou). */
  sugestaoDiferente: boolean;
  proxima: EtapaFluxo | null;
  /** Por que a próxima etapa é esta (ex.: "Definir o rito processual"). */
  motivoProxima: string | null;
  /** A próxima etapa é "caso necessário": o usuário pode pular. */
  proximaOpcional: boolean;
  /** Quem age agora (setor da etapa atual) — só informativo. */
  setorAgora: string | null;
  setorProxima: string | null;
  decisoesPendentes: PendenciaDecisao[];
  e07: AvaliacaoE07;
  concluido: boolean;
  diasDesdeUltimaTramitacao: number | null;
}

// ---------------------------------------------------------------------------
// Utilitários

const POR_ID = new Map<string, EtapaFluxo>(ETAPAS.map((e) => [e.id, e]));
const INDICE = new Map<string, number>(ETAPAS.map((e, i) => [e.id, i]));

export function etapaPorId(id: string | undefined | null): EtapaFluxo | null {
  return (id && POR_ID.get(id)) || null;
}

const indice = (id: string): number => INDICE.get(id) ?? -1;

/** Minúsculas, sem acento. */
function semAcento(texto: string | undefined | null): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Para comparar itens de checklist: sem acento, só letras/números, espaços simples. */
function chaveTexto(texto: string | undefined | null): string {
  return semAcento(texto).replace(/[^a-z0-9]+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Rito

export function ritoEfetivo(processo: ProcessoFluxo): { rito: RitoCompras | null; foraDoFluxo: boolean } {
  if (processo.ritoProcessual && processo.ritoProcessual in CHECKLIST_E07) {
    return { rito: processo.ritoProcessual, foraDoFluxo: false };
  }
  const texto = processo.rito_processual?.trim();
  if (!texto) return { rito: null, foraDoFluxo: false };
  const canonico = normalizarRito(texto) ?? texto;
  if (RITOS_FORA_DO_FLUXO.includes(canonico)) return { rito: null, foraDoFluxo: true };
  return { rito: MAPA_RITO_ANTIGO[canonico] ?? null, foraDoFluxo: false };
}

// ---------------------------------------------------------------------------
// Transições e caminho

type Proximo =
  | { tipo: 'etapa'; id: string }
  | { tipo: 'pergunta'; pergunta: PerguntaFluxo }
  | { tipo: 'fim' };

const ehDesvio = (t: unknown): t is Desvio => typeof t === 'object' && t !== null;

/** O que vem depois de uma etapa, dadas as decisões já respondidas no processo. */
export function proximoDe(etapaId: string, processo: ProcessoFluxo): Proximo {
  const regra = TRANSICOES[etapaId];
  if (regra === null) return { tipo: 'fim' };
  if (typeof regra === 'string') return { tipo: 'etapa', id: regra };
  if (ehDesvio(regra)) {
    const resposta = processo[regra.campo];
    if (resposta === undefined || resposta === null) return { tipo: 'pergunta', pergunta: PERGUNTAS[regra.campo] };
    return { tipo: 'etapa', id: resposta ? regra.sim : regra.nao };
  }
  const seguinte = ETAPAS[indice(etapaId) + 1];
  return seguinte ? { tipo: 'etapa', id: seguinte.id } : { tipo: 'fim' };
}

/**
 * Caminho linear conhecido a partir da E01: para na primeira decisão ainda
 * não respondida (`pendente`) ou no fim do fluxo.
 */
export function caminhoDoProcesso(processo: ProcessoFluxo): { etapas: EtapaFluxo[]; pendente: PerguntaFluxo | null } {
  const etapas: EtapaFluxo[] = [];
  const visitadas = new Set<string>();
  let atual: string | null = ETAPAS[0].id;
  while (atual && !visitadas.has(atual)) {
    visitadas.add(atual);
    etapas.push(POR_ID.get(atual) as EtapaFluxo);
    const prox = proximoDe(atual, processo);
    if (prox.tipo === 'pergunta') return { etapas, pendente: prox.pergunta };
    atual = prox.tipo === 'etapa' ? prox.id : null;
  }
  return { etapas, pendente: null };
}

/** Todas as etapas por onde o processo ainda pode passar (decisões em aberto contam os dois lados). */
export function etapasPossiveis(processo: ProcessoFluxo): Set<string> {
  const vistos = new Set<string>();
  const fila: string[] = [ETAPAS[0].id];
  while (fila.length) {
    const id = fila.pop() as string;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const regra = TRANSICOES[id];
    if (ehDesvio(regra)) {
      const resposta = processo[regra.campo];
      if (resposta === undefined || resposta === null) fila.push(regra.sim, regra.nao);
      else fila.push(resposta ? regra.sim : regra.nao);
    } else {
      const prox = proximoDe(id, processo);
      if (prox.tipo === 'etapa') fila.push(prox.id);
    }
  }
  return vistos;
}

// ---------------------------------------------------------------------------
// E07 — checklist por rito

export function itensExigidosE07(processo: ProcessoFluxo): { itens: ItemE07[]; provisorio: boolean } {
  const { rito } = ritoEfetivo(processo);
  if (!rito) return { itens: [], provisorio: false };
  if (RITOS_COM_PERGUNTA_DISPENSA.includes(rito)) {
    const resposta = processo.dispensaAteMetadeLimite;
    if (resposta === true) return { itens: CHECKLIST_E07_DISPENSA_ATE_METADE, provisorio: false };
    return { itens: CHECKLIST_E07[rito], provisorio: resposta === undefined || resposta === null };
  }
  return { itens: CHECKLIST_E07[rito], provisorio: false };
}

/** Compara o checklist marcado no sistema (`checklist_rito`, textos) com os itens exigidos da E07. */
export function avaliarE07(processo: ProcessoFluxo): AvaliacaoE07 {
  const { itens, provisorio } = itensExigidosE07(processo);
  const marcados = (processo.checklist_rito ?? []).map((m) => ` ${chaveTexto(m)} `);
  const feito = (item: ItemE07) =>
    item.apelidos.some((apelido) => marcados.some((m) => m.includes(` ${chaveTexto(apelido)} `)));
  const faltando = itens.filter((item) => !feito(item));
  return { exigidos: itens, faltando, completo: itens.length > 0 && faltando.length === 0, provisorio };
}

// ---------------------------------------------------------------------------
// Sugestão da etapa atual

function localizacaoAtual(processo: ProcessoFluxo, tramitacoes: TramitacaoFluxo[]): string {
  const aberta = tramitacoes
    .filter((t) => !t.data_fim && t.localizacao)
    .sort((a, b) => new Date(b.data_inicio ?? 0).getTime() - new Date(a.data_inicio ?? 0).getTime())[0];
  return aberta?.localizacao || processo.localizacao_atual || '';
}

/**
 * Sugere a etapa atual combinando (1) o checklist e dados do processo (piso),
 * (2) a localização atual/última tramitação e (3) pistas no texto do
 * andamento — estas só desempatam entre etapas que a localização já indicou.
 * Devolve null quando não há base nenhuma (ex.: processo sem rito e sem pistas).
 */
export function sugerirEtapaAtual(processo: ProcessoFluxo, tramitacoes: TramitacaoFluxo[] = []): SugestaoEtapa | null {
  const { rito, foraDoFluxo } = ritoEfetivo(processo);
  if (foraDoFluxo) return null;

  // Piso: a etapa mais avançada que os dados do processo garantem.
  let piso = -1;
  const motivos: string[] = [];
  const elevar = (id: string, motivo: string) => {
    if (indice(id) > piso) {
      piso = indice(id);
      motivos.length = 0;
    }
    if (indice(id) === piso) motivos.push(motivo);
  };
  if (rito) {
    elevar(ETAPA_ARTEFATOS, 'o rito já está definido (a etapa "Definir o rito" foi cumprida)');
    if (avaliarE07(processo).completo) elevar('E08', 'todos os itens do checklist de artefatos estão marcados');
  }
  if (processo.status === 'contratado_aditivado') elevar('E20', 'o processo está marcado como contratado/aditivado');
  if (processo.prd?.trim()) elevar('E21', 'o PRD já foi preenchido');
  if (processo.status === 'arquivado' || processo.status === 'concluido') elevar(ETAPA_FINAL, 'o processo está concluído/arquivado');
  if (piso < 0) return null;

  const possiveis = etapasPossiveis(processo);
  // Se o piso caiu numa etapa que o processo não percorre (ex.: E09 sem dotação), avança até a próxima possível.
  while (piso < ETAPAS.length - 1 && !possiveis.has(ETAPAS[piso].id)) piso += 1;

  const local = semAcento(localizacaoAtual(processo, tramitacoes));
  const regra = local ? REGRAS_LOCALIZACAO.find((r) => r.padroes.some((p) => p.test(local))) : undefined;
  const candidatas = regra ? regra.etapas.filter((id) => possiveis.has(id)) : [];

  if (candidatas.length === 0) {
    if (regra) motivos.push(`o processo está em ${regra.setor}, mas isso não indica uma etapa diferente do que o checklist mostra`);
    return { etapaId: ETAPAS[piso].id, confianca: 'baixa', motivos };
  }

  const texto = semAcento(processo.andamento);
  const pista = texto
    ? PISTAS_ANDAMENTO.find((p) => p.padrao.test(texto) && candidatas.includes(p.etapaId) && indice(p.etapaId) >= piso)
    : undefined;
  // Sem pista: a etapa daquele setor MAIS PRÓXIMA do piso (assim um setor genérico, como "DAL",
  // não faz o processo "pular" várias etapas). Nunca fica abaixo do piso.
  const maisProxima = candidatas.slice().sort((a, b) => Math.abs(indice(a) - piso) - Math.abs(indice(b) - piso) || indice(a) - indice(b))[0];
  const escolhidaId = pista?.etapaId ?? (indice(maisProxima) < piso ? ETAPAS[piso].id : maisProxima);
  const motivosFinais = [...motivos, `o processo está em ${regra!.setor}`];
  if (pista) motivosFinais.push('o andamento menciona essa etapa');
  const confianca: Confianca = pista || (escolhidaId === ETAPAS[piso].id && candidatas.includes(escolhidaId)) ? 'alta' : 'media';
  return { etapaId: escolhidaId, confianca, motivos: motivosFinais };
}

// ---------------------------------------------------------------------------
// Resultado completo para as telas

function diasDesde(data: string | undefined, agora: Date): number | null {
  if (!data) return null;
  const t = new Date(data).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / 86_400_000));
}

export function calcularFluxo(
  processo: ProcessoFluxo,
  tramitacoes: TramitacaoFluxo[] = [],
  agora: Date = new Date(),
): FluxoCalculado {
  const { rito, foraDoFluxo } = ritoEfetivo(processo);
  const e07 = avaliarE07(processo);
  const vazio: FluxoCalculado = {
    foraDoFluxo, rito, etapaAtual: null, etapaOrigem: null, confirmada: false, sugestao: null,
    sugestaoDiferente: false, proxima: null, motivoProxima: null, proximaOpcional: false,
    setorAgora: null, setorProxima: null, decisoesPendentes: [], e07, concluido: false,
    diasDesdeUltimaTramitacao: diasDesde(processo.ultima_tramitacao, agora),
  };
  if (foraDoFluxo) return { ...vazio, e07: { exigidos: [], faltando: [], completo: false, provisorio: false } };

  const sugestao = sugerirEtapaAtual(processo, tramitacoes);
  const confirmadaEtapa = etapaPorId(processo.etapaAtualId);
  const atualId = confirmadaEtapa?.id ?? sugestao?.etapaId ?? null;
  const etapaAtual = etapaPorId(atualId);
  const confirmada = !!confirmadaEtapa;

  // Decisões em aberto: dispensa (só muda o checklist da E07) e as dos desvios até a etapa atual.
  const pendentes: PendenciaDecisao[] = [];
  const iAtual = atualId ? indice(atualId) : -1;
  if (rito && RITOS_COM_PERGUNTA_DISPENSA.includes(rito) && processo.dispensaAteMetadeLimite == null && iAtual <= indice(ETAPA_ARTEFATOS)) {
    pendentes.push({ ...PERGUNTAS.dispensaAteMetadeLimite, bloqueiaProximo: false });
  }
  const possiveis = etapasPossiveis(processo);
  for (const [id, regra] of Object.entries(TRANSICOES)) {
    if (!ehDesvio(regra) || !possiveis.has(id) || indice(id) > iAtual) continue;
    if (processo[regra.campo] == null) pendentes.push({ ...PERGUNTAS[regra.campo], bloqueiaProximo: id === atualId });
  }

  // Próxima etapa.
  let proxima: EtapaFluxo | null = null;
  let motivoProxima: string | null = null;
  if (!rito) {
    proxima = etapaPorId(ETAPA_DEFINIR_RITO);
    motivoProxima = 'Definir o rito processual';
  } else if (atualId) {
    const prox = proximoDe(atualId, processo);
    if (prox.tipo === 'etapa') proxima = etapaPorId(prox.id);
  }

  return {
    ...vazio,
    rito,
    etapaAtual,
    etapaOrigem: confirmada ? (processo.etapaOrigem ?? 'manual') : null,
    confirmada,
    sugestao,
    sugestaoDiferente: confirmada && !!sugestao && sugestao.etapaId !== confirmadaEtapa?.id,
    proxima,
    motivoProxima,
    proximaOpcional: !!proxima?.opcional,
    setorAgora: etapaAtual?.setor ?? null,
    setorProxima: proxima?.setor ?? null,
    decisoesPendentes: pendentes,
    concluido: atualId === ETAPA_FINAL,
  };
}
