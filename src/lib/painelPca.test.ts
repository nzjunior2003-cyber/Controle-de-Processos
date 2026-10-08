import { describe, expect, it } from 'vitest';
import {
  FILTROS_PCA_VAZIOS,
  arredondarPara100,
  calcularInsightsPca,
  calcularKpisPca,
  empilhadoPorDemandante,
  empilhadoPorFonte,
  extrairPaes,
  fatiasPizza,
  normalizarPae,
  paesContratados,
  paraItemPca,
  passaFiltrosPca,
  prioridadeDe,
} from './painelPca';
import type { PCA } from '../types';

const pca = (extra: Partial<PCA> = {}): PCA => ({
  id: 'x',
  codigo_pca: '1',
  objeto_pca: 'Item',
  exercicio: 2026,
  unidade_responsavel: 'DAL',
  valor_previsto: 1000,
  item_pca: '',
  grupo_pca: 'G1',
  fonte_recurso: 'TESOURO',
  ...extra,
});

describe('PAE', () => {
  it('extrai PAEs de formatos diferentes e ignora placeholders', () => {
    expect(extrairPaes('E-2026/2432699')).toEqual(['E-2026/2432699']);
    expect(extrairPaes('2026/2741168 e E - 2025/2738090')).toEqual(['E-2026/2741168', 'E-2025/2738090']);
    expect(extrairPaes('2026/XXXXX (em instrução)')).toEqual([]);
    expect(extrairPaes('')).toEqual([]);
    expect(extrairPaes(undefined)).toEqual([]);
  });
  it('normaliza para comparar', () => {
    expect(normalizarPae('E-2026/2432699')).toBe('2026/2432699');
    expect(normalizarPae(' e - 2026/2432699 ')).toBe('2026/2432699');
  });
  it('só conta como contratado processo contratado/aditivado', () => {
    const set = paesContratados([
      { numero_processo: '2026/1', status: 'contratado_aditivado' },
      { numero_processo: '2026/2', status: 'em_andamento', subfase_processo: '9 CONTRATADO' },
      { numero_processo: '2026/3', status: 'em_andamento', subfase_processo: '3 INSTRUÇÃO' },
    ]);
    expect([...set].sort()).toEqual(['2026/1', '2026/2']);
  });
});

describe('prioridade', () => {
  it('ALTA/MÉDIA/BAIXA e o resto', () => {
    expect(prioridadeDe('Alta')).toBe('ALTA');
    expect(prioridadeDe('média')).toBe('MÉDIA');
    expect(prioridadeDe('MEDIA')).toBe('MÉDIA');
    expect(prioridadeDe('baixa')).toBe('BAIXA');
    expect(prioridadeDe('')).toBe('NÃO INFORMADA');
  });
});

describe('paraItemPca', () => {
  const contratados = new Set(['2026/10']);
  it('status: contratado, em andamento (tem PAE) ou aguardando (sem PAE)', () => {
    expect(paraItemPca(pca({ numero_pae: 'E-2026/0000010' }), new Set(['2026/0000010'])).status).toBe('contratado');
    expect(paraItemPca(pca({ numero_pae: 'E-2026/2432699' }), contratados).status).toBe('andamento');
    expect(paraItemPca(pca({ numero_pae: '' }), contratados).status).toBe('aguardando');
  });
  it('valor total = quantidade × unitário; sem isso, o valor do recurso', () => {
    expect(paraItemPca(pca({ quantidade: '10', valor_unitario_estimado: 25.5 }), contratados).valorTotalEstimado).toBe(255);
    expect(paraItemPca(pca({ quantidade: 'conforme demanda', valor_unitario_estimado: 25.5, valor_previsto: 900 }), contratados).valorTotalEstimado).toBe(900);
    expect(paraItemPca(pca({ valor_previsto: 0 }), contratados).valorTotalEstimado).toBeNull();
  });
});

