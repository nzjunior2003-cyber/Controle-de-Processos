import { describe, expect, it } from 'vitest';
import { COLUNA_CONTRATO, mapLinhaContratoDaPlanilha } from './planilhaContratos';

function linhaVazia(overrides: Record<number, string> = {}): string[] {
  const linha = new Array(27).fill('');
  Object.entries(overrides).forEach(([idx, valor]) => {
    linha[Number(idx)] = valor;
  });
  return linha;
}

describe('mapLinhaContratoDaPlanilha', () => {
  it('mapeia os campos que o app gerencia a partir dos índices de coluna', () => {
    const linha = linhaVazia({
      [COLUNA_CONTRATO.N_CONTRATO]: '123/2026',
      [COLUNA_CONTRATO.EMPRESA]: 'Empresa Exemplo Ltda',
      [COLUNA_CONTRATO.OBJETO]: 'Aquisição de material de expediente',
      [COLUNA_CONTRATO.CNPJ]: '12.345.678/0001-90',
      [COLUNA_CONTRATO.PRD]: 'PRD-9',
      [COLUNA_CONTRATO.VALOR_PRD]: 'R$ 1.500,50',
      [COLUNA_CONTRATO.N_EMPENHO]: '2026NE00123',
      [COLUNA_CONTRATO.INICIO_VIGENCIA]: '01/01/2026',
      [COLUNA_CONTRATO.TERMINO_VIGENCIA]: '31/12/2026',
    });

    expect(mapLinhaContratoDaPlanilha(linha)).toEqual({
      numero: '123/2026',
      empresa: 'Empresa Exemplo Ltda',
      objeto: 'Aquisição de material de expediente',
      cnpj: '12.345.678/0001-90',
      prd: 'PRD-9',
      valorPRD: 1500.5,
      empenho: '2026NE00123',
      inicioVigencia: new Date(2026, 0, 1).toISOString(),
      fimVigencia: new Date(2026, 11, 31).toISOString(),
    });
  });

  it('devolve null quando não há N° do Contrato', () => {
    expect(mapLinhaContratoDaPlanilha(linhaVazia())).toBeNull();
  });

  it('devolve undefined nos campos opcionais ausentes', () => {
    const linha = linhaVazia({
      [COLUNA_CONTRATO.N_CONTRATO]: '1/2026',
      [COLUNA_CONTRATO.EMPRESA]: 'Empresa',
      [COLUNA_CONTRATO.OBJETO]: 'Objeto',
    });

    const contrato = mapLinhaContratoDaPlanilha(linha);
    expect(contrato?.cnpj).toBeUndefined();
    expect(contrato?.prd).toBeUndefined();
    expect(contrato?.valorPRD).toBeUndefined();
    expect(contrato?.empenho).toBeUndefined();
    expect(contrato?.inicioVigencia).toBeUndefined();
    expect(contrato?.fimVigencia).toBeUndefined();
  });
});
