import { describe, expect, it } from 'vitest';
import {
  mapSheetArrayToPca,
  mapSheetRowToPca,
  mapSheetRowToProcesso,
  parseCurrencyBR,
  parseDataBR,
} from './csv';

describe('parseCurrencyBR', () => {
  it('converte valores no formato brasileiro completo', () => {
    expect(parseCurrencyBR('R$ 1.500.000,50')).toBe(1500000.5);
    expect(parseCurrencyBR('1.089.417,12')).toBe(1089417.12);
    expect(parseCurrencyBR('10,00')).toBe(10);
  });

  it('trata o ponto como separador de milhar quando não há decimais', () => {
    expect(parseCurrencyBR('1.500')).toBe(1500);
    expect(parseCurrencyBR('1.500.000')).toBe(1500000);
  });

  it('trata o ponto como separador decimal quando não é grupo de milhar', () => {
    expect(parseCurrencyBR('1500.75')).toBe(1500.75);
    expect(parseCurrencyBR('0.5')).toBe(0.5);
  });

  it('aceita números e valores já limpos', () => {
    expect(parseCurrencyBR(1234.56)).toBe(1234.56);
    expect(parseCurrencyBR('4500')).toBe(4500);
  });

  it('devolve 0 para entradas vazias ou inválidas', () => {
    expect(parseCurrencyBR('')).toBe(0);
    expect(parseCurrencyBR('   ')).toBe(0);
    expect(parseCurrencyBR(null)).toBe(0);
    expect(parseCurrencyBR(undefined)).toBe(0);
    expect(parseCurrencyBR('sem valor')).toBe(0);
    expect(parseCurrencyBR(Number.NaN)).toBe(0);
  });

  it('preserva valores negativos', () => {
    expect(parseCurrencyBR('-R$ 250,00')).toBe(-250);
  });
});

describe('mapSheetRowToPca', () => {
  it('mapeia as colunas da aba GERAL PCA', () => {
    const pca = mapSheetRowToPca(
      {
        ORDEM: '12',
        'DESCRIÇÃO': 'Aquisição de viaturas',
        DEMANDANTE: 'Logística',
        'VALOR DO RECURSO': 'R$ 1.500.000,00',
        ITEM: 'Item 3',
        GRUPO: 'Grupo 1',
        'FONTE DO RECURSO': 'Tesouro Estadual',
      },
      4,
      2026,
    );

    expect(pca).toEqual({
      id: 'pca-sheet-4',
      codigo_pca: '12',
      objeto_pca: 'Aquisição de viaturas',
      exercicio: 2026,
      unidade_responsavel: 'Logística',
      valor_previsto: 1500000,
      item_pca: 'Item 3',
      grupo_pca: 'Grupo 1',
      fonte_recurso: 'Tesouro Estadual',
    });
  });

  it('preenche com string vazia as colunas ausentes', () => {
    const pca = mapSheetRowToPca({}, 0, 2025);
    expect(pca.codigo_pca).toBe('');
    expect(pca.valor_previsto).toBe(0);
    expect(pca.exercicio).toBe(2025);
  });
});

describe('parseDataBR', () => {
  it('converte datas no formato d/m/aaaa para ISO', () => {
    expect(parseDataBR('27/08/2026')).toBe(new Date(2026, 7, 27).toISOString());
    expect(parseDataBR('5/1/2025')).toBe(new Date(2025, 0, 5).toISOString());
  });

  it('devolve undefined para datas incompletas ou vazias', () => {
    expect(parseDataBR('27/08')).toBeUndefined();
    expect(parseDataBR('')).toBeUndefined();
    expect(parseDataBR(undefined)).toBeUndefined();
    expect(parseDataBR('data inválida')).toBeUndefined();
  });
});

describe('mapSheetRowToProcesso', () => {
  const linhaBase = {
    'N° PAE': 'E-2026/2014417',
    OBJETO: ' Prorrogação do contrato ',
    'SETOR DEMANDANTE': 'CSMV/MOP',
    FONTE: 'TESOURO',
    'RITO PROCESSUAL': 'PRORROGAÇÃO',
    'FASE DO PROCESSO': 'INTERNA',
    'SUBFASE DO PROCESSO': 'CONTRATADO',
    'SETOR ATUAL': 'CBM > CSMV/SUBCHEFIA > Complexo do Entroncamento',
    ANDAMENTO: '6º Termo aditivo em vigência',
    'DATA DE ENTRADA ': '01/01/2026',
    'ÚLTIMA TRAMITAÇÃO': '27/08/2026',
  };

  it('mapeia as colunas e remove o prefixo "E-" do número do processo', () => {
    const processo = mapSheetRowToProcesso(linhaBase);
    expect(processo).toEqual({
      numero_processo: '2026/2014417',
      objeto: 'Prorrogação do contrato',
      unidade_demandante: 'CSMV/MOP',
      status: 'concluido',
      fonte: 'TESOURO',
      rito_processual: 'PRORROGAÇÃO',
      fase_processo: 'INTERNA',
      subfase_processo: 'CONTRATADO',
      localizacao_atual: 'CBM > CSMV/SUBCHEFIA > Complexo do Entroncamento',
      andamento: '6º Termo aditivo em vigência',
      data_entrada: new Date(2026, 0, 1).toISOString(),
      ultima_tramitacao: new Date(2026, 7, 27).toISOString(),
    });
  });

  it('tolera espaço extra no nome da coluna (ex.: "DATA DE ENTRADA ")', () => {
    const processo = mapSheetRowToProcesso(linhaBase);
    expect(processo?.data_entrada).toBeDefined();
  });

  it('infere status a partir da subfase', () => {
    expect(mapSheetRowToProcesso({ ...linhaBase, 'SUBFASE DO PROCESSO': 'CANCELADO' })?.status).toBe(
      'arquivado',
    );
    expect(
      mapSheetRowToProcesso({ ...linhaBase, 'SUBFASE DO PROCESSO': '9 FINALIZADO' })?.status,
    ).toBe('concluido');
    expect(
      mapSheetRowToProcesso({ ...linhaBase, 'SUBFASE DO PROCESSO': '1 INSTRUÇÃO' })?.status,
    ).toBe('em_andamento');
  });

  it('devolve null quando não há número de processo', () => {
    expect(mapSheetRowToProcesso({ ...linhaBase, 'N° PAE': '' })).toBeNull();
  });
});

describe('mapSheetArrayToPca', () => {
  it('mapeia linhas posicionais com valores padrão', () => {
    const pca = mapSheetArrayToPca(
      ['001', 'Objeto qualquer', '2027', 'DEM', '2.000,00', 'Item', 'Grupo', 'Fonte'],
      1,
    );

    expect(pca.codigo_pca).toBe('001');
    expect(pca.objeto_pca).toBe('Objeto qualquer');
    expect(pca.exercicio).toBe(2027);
    expect(pca.valor_previsto).toBe(2000);
  });

  it('usa placeholders quando a linha está incompleta', () => {
    const pca = mapSheetArrayToPca([], 7, 2026);
    expect(pca.codigo_pca).toBe('PCA-X-7');
    expect(pca.objeto_pca).toBe('Sem Objeto');
    expect(pca.unidade_responsavel).toBe('Desconhecida');
    expect(pca.exercicio).toBe(2026);
  });
});
