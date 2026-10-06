/**
 * Lógica pura de quem deve ser notificado (push + central interna) quando
 * um processo tem um evento-chave: mudança de setor/localização, mudança
 * de fase/status, ou conclusão. Sem Cloud Functions neste projeto — quem
 * dispara é sempre o cliente que fez a escrita (ver
 * `dispararNotificacoesProcesso`, AppContext.tsx).
 */
import type { Notificacao, Processo, TipoEventoProcesso, Usuario } from '../types';

/**
 * Quem recebe a notificação de cada tipo de evento:
 * - `mudanca_setor`: os demandantes ativos do setor do processo + toda a
 *   equipe de Apoio e Suprimento (inclui master) — pra atualizarem o
 *   andamento no sistema.
 * - `mudanca_fase`/`conclusao`: só os demandantes do setor — quem fez a
 *   mudança (Apoio) já sabe.
 */
export function destinatariosEventoProcesso(
  tipo: TipoEventoProcesso,
  processo: Pick<Processo, 'unidade_demandante'>,
  usuarios: Usuario[],
): Usuario[] {
  const demandantesDoSetor = usuarios.filter(
    (u) => u.ativo && u.perfil === 'demandante' && u.unidadeDemandante === processo.unidade_demandante,
  );

  if (tipo !== 'mudanca_setor') return demandantesDoSetor;

  const equipeApoio = usuarios.filter((u) => u.ativo && (u.perfil === 'apoio' || u.perfil === 'master'));
  const idsJaIncluidos = new Set(demandantesDoSetor.map((u) => u.id));
  return [...demandantesDoSetor, ...equipeApoio.filter((u) => !idsJaIncluidos.has(u.id))];
}

const TITULOS: Record<TipoEventoProcesso, (numero: string) => string> = {
  mudanca_setor: (numero) => `Processo ${numero} mudou de setor`,
  mudanca_fase: (numero) => `Processo ${numero} mudou de fase`,
  conclusao: (numero) => `Processo ${numero} foi concluído`,
};

const CORPOS: Record<TipoEventoProcesso, (processo: Pick<Processo, 'objeto' | 'localizacao_atual'>) => string> = {
  mudanca_setor: (p) => `Agora está em: ${p.localizacao_atual || 'setor não informado'}. Objeto: ${p.objeto}`,
  mudanca_fase: (p) => `Objeto: ${p.objeto}`,
  conclusao: (p) => `Processo concluído. Objeto: ${p.objeto}`,
};

/** Monta a notificação (sem id) pra um destinatário específico. */
export function montarNotificacao(
  tipo: TipoEventoProcesso,
  processo: Pick<Processo, 'id' | 'numero_processo' | 'objeto' | 'localizacao_atual'>,
  destinatarioId: string,
): Omit<Notificacao, 'id'> {
  return {
    destinatarioId,
    tipo,
    titulo: TITULOS[tipo](processo.numero_processo),
    corpo: CORPOS[tipo](processo),
    url: `/sistema/processos/${processo.id}`,
    lida: false,
    criado_em: new Date().toISOString(),
  };
}
