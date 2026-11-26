/**
 * Monta (em funções puras) o que a tela do fluxo de compras grava no processo.
 * Quem grava de fato é `updateProcesso`; aqui só se decide QUAIS campos.
 */
import {
  ETAPAS,
  PERFIS_QUE_CONFIRMAM_FLUXO,
  RITO_ANTIGO_EQUIVALENTE,
  type CampoDecisao,
  type RitoCompras,
} from '../config/fluxoCompras';
import type { PassagemEtapa, Processo } from '../types';
import { historicoEfetivo, registrarEtapa, type ModoRegistro } from './historicoEtapas';
import type { FluxoCalculado, ProcessoFluxo } from './fluxoCompras';

export function podeConfirmarFluxo(perfil: string | undefined): boolean {
  return !!perfil && PERFIS_QUE_CONFIRMAM_FLUXO.includes(perfil);
}

type CamposConfirmacao = Pick<Processo, 'etapaAtualId' | 'etapaOrigem' | 'etapaConfirmadaEm' | 'etapaConfirmadaPor'>;

/**
 * Confirma uma etapa. `etapaOrigem` = 'auto' quando o usuário aceitou
 * exatamente o que o sistema sugeriu; 'manual' quando escolheu outra.
 */
export function camposConfirmacao(
  etapaId: string,
  sugeridaId: string | null | undefined,
  usuarioId: string,
  agora: Date = new Date(),
): CamposConfirmacao {
  if (!ETAPAS.some((e) => e.id === etapaId)) throw new Error(`Etapa inválida: ${etapaId}`);
  return {
    etapaAtualId: etapaId,
    etapaOrigem: etapaId === sugeridaId ? 'auto' : 'manual',
    etapaConfirmadaEm: agora.toISOString(),
    etapaConfirmadaPor: usuarioId,
  };
}

/**
 * Confirmação com histórico (Fase D): os mesmos campos de `camposConfirmacao` mais a
 * linha do tempo atualizada. `chegada` = quando o processo chegou nesta etapa
 * (padrão: agora). Modos: 'confirmar' (1ª vez), 'avancar' (fecha a etapa atual e abre
 * a próxima) e 'corrigir' (a etapa registrada estava errada: substitui, não conta).
 */
export function camposConfirmacaoComHistorico(
  processo: ProcessoFluxo,
  etapaId: string,
  sugeridaId: string | null | undefined,
  usuarioId: string,
  opcoes: { modo: ModoRegistro; chegada?: Date; agora?: Date },
): CamposConfirmacao & { historicoEtapas: PassagemEtapa[] } {
  const agora = opcoes.agora ?? new Date();
  const base = camposConfirmacao(etapaId, sugeridaId, usuarioId, agora);
  const historicoEtapas = registrarEtapa(
    historicoEfetivo(processo), etapaId, opcoes.modo, opcoes.chegada ?? agora, usuarioId, base.etapaOrigem ?? 'manual', agora,
  );
  return { ...base, historicoEtapas };
}

/** Resposta de uma pergunta do fluxo: grava só o campo da decisão. */
export function camposResposta(campo: CampoDecisao, valor: boolean): Partial<Processo> {
  return { [campo]: valor };
}

/** Definir o rito: grava `ritoProcessual` e, se o rito antigo estiver vazio, o nome antigo equivalente. */
export function camposRito(rito: RitoCompras, processo: Pick<Processo, 'rito_processual'>): Partial<Processo> {
  const campos: Partial<Processo> = { ritoProcessual: rito };
  const antigo = RITO_ANTIGO_EQUIVALENTE[rito];
  if (antigo && !processo.rito_processual?.trim()) campos.rito_processual = antigo;
  return campos;
}

/** Texto curto para a lista de processos. */
export function resumoProximoPasso(fluxo: FluxoCalculado): string {
  if (fluxo.foraDoFluxo) return '';
  if (fluxo.concluido) return 'Fluxo concluído';
  if (!fluxo.rito) return 'Próximo: Definir o rito processual';
  const bloqueio = fluxo.decisoesPendentes.find((d) => d.bloqueiaProximo);
  if (bloqueio) return `Responder: ${bloqueio.texto}`;
  if (!fluxo.proxima) return '';
  return `Próximo: ${fluxo.proxima.nome}${fluxo.setorProxima ? ` · ${fluxo.setorProxima}` : ''}`;
}
