import { describe, expect, it } from 'vitest';
import {
  agruparRito,
  calcularInsights,
  calcularKpis,
  contarPorRito,
  derivarStatus,
  paraPainel,
  parseCaminhoSetor,
  rotuloSetorAtual,
  rotuloSubfase,
  somarEstimadoPorNatureza,
} from './painelProcessos';
import type { Processo } from '../types';

const HOJE = new Date('2026-10-08T12:00:00-03:00');
const dias = (n: number) => new Date(HOJE.getTime() - n * 86400000).toISOString();

const proc = (extra: Partial<Processo> = {}): Processo =>
  ({
    id: 'p1',
    numero_processo: '2026/1',
    objeto: 'Objeto',
    unidade_demandante: 'DAL',
    status: 'em_andamento',
    fase_atual_id: '1',
    possui_alerta: false,
    data_abertura: dias(100),
    data_entrada: dias(100),
    ultima_tramitacao: dias(5),
    localizacao_atual: 'CBM > DAL-OBRAS > Quartel do Comando Geral',
    criado_em: '',
    atualizado_em: '',
    ...extra,
  }) as Processo;

describe('textos da planilha', () => {
  it('caminho do setor e rótulo curto', () => {
    expect(parseCaminhoSetor('CBM > DAL-OBRAS > Quartel')).toEqual(['CBM', 'DAL-OBRAS', 'Quartel']);
    expect(rotuloSetorAtual(['CBM', 'DAL-OBRAS', 'Quartel'])).toBe('DAL-OBRAS');
    expect(rotuloSetorAtual(['CBM'])).toBe('CBM');
    expect(rotuloSetorAtual([])).toBe('');
  });
  it('subfase tira o número da etapa', () => {
    expect(rotuloSubfase('8 PAGAMENTO')).toBe('PAGAMENTO');
    expect(rotuloSubfase('CONTRATADO')).toBe('CONTRATADO');
    expect(rotuloSubfase('')).toBe('');
  });
});

describe('agruparRito', () => {
  it('junta dispensas, aditivos e inexigibilidades (nomes novos e grafias antigas)', () => {
    expect(agruparRito('Dispensa por valor (Decreto 2.787)')).toBe('DISPENSA');
    expect(agruparRito('DISPENSA POR VALOR IRRISÓRIO')).toBe('DISPENSA');
    expect(agruparRito('Prorrogação de contrato')).toBe('ADITIVOS');
    expect(agruparRito('ACRÉSCIMO E PRORROGAÇÃO')).toBe('ADITIVOS');
    expect(agruparRito('REAJUSTE')).toBe('ADITIVOS');
    expect(agruparRito('Inexigibilidade p/ Cursos')).toBe('INEXIGIBILIDADE');
  });
  it('os demais ficam como estão; vazio fica vazio', () => {
    expect(agruparRito('Pregão Eletrônico')).toBe('Pregão Eletrônico');
    expect(agruparRito('')).toBe('');
    expect(agruparRito(undefined)).toBe('');
  });
});

describe('derivarStatus', () => {
  const base = { andamento: '', status: 'em_andamento' as const, subfase_processo: '' };
  it('finalizado, arquivado e contratado têm prioridade sobre os dias parado', () => {
    expect(derivarStatus({ ...base, andamento: 'Finalizado' }, 90)).toBe('finalizado');
    expect(derivarStatus({ ...base, status: 'concluido' }, 90)).toBe('finalizado');
    expect(derivarStatus({ ...base, andamento: 'ARQUIVADO' }, 90)).toBe('arquivado');
    expect(derivarStatus({ ...base, status: 'arquivado' }, 90)).toBe('arquivado');
    expect(derivarStatus({ ...base, subfase_processo: '9 CONTRATADO' }, 90)).toBe('contratado');
    expect(derivarStatus({ ...base, status: 'contratado_aditivado' }, 90)).toBe('contratado');
  });
  it('faixas de dias: >30 atrasado, 15–30 atenção, resto em andamento', () => {
    expect(derivarStatus(base, 31)).toBe('atrasado');
    expect(derivarStatus(base, 30)).toBe('atencao');
    expect(derivarStatus(base, 15)).toBe('atencao');
    expect(derivarStatus(base, 14)).toBe('andamento');
    expect(derivarStatus(base, null)).toBe('andamento');
  });
});

