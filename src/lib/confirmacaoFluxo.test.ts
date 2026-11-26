import { describe, expect, it } from 'vitest';
import { RITO_ANTIGO_EQUIVALENTE } from '../config/fluxoCompras';
import { calcularFluxo } from './fluxoCompras';
import { camposConfirmacao, camposConfirmacaoComHistorico, camposResposta, camposRito, podeConfirmarFluxo, resumoProximoPasso } from './confirmacaoFluxo';
import { RITOS_CANONICOS } from './ritosProcessuais';

describe('confirmação do fluxo', () => {
  const agora = new Date('2026-11-20T12:00:00Z');

  it('aceitar a sugestão grava origem "auto"', () => {
    expect(camposConfirmacao('E07', 'E07', 'u1', agora)).toEqual({
      etapaAtualId: 'E07', etapaOrigem: 'auto', etapaConfirmadaEm: '2026-11-20T12:00:00.000Z', etapaConfirmadaPor: 'u1',
    });
  });
  it('escolher outra etapa (ou não haver sugestão) grava origem "manual"', () => {
    expect(camposConfirmacao('E14', 'E07', 'u1', agora).etapaOrigem).toBe('manual');
    expect(camposConfirmacao('E14', null, 'u1', agora).etapaOrigem).toBe('manual');
  });
  it('recusa etapa que não existe', () => {
    expect(() => camposConfirmacao('E99', null, 'u1')).toThrow();
  });
  it('resposta grava só o campo da decisão', () => {
    expect(camposResposta('necessitaDotacao', false)).toEqual({ necessitaDotacao: false });
  });

  it('definir rito preenche o rito antigo só se estiver vazio e houver equivalente', () => {
    expect(camposRito('pregao', {})).toEqual({ ritoProcessual: 'pregao', rito_processual: 'Pregão Eletrônico' });
    expect(camposRito('pregao', { rito_processual: 'Inexigibilidade' })).toEqual({ ritoProcessual: 'pregao' });
    expect(camposRito('concorrencia', {})).toEqual({ ritoProcessual: 'concorrencia' });
  });
  it('os nomes antigos equivalentes existem na lista de ritos do sistema', () => {
    Object.values(RITO_ANTIGO_EQUIVALENTE).forEach((nome) => expect(Object.keys(RITOS_CANONICOS)).toContain(nome));
  });

  it('só master, apoio e contratos confirmam', () => {
    ['master', 'apoio', 'contratos'].forEach((p) => expect(podeConfirmarFluxo(p)).toBe(true));
    ['gestao', 'fiscal', 'financeiro', 'demandante', 'dga', undefined].forEach((p) => expect(podeConfirmarFluxo(p)).toBe(false));
  });

  it('resumo para a lista', () => {
    expect(resumoProximoPasso(calcularFluxo({}))).toBe('Próximo: Definir o rito processual');
    expect(resumoProximoPasso(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E08' }))).toBe('Responder: É necessário dotação orçamentária?');
    expect(resumoProximoPasso(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E14', cbmGerenciadorOuParticipeArp: false }))).toBe('Próximo: Submeter à aprovação do Cmte Geral · CONJUR');
    expect(resumoProximoPasso(calcularFluxo({ rito_processual: 'Prorrogação' }))).toBe('');
    expect(resumoProximoPasso(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E35' }))).toBe('Fluxo concluído');
  });

  describe('com histórico (Fase D)', () => {
    const agora2 = new Date('2026-11-20T12:00:00Z');
    const chegada = new Date('2026-11-18T12:00:00Z');

    it('primeira confirmação grava a passagem com a data de chegada informada', () => {
      const c = camposConfirmacaoComHistorico({ ritoProcessual: 'pregao' }, 'E07', 'E07', 'u1', { modo: 'confirmar', chegada, agora: agora2 });
      expect(c.etapaAtualId).toBe('E07');
      expect(c.etapaOrigem).toBe('auto');
      expect(c.etapaConfirmadaEm).toBe(agora2.toISOString());
      expect(c.historicoEtapas).toEqual([{ etapaId: 'E07', inicio: chegada.toISOString(), por: 'u1', origem: 'auto' }]);
    });

    it('sem data de chegada, vale o momento da confirmação', () => {
      const c = camposConfirmacaoComHistorico({}, 'E07', null, 'u1', { modo: 'confirmar', agora: agora2 });
      expect(c.historicoEtapas[0].inicio).toBe(agora2.toISOString());
      expect(c.etapaOrigem).toBe('manual');
    });

    it('avançar fecha a etapa que já estava confirmada (processo da Fase B, sem histórico gravado)', () => {
      const processo = { ritoProcessual: 'pregao' as const, etapaAtualId: 'E07', etapaConfirmadaEm: '2026-11-10T12:00:00Z', etapaConfirmadaPor: 'u0', etapaOrigem: 'auto' as const };
      const c = camposConfirmacaoComHistorico(processo, 'E08', null, 'u1', { modo: 'avancar', chegada, agora: agora2 });
      expect(c.historicoEtapas).toHaveLength(2);
      expect(c.historicoEtapas[0]).toMatchObject({ etapaId: 'E07', fim: chegada.toISOString() });
      expect(c.historicoEtapas[1]).toMatchObject({ etapaId: 'E08' });
    });

    it('corrigir substitui a etapa em andamento', () => {
      const processo = { etapaAtualId: 'E07', etapaConfirmadaEm: '2026-11-10T12:00:00Z', etapaConfirmadaPor: 'u0' };
      const c = camposConfirmacaoComHistorico(processo, 'E12', null, 'u1', { modo: 'corrigir', chegada, agora: agora2 });
      expect(c.historicoEtapas.map((p) => p.etapaId)).toEqual(['E12']);
    });

    it('recusa data futura ou anterior à etapa anterior', () => {
      const processo = { etapaAtualId: 'E07', etapaConfirmadaEm: '2026-11-10T12:00:00Z', etapaConfirmadaPor: 'u0' };
      expect(() => camposConfirmacaoComHistorico(processo, 'E08', null, 'u1', { modo: 'avancar', chegada: new Date('2026-12-25T00:00:00Z'), agora: agora2 })).toThrow();
      expect(() => camposConfirmacaoComHistorico(processo, 'E08', null, 'u1', { modo: 'avancar', chegada: new Date('2026-11-01T00:00:00Z'), agora: agora2 })).toThrow();
    });
  });
});
