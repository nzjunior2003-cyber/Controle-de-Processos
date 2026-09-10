import { describe, expect, it } from 'vitest';
import {
  acharLinhaParaContrato,
  aplicarColunasNaLinhaContrato,
  COLUNA_CONTRATO,
  linhaTemOrdemValida,
  mapLinhaContratoDaPlanilha,
  montarValoresColunasContrato,
  proximoNumeroSequencialContrato,
  TOTAL_COLUNAS_PLANILHA_CONTRATOS,
} from './planilhaContratos';

function linhaVazia(overrides: Record<number, string> = {}): string[] {
  const linha = new Array(TOTAL_COLUNAS_PLANILHA_CONTRATOS).fill('');
  Object.entries(overrides).forEach(([idx, valor]) => {
    linha[Number(idx)] = valor;
  });
  return linha;
}

describe('mapLinhaContratoDaPlanilha', () => {
  it('mapeia os campos a partir dos índices de coluna, separando empresa e CNPJ', () => {
    const linha = linhaVazia({
      [COLUNA_CONTRATO.PAE]: '2025/123456',
      [COLUNA_CONTRATO.N_CONTRATO]: '123/2026',
      [COLUNA_CONTRATO.CONTRATADA]: 'Empresa Exemplo Ltda\n12.345.678/0001-90',
      [COLUNA_CONTRATO.OBJETO]: 'Aquisição de material de expediente',
      [COLUNA_CONTRATO.PRD]: 'PRD-9',
      [COLUNA_CONTRATO.EMPENHO]: '2026NE00123',
      [COLUNA_CONTRATO.VALOR_GLOBAL]: 'R$ 1.500,50',
      [COLUNA_CONTRATO.SALDO]: 'R$ 900,00',
      [COLUNA_CONTRATO.INICIO_VIGENCIA]: '01/01/2026',
      [COLUNA_CONTRATO.FIM_VIGENCIA]: '31/12/2026',
      [COLUNA_CONTRATO.FISCAL_TITULAR]: 'CAP FULANO\n12345/1',
      [COLUNA_CONTRATO.FISCAL_SUPLENTE]: 'TEN BELTRANO\n54321/1',
      [COLUNA_CONTRATO.DEMANDANTE]: 'DTIC',
      [COLUNA_CONTRATO.PCA]: '12',
    });

    expect(mapLinhaContratoDaPlanilha(linha)).toEqual({
      numero: '123/2026',
      empresa: 'Empresa Exemplo Ltda',
      cnpj: '12.345.678/0001-90',
      objeto: 'Aquisição de material de expediente',
      pae: '2025/123456',
      prd: 'PRD-9',
      empenho: '2026NE00123',
      valorGlobal: 1500.5,
      saldoAtualFinanceiro: 900,
      inicioVigencia: new Date(2026, 0, 1).toISOString(),
      fimVigencia: new Date(2026, 11, 31).toISOString(),
      fiscalTitular: 'CAP FULANO\n12345/1',
      fiscalSuplente: 'TEN BELTRANO\n54321/1',
      unidadeDemandante: 'DTIC',
      pcaCodigo: '12',
    });
  });

  it('devolve o texto inteiro como empresa quando não acha um CNPJ reconhecível', () => {
    const linha = linhaVazia({
      [COLUNA_CONTRATO.N_CONTRATO]: '1/2026',
      [COLUNA_CONTRATO.CONTRATADA]: 'Empresa Sem CNPJ Formatado',
      [COLUNA_CONTRATO.OBJETO]: 'Objeto',
    });

    const contrato = mapLinhaContratoDaPlanilha(linha);
    expect(contrato?.empresa).toBe('Empresa Sem CNPJ Formatado');
    expect(contrato?.cnpj).toBeUndefined();
  });

  it('devolve null quando não há N° do Contrato', () => {
    expect(mapLinhaContratoDaPlanilha(linhaVazia())).toBeNull();
  });

  it('devolve undefined nos campos opcionais ausentes', () => {
    const linha = linhaVazia({
      [COLUNA_CONTRATO.N_CONTRATO]: '1/2026',
      [COLUNA_CONTRATO.CONTRATADA]: 'Empresa',
      [COLUNA_CONTRATO.OBJETO]: 'Objeto',
    });

    const contrato = mapLinhaContratoDaPlanilha(linha);
    expect(contrato?.cnpj).toBeUndefined();
    expect(contrato?.pae).toBeUndefined();
    expect(contrato?.prd).toBeUndefined();
    expect(contrato?.valorGlobal).toBeUndefined();
    expect(contrato?.saldoAtualFinanceiro).toBeUndefined();
    expect(contrato?.inicioVigencia).toBeUndefined();
    expect(contrato?.fimVigencia).toBeUndefined();
    expect(contrato?.unidadeDemandante).toBeUndefined();
    expect(contrato?.pcaCodigo).toBeUndefined();
  });
});

