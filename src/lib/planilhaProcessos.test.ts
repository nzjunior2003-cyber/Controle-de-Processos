import { describe, expect, it } from 'vitest';
import {
  COLUNA,
  acharLinhaParaProcesso,
  aplicarColunasNaLinha,
  montarValoresColunasProcesso,
  processoParaDadosPlanilha,
  proximoNumeroSequencial,
  SUBFASE_CONTRATADO_ADITIVADO,
  TOTAL_COLUNAS_PLANILHA,
} from './planilhaProcessos';

describe('montarValoresColunasProcesso', () => {
  it('monta os valores das colunas gerenciadas pelo app', () => {
    const valores = montarValoresColunasProcesso({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      descricao: 'Observação qualquer',
      unidade_demandante: 'DTIC',
      natureza_despesa: 'SERVIÇO',
      fonte: 'TESOURO',
      valor_estimado: 1500.5,
      rito_processual: 'PREGÃO ELETRÔNICO',
      andamento: 'Em análise',
      data_entrada: new Date(2026, 0, 15).toISOString(),
      pca_id: 'pca-1',
    });

    expect(valores[COLUNA.N_PAE]).toBe('E-2026/1');
    expect(valores[COLUNA.OBJETO]).toBe('Objeto');
    expect(valores[COLUNA.OBSERVACAO]).toBe('Observação qualquer');
    expect(valores[COLUNA.SETOR_DEMANDANTE]).toBe('DTIC');
    expect(valores[COLUNA.NATUREZA_DESPESA]).toBe('SERVIÇO');
    expect(valores[COLUNA.FONTE]).toBe('TESOURO');
    expect(valores[COLUNA.V_ESTIMADO]).toBe('R$ 1.500,50');
    expect(valores[COLUNA.RITO_PROCESSUAL]).toBe('PREGÃO ELETRÔNICO');
    expect(valores[COLUNA.ANDAMENTO]).toBe('Em análise');
    expect(valores[COLUNA.DATA_ENTRADA]).toBe('15/01/2026');
    expect(valores[COLUNA.ANO_ENTRADA]).toBe('2026');
    expect(valores[COLUNA.PREVISAO_NO_PCA]).toBe('SIM');
  });

  it('marca "NÃO" na previsão do PCA quando não há vínculo', () => {
    const valores = montarValoresColunasProcesso({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      unidade_demandante: 'DTIC',
    });
    expect(valores[COLUNA.PREVISAO_NO_PCA]).toBe('NÃO');
  });

  it('não duplica o prefixo "E-" se já vier com ele', () => {
    const valores = montarValoresColunasProcesso({
      numero_processo: 'E-2026/1',
      objeto: 'Objeto',
      unidade_demandante: 'DTIC',
    });
    expect(valores[COLUNA.N_PAE]).toBe('E-2026/1');
  });

  it('só grava a Subfase (coluna Q) quando informada, pra não apagar o que o RPA já preencheu', () => {
    const semSubfase = montarValoresColunasProcesso({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      unidade_demandante: 'DTIC',
    });
    expect(semSubfase[COLUNA.SUBFASE_PROCESSO]).toBeUndefined();

    const comSubfase = montarValoresColunasProcesso({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      unidade_demandante: 'DTIC',
      subfase_processo: SUBFASE_CONTRATADO_ADITIVADO,
    });
    expect(comSubfase[COLUNA.SUBFASE_PROCESSO]).toBe('CONTRATADO/ADITIVADO');
  });
});

describe('processoParaDadosPlanilha', () => {
  it('monta os dados pra sincronização a partir de um Processo do app', () => {
    const dados = processoParaDadosPlanilha({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      descricao: 'Descrição',
      unidade_demandante: 'DTIC',
      natureza_despesa: 'SERVIÇO',
      fonte: 'TESOURO',
      valor_estimado: 100,
      rito_processual: 'PREGÃO ELETRÔNICO',
      andamento: 'Em análise',
      data_entrada: '2026-01-15T00:00:00.000Z',
      pca_id: 'pca-1',
    });

    expect(dados).toEqual({
      numero_processo: '2026/1',
      objeto: 'Objeto',
      descricao: 'Descrição',
      unidade_demandante: 'DTIC',
      natureza_despesa: 'SERVIÇO',
      fonte: 'TESOURO',
      valor_estimado: 100,
      rito_processual: 'PREGÃO ELETRÔNICO',
      andamento: 'Em análise',
      data_entrada: '2026-01-15T00:00:00.000Z',
      pca_id: 'pca-1',
    });
  });
});

describe('aplicarColunasNaLinha', () => {
  it('preserva colunas não gerenciadas ao mesclar', () => {
    const linhaExistente = new Array(TOTAL_COLUNAS_PLANILHA).fill('');
    linhaExistente[COLUNA.N_PAE] = 'E-2026/1';
    linhaExistente[17] = 'CBM > DTIC > QCG'; // SETOR ATUAL, não gerenciado
    linhaExistente[19] = '27/08/2026'; // ÚLTIMA TRAMITAÇÃO, não gerenciado

    const resultado = aplicarColunasNaLinha(linhaExistente, { [COLUNA.OBJETO]: 'Novo objeto' });

    expect(resultado[COLUNA.N_PAE]).toBe('E-2026/1');
    expect(resultado[COLUNA.OBJETO]).toBe('Novo objeto');
    expect(resultado[17]).toBe('CBM > DTIC > QCG');
    expect(resultado[19]).toBe('27/08/2026');
    expect(resultado).toHaveLength(TOTAL_COLUNAS_PLANILHA);
  });

  it('funciona para uma linha nova (sem linha existente)', () => {
    const resultado = aplicarColunasNaLinha(undefined, { [COLUNA.OBJETO]: 'Objeto' });
    expect(resultado).toHaveLength(TOTAL_COLUNAS_PLANILHA);
    expect(resultado[COLUNA.OBJETO]).toBe('Objeto');
    expect(resultado[0]).toBe('');
  });
});

describe('proximoNumeroSequencial', () => {
  it('soma 1 ao número anterior quando é numérico', () => {
    expect(proximoNumeroSequencial('156')).toBe('157');
  });

  it('recomeça em 1 quando não há número anterior válido', () => {
    expect(proximoNumeroSequencial(undefined)).toBe('1');
    expect(proximoNumeroSequencial('')).toBe('1');
    expect(proximoNumeroSequencial('abc')).toBe('1');
  });
});

describe('acharLinhaParaProcesso', () => {
  const colunaPae = ['N° PAE', 'E-2026/1', 'E-2026/2', '', 'E-2026/4'];

  it('acha a linha que já tem o mesmo número (atualização)', () => {
    expect(acharLinhaParaProcesso(colunaPae, 'E-2026/2')).toEqual({ linha: 3, ehNova: false });
  });

  it('acha a primeira linha em branco quando o número não existe ainda', () => {
    expect(acharLinhaParaProcesso(colunaPae, 'E-2026/999')).toEqual({ linha: 4, ehNova: true });
  });

  it('usa a linha seguinte à última quando não há nenhuma linha em branco', () => {
    const semBrancos = ['N° PAE', 'E-2026/1', 'E-2026/2'];
    expect(acharLinhaParaProcesso(semBrancos, 'E-2026/999')).toEqual({ linha: 4, ehNova: true });
  });
});
