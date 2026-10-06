import { describe, expect, it } from 'vitest';
import { ehProcedimentoArp, saldoDaArp, valorRegistradoDaArp } from './arp';

describe('ehProcedimentoArp', () => {
  it('reconhece adesão, partícipe, gerenciador e registro de preços', () => {
    expect(ehProcedimentoArp({ modalidade: 'Adesão' })).toBe(true);
    expect(ehProcedimentoArp({ modalidade: 'Partícipe' })).toBe(true);
    expect(ehProcedimentoArp({ modalidade: 'Pregão Eletrônico (Gerenciador)' })).toBe(true);
    expect(ehProcedimentoArp({ modalidade: 'Pregão Eletrônico', registroPrecos: true })).toBe(true);
  });
  it('dispensa e inexigibilidade não são ata', () => {
    expect(ehProcedimentoArp({ modalidade: 'Dispensa' })).toBe(false);
    expect(ehProcedimentoArp({ modalidade: 'Inexigibilidade' })).toBe(false);
  });
});

describe('valorRegistradoDaArp', () => {
  it('usa o valor homologado informado', () => {
    expect(valorRegistradoDaArp({ valorHomologado: 'R$ 100.000,50' })).toBe(100000.5);
  });
  it('sem valor homologado, soma quantidade × valor dos itens', () => {
    expect(
      valorRegistradoDaArp({
        itens: [
          { descricao: 'a', quantidade: '10', valorHomologado: 'R$ 5,00' },
          { descricao: 'b', quantidade: '2', valorHomologado: 'R$ 100,00' },
        ],
      }),
    ).toBe(250);
  });
  it('nada informado: zero', () => {
    expect(valorRegistradoDaArp({})).toBe(0);
  });
});

describe('saldoDaArp', () => {
  const contratos = [
    { id: 'c1', numero: '1/2026', empresa: 'A', valorGlobal: 30000, arpId: 'ata1' },
    { id: 'c2', numero: '2/2026', empresa: 'B', valorGlobal: 5000, arpId: 'ata1' },
    { id: 'c3', numero: '3/2026', empresa: 'C', valorGlobal: 999, arpId: 'outra' },
    { id: 'c4', numero: '4/2026', empresa: 'D', valorGlobal: 1 },
  ];

  it('soma só os contratos vinculados à ata e calcula o saldo', () => {
    const s = saldoDaArp({ id: 'ata1', valorHomologado: 'R$ 100.000,00' }, contratos);
    expect(s.utilizado).toBe(35000);
    expect(s.saldo).toBe(65000);
    expect(s.contratos.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('saldo negativo quando os contratos passam do registrado', () => {
    expect(saldoDaArp({ id: 'ata1', valorHomologado: 'R$ 10.000,00' }, contratos).saldo).toBe(-25000);
  });
});