describe('montarValoresColunasContrato', () => {
  it('monta os valores das colunas gerenciadas, compondo empresa e CNPJ', () => {
    const valores = montarValoresColunasContrato({
      numero: '123/2026',
      empresa: 'Empresa Exemplo Ltda',
      cnpj: '12.345.678/0001-90',
      objeto: 'Objeto',
      pae: '2025/123456',
      prd: 'PRD-9',
      empenho: '2026NE00123',
      valorGlobal: 1500.5,
      saldoAtualFinanceiro: 900,
      inicioVigencia: new Date(2026, 0, 15).toISOString(),
      fimVigencia: new Date(2026, 11, 31).toISOString(),
      fiscalTitular: 'CAP FULANO',
      fiscalSuplente: 'TEN BELTRANO',
    });

    expect(valores[COLUNA_CONTRATO.CONTRATADA]).toBe('Empresa Exemplo Ltda\n12.345.678/0001-90');
    expect(valores[COLUNA_CONTRATO.N_CONTRATO]).toBe('123/2026');
    expect(valores[COLUNA_CONTRATO.PAE]).toBe('2025/123456');
    expect(valores[COLUNA_CONTRATO.VALOR_GLOBAL]).toBe('R$ 1.500,50');
    expect(valores[COLUNA_CONTRATO.SALDO]).toBe('R$ 900,00');
    expect(valores[COLUNA_CONTRATO.INICIO_VIGENCIA]).toBe('15/01/2026');
    expect(valores[COLUNA_CONTRATO.FIM_VIGENCIA]).toBe('31/12/2026');
    expect(valores[COLUNA_CONTRATO.DEMANDANTE]).toBeUndefined();
    expect(valores[COLUNA_CONTRATO.PCA]).toBeUndefined();
  });

  it('só inclui Demandante/PCA quando informados, pra não apagar o preenchimento manual', () => {
    const valores = montarValoresColunasContrato({
      numero: '1/2026',
      empresa: 'Empresa',
      objeto: 'Objeto',
      unidadeDemandante: 'DTIC',
      pcaCodigo: '12',
    });

    expect(valores[COLUNA_CONTRATO.DEMANDANTE]).toBe('DTIC');
    expect(valores[COLUNA_CONTRATO.PCA]).toBe('12');
  });
});

describe('aplicarColunasNaLinhaContrato', () => {
  it('preserva colunas não gerenciadas ao mesclar', () => {
    const linhaExistente = linhaVazia({
      [COLUNA_CONTRATO.N_CONTRATO]: '1/2026',
      3: '01/01/2026', // DATA_EMISSAO, não gerenciada
      7: 'AGOSTO 2026', // ALERTA, não gerenciada
    });

    const resultado = aplicarColunasNaLinhaContrato(linhaExistente, {
      [COLUNA_CONTRATO.OBJETO]: 'Novo objeto',
    });

    expect(resultado[COLUNA_CONTRATO.N_CONTRATO]).toBe('1/2026');
    expect(resultado[COLUNA_CONTRATO.OBJETO]).toBe('Novo objeto');
    expect(resultado[3]).toBe('01/01/2026');
    expect(resultado[7]).toBe('AGOSTO 2026');
    expect(resultado).toHaveLength(TOTAL_COLUNAS_PLANILHA_CONTRATOS);
  });

  it('funciona para uma linha nova (sem linha existente)', () => {
    const resultado = aplicarColunasNaLinhaContrato(undefined, { [COLUNA_CONTRATO.OBJETO]: 'Objeto' });
    expect(resultado).toHaveLength(TOTAL_COLUNAS_PLANILHA_CONTRATOS);
    expect(resultado[COLUNA_CONTRATO.OBJETO]).toBe('Objeto');
    expect(resultado[0]).toBe('');
  });
});

describe('proximoNumeroSequencialContrato', () => {
  it('soma 1 ao número anterior quando é numérico', () => {
    expect(proximoNumeroSequencialContrato('152')).toBe('153');
  });

  it('recomeça em 1 quando não há número anterior válido', () => {
    expect(proximoNumeroSequencialContrato(undefined)).toBe('1');
    expect(proximoNumeroSequencialContrato('')).toBe('1');
    expect(proximoNumeroSequencialContrato('abc')).toBe('1');
  });
});

describe('acharLinhaParaContrato', () => {
  const colunaNumero = ['N° Contrato', '1/2026', '2/2026', '', '4/2026'];

  it('acha a linha que já tem o mesmo número (atualização)', () => {
    expect(acharLinhaParaContrato(colunaNumero, '2/2026')).toEqual({ linha: 3, ehNova: false });
  });

  it('nunca reaproveita uma célula em branco — sempre acrescenta depois do fim do array', () => {
    // Uma coluna "Nº Contrato" em branco no meio da planilha não é uma
    // linha livre nessa aba (pode já ter PRD/Empenho preenchidos pra um
    // contrato ainda não formalizado), então mesmo havendo uma célula em
    // branco no índice 3, o novo contrato vai pro final do array.
    expect(acharLinhaParaContrato(colunaNumero, '999/2026')).toEqual({ linha: 6, ehNova: true });
  });

  it('usa a linha seguinte à última quando não há nenhuma linha em branco', () => {
    const semBrancos = ['N° Contrato', '1/2026', '2/2026'];
    expect(acharLinhaParaContrato(semBrancos, '999/2026')).toEqual({ linha: 4, ehNova: true });
  });
});

describe('linhaTemOrdemValida', () => {
  it('só considera válida uma linha com número inteiro na coluna Ordem', () => {
    expect(linhaTemOrdemValida('1')).toBe(true);
    expect(linhaTemOrdemValida('152')).toBe(true);
    expect(linhaTemOrdemValida(' 7 ')).toBe(true);
  });

  it('rejeita células em branco, texto de título e valores não inteiros', () => {
    expect(linhaTemOrdemValida('')).toBe(false);
    expect(linhaTemOrdemValida(undefined)).toBe(false);
    expect(linhaTemOrdemValida('Nº')).toBe(false);
    expect(linhaTemOrdemValida('1/2026')).toBe(false);
  });
});
