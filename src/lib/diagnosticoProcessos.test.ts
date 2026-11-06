import { describe, expect, it } from 'vitest';
import { diagnosticarProcessos, planoDeLimpeza } from './diagnosticoProcessos';

const proc = (id: string, numero: string, extra: Record<string, unknown> = {}) => ({
  id,
  numero_processo: numero,
  objeto: 'obj ' + id,
  criado_em: '2026-10-01T10:00:00Z',
  ...extra,
});

describe('diagnosticarProcessos', () => {
  const linhas = [{ numero_processo: '2026/1' }, { numero_processo: '2026/2', paes_vinculados: ['2025/9'] }];

  it('separa casados, órfãos e duplicados', () => {
    const d = diagnosticarProcessos(
      [
        proc('a', '2026/1'),
        proc('b', 'E-2026/1', { criado_em: '2026-10-02T10:00:00Z', checklist_rito: ['x', 'y'] }),
        proc('c', '2025/9'), // vinculado de outra linha: casa
        proc('d', '2026/777'), // sem linha: órfão
      ],
      linhas,
    );
    expect(d.totalApp).toBe(4);
    expect(d.linhasPlanilha).toBe(2);
    expect(d.orfaos.map((o) => o.id)).toEqual(['d']);
    expect(d.casados).toBe(3);
    expect(d.duplicados).toHaveLength(1);
    expect(d.duplicados[0].chave).toBe('2026/1');
    expect(d.excedenteDuplicado).toBe(1);
  });

  it('sugere manter o registro mais completo (empate: o mais antigo)', () => {
    const d = diagnosticarProcessos(
      [proc('novo', '2026/1', { criado_em: '2026-10-05T00:00:00Z' }), proc('antigo', '2026/1', { criado_em: '2026-10-01T00:00:00Z' })],
      linhas,
    );
    expect(d.duplicados[0].manter).toBe('antigo');
    const d2 = diagnosticarProcessos(
      [proc('a', '2026/1', { criado_em: '2026-10-01T00:00:00Z' }), proc('b', '2026/1', { dotacoes_orcamentarias: [{}] })],
      linhas,
    );
    expect(d2.duplicados[0].manter).toBe('b');
    expect(d2.duplicados[0].docs[0].motivos).toContain('dotação');
  });

  it('conta registros criados por dia', () => {
    const d = diagnosticarProcessos(
      [proc('a', '2026/1'), proc('b', '2026/2', { criado_em: '2026-10-01T23:00:00Z' }), proc('c', '2026/3', { criado_em: '2026-10-09T00:00:00Z' })],
      linhas,
    );
    expect(d.porDia).toEqual([{ dia: '2026-10-01', quantidade: 2 }, { dia: '2026-10-09', quantidade: 1 }]);
  });

  it('número sem PAE no formato usa o texto para comparar', () => {
    const d = diagnosticarProcessos([proc('a', 'SEM-PAE')], [{ numero_processo: 'sem-pae' }]);
    expect(d.orfaos).toHaveLength(0);
  });
});

describe('planoDeLimpeza', () => {
  const doc = (id: string, numero: string, pontos = 0) => ({ id, numero_processo: numero, objeto: '', criado_em: '', pontos, motivos: [] });
  it('só libera para exclusão o que não tem dados, vínculo nem status de contratado', () => {
    const plano = planoDeLimpeza(
      [doc('a', '2026/1'), doc('b', '2026/2', 3), doc('c', '2026/3'), doc('d', '2026/4')],
      new Map([['d', 'contratado_aditivado']]),
      { paesVinculados: ['E-2026/3'] },
    );
    expect(plano.excluiveis.map((d) => d.id)).toEqual(['a']);
    expect(plano.revisar.map((d) => d.id)).toEqual(['b', 'c', 'd']);
  });
});