describe('paraPainel', () => {
  it('calcula dias no setor, tempo total e setor atual', () => {
    const p = paraPainel(proc(), 40, HOJE);
    expect(p.diasNoSetor).toBe(5);
    expect(p.tempoTotalDias).toBe(100);
    expect(p.setorAtual).toBe('DAL-OBRAS');
    expect(p.progresso).toBe(40);
    expect(p.status).toBe('andamento');
    expect(p.ativo).toBe(true);
  });
  it('sem datas não quebra e não é "atrasado"', () => {
    const p = paraPainel(proc({ ultima_tramitacao: undefined, data_entrada: undefined }), null, HOJE);
    expect(p.diasNoSetor).toBeNull();
    expect(p.tempoTotalDias).toBeNull();
    expect(p.status).toBe('andamento');
  });
  it('previsão no PCA: a da planilha, ou SIM quando há item do PCA vinculado', () => {
    expect(paraPainel(proc({ previsao_pca: 'SIM' }), null, HOJE).previsaoPca).toBe('SIM');
    expect(paraPainel(proc({ previsao_pca: 'NÃO' }), null, HOJE).previsaoPca).toBe('NÃO');
    expect(paraPainel(proc({ previsao_pca: 'NÃO', pca_id: 'x' }), null, HOJE).previsaoPca).toBe('SIM');
    expect(paraPainel(proc(), null, HOJE).previsaoPca).toBe('');
  });
  it('valor estimado zero vira "sem valor"', () => {
    expect(paraPainel(proc({ valor_estimado: 0 }), null, HOJE).vEstimado).toBeNull();
    expect(paraPainel(proc({ valor_estimado: 1500 }), null, HOJE).vEstimado).toBe(1500);
  });
});

describe('KPIs, agrupamentos e insights', () => {
  const lista = [
    paraPainel(proc({ id: 'a', ultima_tramitacao: dias(40), valor_estimado: 1000, previsao_pca: 'NÃO', rito_processual: 'Pregão Eletrônico' }), 10, HOJE),
    paraPainel(proc({ id: 'b', ultima_tramitacao: dias(50), valor_estimado: 3000, previsao_pca: 'SIM', rito_processual: 'Pregão Eletrônico' }), 10, HOJE),
    paraPainel(proc({ id: 'c', ultima_tramitacao: dias(2), previsao_pca: 'SIM', rito_processual: 'DISPENSA' }), 10, HOJE),
    paraPainel(proc({ id: 'd', status: 'contratado_aditivado', valor_estimado: 500 }), 10, HOJE),
    paraPainel(proc({ id: 'e', andamento: 'FINALIZADO' }), 10, HOJE),
    paraPainel(proc({ id: 'f', status: 'arquivado' }), 10, HOJE),
  ];

  it('KPIs contam só ativos onde faz sentido', () => {
    const k = calcularKpis(lista);
    expect(k).toMatchObject({
      total: 6,
      ativos: 4,
      finalizados: 1,
      arquivados: 1,
      parados30: 2,
      somaEstimadoAtivos: 4500,
      contratadosAditivados: 1,
      semPrevisaoPca: 1,
      previstosPca: 2,
    });
  });

  it('agrupa por rito com "(não informado)" por último', () => {
    const itens = contarPorRito([...lista, paraPainel(proc({ id: 'g', rito_processual: '' }), null, HOJE)]);
    expect(itens[0].label).toBe('Pregão Eletrônico');
    expect(itens[itens.length - 1].label).toBe('(não informado)');
  });

  it('soma o estimado por natureza', () => {
    const itens = somarEstimadoPorNatureza([
      paraPainel(proc({ natureza_despesa: 'SERVIÇO', valor_estimado: 100 }), null, HOJE),
      paraPainel(proc({ natureza_despesa: 'SERVIÇO', valor_estimado: 50 }), null, HOJE),
      paraPainel(proc({ natureza_despesa: 'CONSUMO', valor_estimado: 70 }), null, HOJE),
    ]);
    expect(itens).toEqual([
      { label: 'SERVIÇO', value: 150 },
      { label: 'CONSUMO', value: 70 },
    ]);
  });

  it('insights: setor com atrasados, mais antigo parado, valor atrasado e sem PCA', () => {
    const ids = calcularInsights(lista).map((i) => i.id);
    expect(ids).toContain('setor-atrasados');
    expect(ids).toContain('mais-antigo-parado');
    expect(ids).toContain('valor-atrasado');
    expect(ids).toContain('sem-previsao-pca');
    expect(calcularInsights([])).toEqual([]);
  });
});
