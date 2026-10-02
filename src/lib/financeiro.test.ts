import { describe, expect, it } from 'vitest';
import {
  valorASerAbatido,
  valorAPagarDoContrato,
  valorJaAbatido,
  competenciaDoPagamento,
  descreverAndamento,
  diferencaDocumentos,
  registrarAndamento,
  reforcoNecessario,
  saldoDaDotacao,
  saldoDoExercicio,
  statusDoPagamento,
  totaisPorMes,
  totalPagoDaDotacao,
  totalPagoDoContrato,
  totalPagoPorFonte,
  valorDoPagamento,
} from './financeiro';
import type { DotacaoOrcamentaria, Empenho, PagamentoContrato } from '../types';

const pagamento = (overrides: Partial<PagamentoContrato>): PagamentoContrato => ({
  id: 'pag-1',
  contratoId: 'contrato-1',
  numeroEmpenho: '2026NE000123',
  numeroOrdemPagamento: 'OP-001',
  dotacaoId: 'dotacao-1',
  fonteRecurso: 'Tesouro',
  valorPago: 1000,
  dataPagamento: '2026-01-15T00:00:00.000Z',
  criado_em: '2026-01-15T00:00:00.000Z',
  atualizado_em: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

const dotacao: DotacaoOrcamentaria = {
  id: 'dotacao-1',
  exercicio: 2026,
  codigo: '3.3.90.30',
  descricao: 'Material de consumo',
  fonteRecurso: 'Tesouro',
  valorDotado: 5000,
  criado_em: '2026-01-01T00:00:00.000Z',
  atualizado_em: '2026-01-01T00:00:00.000Z',
};

describe('totalPagoDaDotacao', () => {
  it('soma só os pagamentos daquela dotação', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 1000 }),
      pagamento({ id: 'b', valorPago: 500, dotacaoId: 'outra-dotacao' }),
      pagamento({ id: 'c', valorPago: 200 }),
    ];
    expect(totalPagoDaDotacao('dotacao-1', pagamentos)).toBe(1200);
  });

  it('devolve 0 sem pagamentos vinculados', () => {
    expect(totalPagoDaDotacao('dotacao-1', [])).toBe(0);
  });
});

describe('saldoDaDotacao', () => {
  it('subtrai o total pago do valor dotado', () => {
    const pagamentos = [pagamento({ valorPago: 1200 })];
    expect(saldoDaDotacao(dotacao, pagamentos)).toBe(3800);
  });

  it('devolve o valor total quando não há pagamentos', () => {
    expect(saldoDaDotacao(dotacao, [])).toBe(5000);
  });
});

describe('totalPagoDoContrato', () => {
  it('soma só os pagamentos daquele contrato', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 300 }),
      pagamento({ id: 'b', valorPago: 400, contratoId: 'outro-contrato' }),
    ];
    expect(totalPagoDoContrato('contrato-1', pagamentos)).toBe(300);
  });
});

describe('totalPagoPorFonte', () => {
  it('agrupa o total pago por fonte de recurso', () => {
    const pagamentos = [
      pagamento({ id: 'a', valorPago: 300, fonteRecurso: 'Tesouro' }),
      pagamento({ id: 'b', valorPago: 200, fonteRecurso: 'FEBOM' }),
      pagamento({ id: 'c', valorPago: 100, fonteRecurso: 'Tesouro' }),
    ];
    expect(totalPagoPorFonte(pagamentos)).toEqual({ Tesouro: 400, FEBOM: 200 });
  });

  it('agrupa sem fonte definida sob "Sem fonte"', () => {
    const pagamentos = [pagamento({ fonteRecurso: '' })];
    expect(totalPagoPorFonte(pagamentos)).toEqual({ 'Sem fonte': 1000 });
  });
});


// --- Modelo novo: PAE da fatura, NFs, NE de origem/reforço, OB, setor/etapa ---

const fatura = (overrides: Partial<PagamentoContrato>): PagamentoContrato => ({
  id: 'f1',
  contratoId: 'c1',
  fonteRecurso: 'TESOURO',
  status: 'em_tramitacao',
  criado_em: '2026-01-10T00:00:00.000Z',
  atualizado_em: '2026-01-10T00:00:00.000Z',
  ...overrides,
});

describe('compatibilidade com o modelo anterior', () => {
  it('registro sem status conta como pago e usa valorPago/dataPagamento', () => {
    const antigo = pagamento({});
    expect(statusDoPagamento(antigo)).toBe('pago');
    expect(valorDoPagamento(antigo)).toBe(1000);
    expect(competenciaDoPagamento(antigo)).toBe('2026-01');
  });

  it('valorTotal tem prioridade sobre valorPago', () => {
    expect(valorDoPagamento(pagamento({ valorTotal: 250 }))).toBe(250);
  });
});