describe('KPIs e agrupamentos', () => {
  const c = new Set<string>();
  const itens = [
    paraItemPca(pca({ id: 'a', unidade_responsavel: 'DAL', numero_pae: 'E-2026/1111111', valor_previsto: 100, fonte_recurso: 'TESOURO' }), c),
    paraItemPca(pca({ id: 'b', unidade_responsavel: 'DAL', numero_pae: '', prioridade: 'ALTA', valor_previsto: 300, fonte_recurso: 'TESOURO' }), c),
    paraItemPca(pca({ id: 'c', unidade_responsavel: 'DTIC', numero_pae: '', prioridade: 'BAIXA', valor_previsto: 50, fonte_recurso: 'FEBOM' }), c),
  ];
  it('KPIs', () => {
    expect(calcularKpisPca(itens)).toMatchObject({ totalItens: 3, itensComPae: 1, itensSemPae: 2, altaPrioridadeSemPae: 1, valorSemPae: 350, valorTotalEstimado: 450, valorRecurso: 450 });
  });
  it('empilhado por demandante (com/sem PAE)', () => {
    expect(empilhadoPorDemandante(itens)).toEqual([
      { demandante: 'DAL', comPae: 1, semPae: 1, total: 2 },
      { demandante: 'DTIC', comPae: 0, semPae: 1, total: 1 },
    ]);
  });
  it('empilhado por fonte usa o valor do recurso e ordena por valor', () => {
    const f = empilhadoPorFonte(itens);
    expect(f[0]).toMatchObject({ fonte: 'TESOURO', total: 400, totalQtd: 2, andamentoValor: 100, aguardandoValor: 300 });
    expect(f[1]).toMatchObject({ fonte: 'FEBOM', total: 50 });
  });
});

describe('pizza', () => {
  it('percentuais arredondados somam exatamente 100', () => {
    const r = arredondarPara100([33.3333, 33.3333, 33.3334]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    expect(arredondarPara100([])).toEqual([]);
  });
  it('% do filtro e % do total geral', () => {
    const itens = [paraItemPca(pca({ numero_pae: 'E-2026/1111111' }), new Set()), paraItemPca(pca({ numero_pae: '' }), new Set())];
    const fatias = fatiasPizza(itens, 10, [
      { chave: 'com', rotulo: 'Com PAE', cor: '#0f0', pertence: (i) => i.temPae },
      { chave: 'sem', rotulo: 'Sem PAE', cor: '#999', pertence: (i) => !i.temPae },
    ]);
    expect(fatias.map((f) => f.pctFiltro)).toEqual([50, 50]);
    expect(fatias[0].pctTotal).toBe(10);
  });
});

describe('filtros', () => {
  const com = paraItemPca(pca({ numero_pae: 'E-2026/1111111', unidade_responsavel: 'DAL' }), new Set());
  const sem = paraItemPca(pca({ numero_pae: '', unidade_responsavel: 'DTIC' }), new Set());
  it('vazio não restringe; demandante e Com/Sem PAE restringem', () => {
    expect(passaFiltrosPca(com, FILTROS_PCA_VAZIOS)).toBe(true);
    expect(passaFiltrosPca(sem, { ...FILTROS_PCA_VAZIOS, demandante: ['DAL'] })).toBe(false);
    expect(passaFiltrosPca(com, { ...FILTROS_PCA_VAZIOS, temPae: ['Sem PAE'] })).toBe(false);
    expect(passaFiltrosPca(sem, { ...FILTROS_PCA_VAZIOS, temPae: ['Sem PAE'] })).toBe(true);
    expect(passaFiltrosPca(sem, { ...FILTROS_PCA_VAZIOS, temPae: ['Com PAE', 'Sem PAE'] })).toBe(true);
  });
  it('filtra por status (rótulo)', () => {
    expect(passaFiltrosPca(sem, { ...FILTROS_PCA_VAZIOS, status: ['Aguardando instrução'] })).toBe(true);
    expect(passaFiltrosPca(com, { ...FILTROS_PCA_VAZIOS, status: ['Aguardando instrução'] })).toBe(false);
  });
});

describe('insights', () => {
  it('alta prioridade sem PAE, execução e maior item sem PAE', () => {
    const itens = [
      paraItemPca(pca({ id: 'a', numero_pae: '', prioridade: 'ALTA', valor_previsto: 9000, objeto_pca: 'Caminhão' }), new Set()),
      paraItemPca(pca({ id: 'b', numero_pae: 'E-2026/1111111', valor_previsto: 1000 }), new Set()),
    ];
    const ids = calcularInsightsPca(itens).map((i) => i.id);
    expect(ids).toContain('alta-prioridade-sem-pae');
    expect(ids).toContain('execucao');
    expect(ids).toContain('maior-item-sem-pae');
    expect(calcularInsightsPca([])).toEqual([]);
  });
});
