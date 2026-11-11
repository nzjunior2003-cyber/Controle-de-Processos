import { describe, expect, it } from 'vitest';
import type { ArpUtilizada } from '../types';
import { ehProcedimentoArp, itensDaArp, saldoDaArp, valorRegistradoDaArp, valorUtilizadoNaArp } from './arp';

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

describe('processos que utilizam a ata (rito Gerenciador)', () => {
  const ataComItens = {
    id: 'ata1',
    valorHomologado: '',
    itens: [
      { descricao: 'Luva', quantidade: '100', valorHomologado: 'R$ 10,00' },
      { descricao: 'Bota', quantidade: '50', valorHomologado: 'R$ 200,00' },
    ],
  };
  const processo = (id: string, pae: string, arpUtilizada: ArpUtilizada | null, objeto = 'obj') => ({ id, numero_processo: pae, objeto, arpUtilizada });

  it('ata com itens: o valor do processo é quantidade × valor unitário e o saldo por item diminui', () => {
    const p = processo('p1', '2026/1', {
      arpId: 'ata1',
      itens: [
        { idx: 0, descricao: 'Luva', quantidade: 30, valorUnitario: 10 },
        { idx: 1, descricao: 'Bota', quantidade: 5, valorUnitario: 200 },
      ],
    });
    const s = saldoDaArp(ataComItens, [], [p]);
    expect(s.registrado).toBe(11000);
    expect(s.utilizado).toBe(1300);
    expect(s.saldo).toBe(9700);
    expect(s.itens.map((i) => [i.descricao, i.utilizada, i.saldo])).toEqual([['Luva', 30, 70], ['Bota', 5, 45]]);
    expect(valorUtilizadoNaArp(p.arpUtilizada as ArpUtilizada)).toBe(1300);
  });

  it('item localizado pela descrição quando a posição mudou na ata', () => {
    const p = processo('p1', '2026/1', { arpId: 'ata1', itens: [{ idx: 9, descricao: 'bota', quantidade: 2, valorUnitario: 200 }] });
    expect(saldoDaArp(ataComItens, [], [p]).itens[1].utilizada).toBe(2);
  });

  it('ata de serviço (só valor total): o processo informa o valor', () => {
    const p = processo('p1', '2026/2', { arpId: 'ata2', valor: 40000 });
    const s = saldoDaArp({ id: 'ata2', valorHomologado: 'R$ 100.000,00' }, [], [p]);
    expect(s.itens).toEqual([]);
    expect(s.utilizado).toBe(40000);
    expect(s.saldo).toBe(60000);
  });

  it('ignora processos de outra ata ou sem uso da ata', () => {
    const s = saldoDaArp({ id: 'ata2', valorHomologado: 'R$ 100.000,00' }, [], [
      processo('a', '2026/3', { arpId: 'outra', valor: 1 }),
      processo('b', '2026/4', null),
    ]);
    expect(s.utilizado).toBe(0);
    expect(s.processos).toEqual([]);
  });

  it('o contrato do processo, ligado à ata, substitui o processo no saldo (sem contar duas vezes) e aponta divergência de valor', () => {
    const p = processo('p1', 'E-2026/5', { arpId: 'ata2', valor: 40000 });
    const contratos = [{ id: 'c1', numero: '9/2026', empresa: 'X', valorGlobal: 42000, arpId: 'ata2', pae: '2026/5' }];
    const s = saldoDaArp({ id: 'ata2', valorHomologado: 'R$ 100.000,00' }, contratos, [p]);
    expect(s.utilizado).toBe(42000);
    expect(s.processos[0].contrato?.numero).toBe('9/2026');
    expect(s.processos[0].divergencia).toBe(2000);
  });

  it('contrato com o mesmo valor do processo não tem divergência; contrato sem vínculo com a ata não substitui o processo', () => {
    const p = processo('p1', '2026/5', { arpId: 'ata2', valor: 40000 });
    const igual = saldoDaArp({ id: 'ata2', valorHomologado: 'R$ 100.000,00' }, [{ id: 'c1', numero: '9/2026', empresa: 'X', valorGlobal: 40000, arpId: 'ata2', pae: '2026/5' }], [p]);
    expect(igual.processos[0].divergencia).toBeUndefined();
    const semVinculo = saldoDaArp({ id: 'ata2', valorHomologado: 'R$ 100.000,00' }, [{ id: 'c1', numero: '9/2026', empresa: 'X', valorGlobal: 40000, pae: '2026/5' }], [p]);
    expect(semVinculo.utilizado).toBe(40000);
    expect(semVinculo.processos[0].contrato?.vinculadoAAta).toBe(false);
  });

  it('itensDaArp lê quantidade e valor unitário e ignora linhas sem descrição', () => {
    expect(itensDaArp({ itens: [{ descricao: ' ', quantidade: '1', valorHomologado: '' }, { descricao: 'A', quantidade: '2,5', valorHomologado: 'R$ 4,00' }] })).toEqual([
      { idx: 1, descricao: 'A', quantidade: 2.5, valorUnitario: 4 },
    ]);
  });
});