describe('pagamentos arquivados', () => {
  it('não entram em nenhuma soma (caso da NF 37775 arquivada da OI)', () => {
    const pagamentos = [
      fatura({ id: 'a', valorTotal: 69097.7, status: 'arquivado', competencia: '2026-02' }),
      fatura({ id: 'b', valorTotal: 8283.66, competencia: '2026-02' }),
      fatura({ id: 'c', valorTotal: 72581.62, competencia: '2026-02' }),
    ];
    const meses = totaisPorMes(pagamentos);
    expect(meses).toHaveLength(1);
    expect(meses[0].total).toBeCloseTo(80865.28, 2);
    expect(meses[0].quantidade).toBe(2);
    expect(totalPagoDoContrato('c1', pagamentos)).toBeCloseTo(80865.28, 2);
  });
});

describe('totaisPorMes', () => {
  it('soma por mês e separa o que já foi pago', () => {
    const pagamentos = [
      fatura({ id: '1', valorTotal: 5581.4, competencia: '2026-01', status: 'pago' }),
      fatura({ id: '2', valorTotal: 39231.1, competencia: '2026-01', status: 'em_tramitacao' }),
      fatura({ id: '3', valorTotal: 100, competencia: '2026-03' }),
    ];
    const meses = totaisPorMes(pagamentos);
    expect(meses.map((m) => m.mes)).toEqual(['2026-01', '2026-03']);
    expect(meses[0].total).toBeCloseTo(44812.5, 2);
    expect(meses[0].pago).toBeCloseTo(5581.4, 2);
  });
});

describe('diferencaDocumentos', () => {
  it('aponta a diferença entre o valor da fatura e a soma das NFs (março do WEBTRIP)', () => {
    const p = {
      valorTotal: 52614.89,
      documentos: [
        { tipo: 'NF' as const, numero: '147586', valor: 5057.92 },
        { tipo: 'NF' as const, numero: '147585', valor: 2702.64 },
        { tipo: 'NF' as const, numero: '145369', valor: 6661.67 },
        { tipo: 'NF' as const, numero: '145368', valor: 2422.33 },
        { tipo: 'NF' as const, numero: '144850', valor: 3501.12 },
      ],
    };
    // A planilha mostra 52.614,89 em março, mas as NFs somam 20.345,68.
    expect(diferencaDocumentos(p)).toBe(32269.21);
  });

  it('devolve 0 quando bate', () => {
    const p = { valorTotal: 100, documentos: [{ tipo: 'NF' as const, numero: '1', valor: 60 }, { tipo: 'NF' as const, numero: '2', valor: 40 }] };
    expect(diferencaDocumentos(p)).toBe(0);
  });

  it('devolve null quando alguma NF não tem valor (valor só em bloco) ou não há NFs', () => {
    const semValor = { valorTotal: 100, documentos: [{ tipo: 'NF' as const, numero: '1' }, { tipo: 'NF' as const, numero: '2', valor: 40 }] };
    expect(diferencaDocumentos(semValor)).toBeNull();
    expect(diferencaDocumentos({ valorTotal: 100, documentos: [] })).toBeNull();
  });
});

