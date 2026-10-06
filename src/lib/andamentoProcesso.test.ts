import { describe, expect, it } from 'vitest';
import { resolverAndamento } from './andamentoProcesso';

const AGORA = '2026-10-06T12:00:00.000Z';
const ANTES = '2026-10-05T12:00:00.000Z';
const ONTEM_TARDE = '2026-10-05T18:00:00.000Z';

describe('resolverAndamento', () => {
  it('iguais: nada a fazer', () => {
    const r = resolverAndamento({ andamento: 'Em análise', andamento_planilha: 'Em análise' }, 'Em análise', AGORA);
    expect(r.origem).toBe('igual');
    expect(r.valor).toBe('Em análise');
    expect(r.pendenteNaPlanilha).toBe(false);
  });

  it('só a planilha mudou: planilha vence e o retrato é atualizado', () => {
    const r = resolverAndamento({ andamento: 'Velho', andamento_planilha: 'Velho', andamento_planilha_em: ANTES }, 'Novo da planilha', AGORA);
    expect(r).toMatchObject({ origem: 'planilha', valor: 'Novo da planilha', pendenteNaPlanilha: false });
    expect(r.controle).toEqual({ andamento_planilha: 'Novo da planilha', andamento_planilha_em: AGORA });
  });

  it('só o sistema mudou: sistema vence e fica pendente de gravar na planilha', () => {
    const r = resolverAndamento(
      { andamento: 'Digitado no sistema', andamento_planilha: 'Velho', andamento_planilha_em: ANTES, andamento_editado_em: ONTEM_TARDE },
      'Velho',
      AGORA,
    );
    expect(r).toMatchObject({ origem: 'sistema', valor: 'Digitado no sistema', pendenteNaPlanilha: true });
    expect(r.controle.andamento_planilha).toBe('Velho');
  });

  it('os dois mudaram: vale a edição mais recente (sistema editado depois do retrato)', () => {
    const r = resolverAndamento(
      { andamento: 'Sistema', andamento_planilha: 'Velho', andamento_planilha_em: ANTES, andamento_editado_em: ONTEM_TARDE },
      'Planilha',
      AGORA,
    );
    expect(r.origem).toBe('sistema');
  });

  it('os dois mudaram, mas o sistema foi editado antes do retrato: planilha vence', () => {
    const r = resolverAndamento(
      { andamento: 'Sistema', andamento_planilha: 'Velho', andamento_planilha_em: ONTEM_TARDE, andamento_editado_em: ANTES },
      'Planilha',
      AGORA,
    );
    expect(r.origem).toBe('planilha');
  });

  it('sem retrato (processo antigo): planilha vence', () => {
    expect(resolverAndamento({ andamento: 'Antigo' }, 'Planilha', AGORA).origem).toBe('planilha');
  });

  it('sem retrato mas editado no sistema e ainda não gravado: sistema vence', () => {
    const r = resolverAndamento({ andamento: 'Sistema', andamento_editado_em: ONTEM_TARDE }, 'Planilha', AGORA);
    expect(r).toMatchObject({ origem: 'sistema', pendenteNaPlanilha: true });
  });

  it('ignora espaços nas pontas ao comparar', () => {
    expect(resolverAndamento({ andamento: ' Igual ', andamento_planilha: 'Igual' }, 'Igual ', AGORA).origem).toBe('igual');
  });
});
