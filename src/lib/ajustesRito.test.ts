import { describe, expect, it } from 'vitest';
import { aplicarAjustesRito, idAjusteRito } from './ajustesRito';

const base = { 'Pregão Eletrônico': ['DFD', 'ETP', 'TR'], Inexigibilidade: ['DFD', 'Parecer'] };

describe('aplicarAjustesRito', () => {
  it('remove itens da lista oficial e acrescenta novos no fim', () => {
    const r = aplicarAjustesRito(base, [{ rito: 'Pregão Eletrônico', remover: ['ETP'], adicionar: ['Aprovação do Comandante'] }]);
    expect(r['Pregão Eletrônico']).toEqual(['DFD', 'TR', 'Aprovação do Comandante']);
    expect(r.Inexigibilidade).toEqual(['DFD', 'Parecer']);
  });

  it('não duplica item já existente e ignora caixa/espaços', () => {
    const r = aplicarAjustesRito(base, [{ rito: 'Pregão Eletrônico', remover: [], adicionar: [' dfd ', 'Novo'] }]);
    expect(r['Pregão Eletrônico']).toEqual(['DFD', 'ETP', 'TR', 'Novo']);
  });

  it('ajuste de rito inexistente é ignorado e a entrada não é alterada', () => {
    const r = aplicarAjustesRito(base, [{ rito: 'Rito que sumiu', remover: [], adicionar: ['x'] }]);
    expect(r).toEqual(base);
    expect(base['Pregão Eletrônico']).toEqual(['DFD', 'ETP', 'TR']);
  });

  it('reconhece o rito por nome alternativo', () => {
    const r = aplicarAjustesRito(
      { 'Pregão Eletrônico p/ Registro de preços': ['A', 'B'] },
      [{ rito: 'Pregão Eletrônico (SRP)', remover: ['A'], adicionar: [] }],
    );
    expect(r['Pregão Eletrônico p/ Registro de preços']).toEqual(['B']);
  });
});

describe('idAjusteRito', () => {
  it('é estável e seguro pro Firestore', () => {
    expect(idAjusteRito('Pregão Eletrônico (SRP)')).toBe(idAjusteRito('Pregão Eletrônico p/ Registro de preços'));
    expect(idAjusteRito('Dispensa por valor (Decreto 2.787, Art. 3º)')).not.toMatch(/[/.()]/);
  });
});