describe('saldoDoExercicio e reforcoNecessario', () => {
  const empenho = (overrides: Partial<Empenho>): Empenho => ({
    id: 'e1',
    contratoId: 'c1',
    exercicio: 2026,
    tipo: 'origem',
    numero: '73',
    valor: 1,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('origem simbólica de R$ 1,00 + reforço cobrem a fatura', () => {
    const empenhos = [empenho({}), empenho({ id: 'e2', tipo: 'reforco', numero: '85', valor: 44812.5, neOrigemId: 'e1' })];
    const pagamentos = [fatura({ valorTotal: 44812.5, empenhoIds: ['e2'] })];
    const saldo = saldoDoExercicio('c1', 2026, empenhos, pagamentos);
    expect(saldo.empenhado).toBeCloseTo(44813.5, 2);
    expect(saldo.comprometido).toBe(44812.5);
    expect(saldo.saldo).toBeCloseTo(1, 2);
  });

  it('ignora NEs de outro contrato/exercício e pagamentos arquivados', () => {
    const empenhos = [empenho({}), empenho({ id: 'x', contratoId: 'c2', valor: 999 }), empenho({ id: 'y', exercicio: 2025, valor: 999 })];
    const pagamentos = [fatura({ valorTotal: 50, empenhoIds: ['e1'], status: 'arquivado' })];
    expect(saldoDoExercicio('c1', 2026, empenhos, pagamentos)).toEqual({ empenhado: 1, comprometido: 0, saldo: 1 });
  });

  it('calcula o reforço que falta (0 quando o saldo cobre)', () => {
    expect(reforcoNecessario(5000, 1)).toBe(4999);
    expect(reforcoNecessario(100, 500)).toBe(0);
  });
});

describe('registrarAndamento', () => {
  const agora = '2026-02-01T10:00:00.000Z';

  it('abre o histórico no primeiro setor/etapa informado', () => {
    const historico = registrarAndamento(undefined, { setorAtual: 'GAB', etapa: 'P/ ASS DE NE + OB' }, 'Fulano', agora);
    expect(historico).toEqual([{ setor: 'GAB', etapa: 'P/ ASS DE NE + OB', data: agora, porNome: 'Fulano' }]);
  });

  it('acrescenta uma passagem quando setor ou etapa mudam', () => {
    const anterior = { setorAtual: 'GAB', etapa: 'P/ ASS DE NE + OB', historico: [{ setor: 'GAB', etapa: 'P/ ASS DE NE + OB', data: '2026-01-01', porNome: 'A' }] };
    const historico = registrarAndamento(anterior, { setorAtual: 'CPCI', etapa: 'P/ CONFORMIDADE' }, 'B', agora);
    expect(historico).toHaveLength(2);
    expect(historico[1]).toEqual({ setor: 'CPCI', etapa: 'P/ CONFORMIDADE', data: agora, porNome: 'B' });
  });

  it('não duplica quando nada mudou, nem cria histórico vazio', () => {
    const anterior = { setorAtual: 'GAB', etapa: 'X', historico: [{ setor: 'GAB', etapa: 'X', data: 'd', porNome: 'A' }] };
    expect(registrarAndamento(anterior, { setorAtual: 'GAB', etapa: 'X' }, 'B', agora)).toBe(anterior.historico);
    expect(registrarAndamento(undefined, {}, 'B', agora)).toEqual([]);
  });
});

describe('descreverAndamento', () => {
  it('monta "SETOR - ETAPA" como na planilha de controle', () => {
    expect(descreverAndamento({ setorAtual: 'CPCI', etapa: 'P/ CONFORMIDADE', status: 'em_tramitacao' })).toBe('CPCI - P/ CONFORMIDADE');
  });

  it('sem setor/etapa, cai no status', () => {
    expect(descreverAndamento({ status: 'arquivado' })).toBe('Arquivado');
    expect(descreverAndamento({})).toBe('Pago');
  });
});

describe('totalPagoPorFonte — só o que foi pago', () => {
  it('ignora faturas em tramitação e arquivadas', () => {
    const pagamentos = [
      fatura({ id: '1', valorTotal: 100, status: 'pago' }),
      fatura({ id: '2', valorTotal: 200, status: 'em_tramitacao' }),
      fatura({ id: '3', valorTotal: 400, status: 'arquivado' }),
    ];
    expect(totalPagoPorFonte(pagamentos)).toEqual({ TESOURO: 100 });
  });
});

describe('saldo do contrato só cai com o pagamento', () => {
  const novaNf = { id: 'e1', contratoId: 'c1', valor: 700, saldoFinanceiroAbatido: false };
  const nfAntiga = { id: 'e2', contratoId: 'c1', valor: 300 };

  it('em tramitação ou arquivado não abate nada', () => {
    const base = { valorTotal: 700, documentos: [{ tipo: 'NF' as const, numero: '1', execucaoId: 'e1' }] };
    expect(valorASerAbatido({ ...base, status: 'em_tramitacao' }, [novaNf])).toBe(0);
    expect(valorASerAbatido({ ...base, status: 'arquivado' }, [novaNf])).toBe(0);
  });

  it('pago abate o valor da fatura', () => {
    const p = { status: 'pago' as const, valorTotal: 700, documentos: [{ tipo: 'NF' as const, numero: '1', execucaoId: 'e1' }] };
    expect(valorASerAbatido(p, [novaNf])).toBe(700);
  });

  it('NF antiga (já abatida ao lançar) não é abatida de novo', () => {
    const p = { status: 'pago' as const, valorTotal: 1000, documentos: [
      { tipo: 'NF' as const, numero: '1', execucaoId: 'e1' },
      { tipo: 'NF' as const, numero: '2', execucaoId: 'e2' },
    ] };
    expect(valorASerAbatido(p, [novaNf, nfAntiga])).toBe(700);
  });

  it('valorJaAbatido: usa o gravado; legado sem status não gera ajuste', () => {
    expect(valorJaAbatido({ valorAbatidoSaldo: 500 }, [])).toBe(500);
    expect(valorJaAbatido({ valorPago: 1000 }, [])).toBe(1000);
    expect(valorJaAbatido({ status: 'em_tramitacao', valorTotal: 9 }, [])).toBe(0);
  });

  it('a pagar: NFs novas sem pagamento pago', () => {
    const execs = [novaNf, nfAntiga, { id: 'e3', contratoId: 'c1', valor: 50, saldoFinanceiroAbatido: false }];
    const pagos = [{ status: 'pago' as const, documentos: [{ tipo: 'NF' as const, numero: '1', execucaoId: 'e1' }] }];
    expect(valorAPagarDoContrato('c1', execs, pagos)).toBe(50);
    expect(valorAPagarDoContrato('c1', execs, [])).toBe(750);
  });
});
