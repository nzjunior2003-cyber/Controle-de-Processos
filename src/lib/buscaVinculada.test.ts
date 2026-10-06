import { describe, expect, it } from 'vitest';
import { casaBusca, criarBuscaVinculada } from './buscaVinculada';

const processos = [
  { numero_processo: '2026/100', objeto: 'Aquisição de uniformes', unidade_demandante: 'DAL', rito_processual: 'Pregão Eletrônico' },
  { numero_processo: '2026/200', objeto: 'Reforma de quartel', unidade_demandante: 'CSMV' },
];
const contratos = [
  { id: 'c1', pae: '2026/100', numero: '529/2026', empresa: 'J.D.R. DOS SANTOS LTDA', objeto: 'Uniformes PEV', fiscalTitular: 'Cap Silva' },
  { id: 'c2', pae: '2026/999', numero: '10/2026', empresa: 'Outra Empresa', objeto: 'Serviço', arpId: 'ata1' },
];
const procedimentos = [
  { id: 'ata1', pae: '2026/555', numero: '07/2026', modalidade: 'Adesão', objeto: 'Ata de limpeza', fornecedor: 'Limpa Tudo SA' },
];
const busca = criarBuscaVinculada({ processos, contratos, procedimentos });

describe('casaBusca', () => {
  it('ignora acento e caixa e exige todos os termos', () => {
    expect(casaBusca('pregao eletronico | dal', 'PREGÃO dal')).toBe(true);
    expect(casaBusca('pregao eletronico | dal', 'pregão csmv')).toBe(false);
  });
});

describe('criarBuscaVinculada', () => {
  it('achar o processo pelo fornecedor/nº do contrato dele', () => {
    expect(busca.processos(processos, 'j.d.r.')).toEqual([processos[0]]);
    expect(busca.processos(processos, '529/2026')).toEqual([processos[0]]);
    expect(busca.processos(processos, 'cap silva')).toEqual([processos[0]]);
  });

  it('achar o contrato pelo processo (nº, objeto, demandante, rito)', () => {
    expect(busca.contratos(contratos, 'DAL pregão')).toEqual([contratos[0]]);
    expect(busca.contratos(contratos, 'aquisição de uniformes')).toEqual([contratos[0]]);
  });

  it('achar o contrato pela ata de origem e a ata pelos contratos derivados', () => {
    expect(busca.contratos(contratos, 'limpa tudo')).toEqual([contratos[1]]);
    expect(busca.procedimentos(procedimentos, 'outra empresa')).toEqual([procedimentos[0]]);
  });

  it('busca vazia devolve tudo; termo que não existe, nada', () => {
    expect(busca.contratos(contratos, '  ')).toEqual(contratos);
    expect(busca.contratos(contratos, 'zzz')).toEqual([]);
  });
});
