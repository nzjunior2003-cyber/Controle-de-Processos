import { describe, expect, it } from 'vitest';
import {
  SEM_CLASSIFICACAO,
  classificacaoDoPagamento,
  descricaoDoCodigo,
  ehItemDotacaoOrcamentaria,
  idItemCatalogo,
  limparClassificacoes,
  totaisPorCampoOrcamentario,
} from './orcamento';
import type { DotacaoOrcamentaria, PagamentoContrato } from '../types';

const catalogo = [
  { campo: 'naturezaDespesa' as const, codigo: '339033', descricao: 'Passagens e despesas com locomoção' },
  { campo: 'planoInterno' as const, codigo: 'PAE4108825C', descricao: 'Plano da OI' },
];

const pagamento = (extra: Partial<PagamentoContrato>): PagamentoContrato => ({
  id: 'p',
  contratoId: 'c1',
  fonteRecurso: 'Tesouro',
  valorTotal: 100,
  status: 'pago',
  competencia: '2026-03',
  criado_em: '2026-03-01T00:00:00.000Z',
  atualizado_em: '2026-03-01T00:00:00.000Z',
  ...extra,
});

describe('catálogo orçamentário', () => {
  it('acha a descrição ignorando caixa e espaços', () => {
    expect(descricaoDoCodigo(catalogo, 'naturezaDespesa', ' 339033 ')).toBe('Passagens e despesas com locomoção');
    expect(descricaoDoCodigo(catalogo, 'planoInterno', 'pae4108825c')).toBe('Plano da OI');
  });

  it('código desconhecido, vazio ou de outro campo não tem descrição', () => {
    expect(descricaoDoCodigo(catalogo, 'naturezaDespesa', '999999')).toBe('');
    expect(descricaoDoCodigo(catalogo, 'naturezaDespesa', '')).toBe('');
    expect(descricaoDoCodigo(catalogo, 'fonte', '339033')).toBe('');
  });

  it('id é estável e seguro pro Firestore', () => {
    expect(idItemCatalogo('fonte', '01500.000001')).toBe(idItemCatalogo('fonte', ' 01500.000001 '));
    expect(idItemCatalogo('programaTrabalho', '06.122.1297-8338/2')).not.toMatch(/[/.]/);
  });

  it('reconhece o item do checklist com variações de nome', () => {
    expect(ehItemDotacaoOrcamentaria('Dotação Orçamentária')).toBe(true);
    expect(ehItemDotacaoOrcamentaria('DOTACAO ORCAMENTARIA (SEPLAD)')).toBe(true);
    expect(ehItemDotacaoOrcamentaria('Parecer Jurídico')).toBe(false);
  });
});

describe('limparClassificacoes', () => {
  it('tira campos vazios e linhas sem nada', () => {
    expect(limparClassificacoes([{ fonte: ' 0150 ', naturezaDespesa: '' }, {}, { planoInterno: '  ' }])).toEqual([{ fonte: '0150' }]);
  });
});

describe('totaisPorCampoOrcamentario', () => {
  const dotacao = { id: 'd1', fonteCodigo: '01759.000091', naturezaDespesa: '339040' } as DotacaoOrcamentaria;

  it('soma pago e em tramitação por código, ignorando arquivados', () => {
    const pagamentos = [
      pagamento({ id: 'a', classificacao: { fonte: '01500.000001' }, valorTotal: 300 }),
      pagamento({ id: 'b', classificacao: { fonte: '01500.000001' }, valorTotal: 50, status: 'em_tramitacao' }),
      pagamento({ id: 'c', classificacao: { fonte: '01500.000001' }, valorTotal: 999, status: 'arquivado' }),
      pagamento({ id: 'd', classificacao: { fonte: '01759.000091' }, valorTotal: 70 }),
    ];
    const totais = totaisPorCampoOrcamentario(pagamentos, [], 'fonte', 2026);
    expect(totais).toEqual([
      { codigo: '01500.000001', pago: 300, emTramitacao: 50, quantidade: 2 },
      { codigo: '01759.000091', pago: 70, emTramitacao: 0, quantidade: 1 },
    ]);
  });

  it('usa a dotação ligada quando o pagamento não tem classificação, e agrupa o resto como "sem classificação"', () => {
    const pagamentos = [pagamento({ id: 'a', dotacaoId: 'd1', valorTotal: 10 }), pagamento({ id: 'b', valorTotal: 5 })];
    expect(classificacaoDoPagamento(pagamentos[0], [dotacao])).toEqual({ fonte: '01759.000091', naturezaDespesa: '339040' });
    const porFonte = totaisPorCampoOrcamentario(pagamentos, [dotacao], 'fonte');
    expect(porFonte.map((l) => l.codigo).sort()).toEqual(['01759.000091', SEM_CLASSIFICACAO].sort());
  });

  it('filtra pelo exercício da competência e agrupa códigos iguais com caixa diferente', () => {
    const pagamentos = [
      pagamento({ id: 'a', classificacao: { planoInterno: 'abc' }, valorTotal: 1 }),
      pagamento({ id: 'b', classificacao: { planoInterno: 'ABC' }, valorTotal: 2 }),
      pagamento({ id: 'c', classificacao: { planoInterno: 'ABC' }, valorTotal: 4, competencia: '2025-12' }),
    ];
    const totais = totaisPorCampoOrcamentario(pagamentos, [], 'planoInterno', 2026);
    expect(totais).toHaveLength(1);
    expect(totais[0].pago).toBe(3);
  });
});
