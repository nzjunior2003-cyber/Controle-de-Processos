import { describe, expect, it } from 'vitest';
import { RITO_ANTIGO_EQUIVALENTE } from '../config/fluxoCompras';
import { calcularFluxo } from './fluxoCompras';
import { camposConfirmacao, camposResposta, camposRito, podeConfirmarFluxo, resumoProximoPasso } from './confirmacaoFluxo';
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
});
