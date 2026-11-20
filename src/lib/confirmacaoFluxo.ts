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
import type { Processo } from '../types';
import type { FluxoCalculado } from './fluxoCompras';

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
