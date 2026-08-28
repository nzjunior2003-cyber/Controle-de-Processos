import { describe, expect, it } from 'vitest';
import {
  buscarContratos,
  calcularStatusContrato,
  filtrarContratosDoFiscal,
} from './contratos';
import type { Contrato } from '../types';

const base: Contrato = {
  id: 'c1',
  pae: '2020/201212',
  numero: '053/2020',
  objeto: 'Locação de veículos',
  empresa: 'LUIZ VIANA TRANSPORTE LTDA',
  valorGlobal: 1000,
  inicioVigencia: '2026-01-01',
  fimVigencia: '2026-12-31',
  fiscalEmail: 'fiscal@cbmpa.gov.br',
  fiscalTitular: '1º TEN QOABM JOELMIR',
};

const hoje = new Date('2026-06-01T00:00:00Z');

describe('calcularStatusContrato', () => {
  it('marca como vigente quando faltam mais de 90 dias', () => {
    const resultado = calcularStatusContrato(base, hoje);
    expect(resultado.status).toBe('VIGENTE');
    expect(resultado.badge).toBe('Vigente');
    expect(resultado.diasRestantes).toBeGreaterThan(90);
  });

  it('marca como atenção quando faltam até 90 dias', () => {
    const resultado = calcularStatusContrato({ ...base, fimVigencia: '2026-08-01' }, hoje);
    expect(resultado.status).toBe('FALTA MENOS DE 90 DIAS');
    expect(resultado.badge).toBe('< 90 Dias');
  });

  it('marca como crítico quando faltam até 30 dias', () => {
    const resultado = calcularStatusContrato({ ...base, fimVigencia: '2026-06-20' }, hoje);
    expect(resultado.status).toBe('FALTA MENOS DE 30 DIAS');
    expect(resultado.badge).toBe('< 30 Dias');
  });

  it('marca como vencido quando a vigência já passou', () => {
    const resultado = calcularStatusContrato({ ...base, fimVigencia: '2026-01-10' }, hoje);
    expect(resultado.status).toBe('VENCIDO');
    expect(resultado.diasRestantes).toBeLessThan(0);
  });

  it('não quebra com data de vigência inválida', () => {
    const resultado = calcularStatusContrato({ ...base, fimVigencia: '' }, hoje);
    expect(resultado.diasRestantes).toBe(0);
    expect(resultado.status).toBe('FALTA MENOS DE 30 DIAS');
  });
});

describe('filtrarContratosDoFiscal', () => {
  const outro: Contrato = {
    ...base,
    id: 'c2',
    fiscalEmail: 'outro@cbmpa.gov.br',
    fiscalTitular: 'MAJ QOBM EMERSON',
  };

  it('devolve apenas os contratos do fiscal (por e-mail)', () => {
    const resultado = filtrarContratosDoFiscal([base, outro], {
      email: 'fiscal@cbmpa.gov.br',
      nome: 'JOELMIR',
    });
    expect(resultado.map((c) => c.id)).toEqual(['c1']);
  });

  it('também encontra pelo nome do fiscal titular', () => {
    const resultado = filtrarContratosDoFiscal([base, outro], {
      email: 'sem-contrato@cbmpa.gov.br',
      nome: 'EMERSON',
    });
    expect(resultado.map((c) => c.id)).toEqual(['c2']);
  });

  it('devolve lista vazia sem usuário', () => {
    expect(filtrarContratosDoFiscal([base, outro], null)).toEqual([]);
  });
});

describe('buscarContratos', () => {
  it('busca por empresa, número, objeto e PAE', () => {
    expect(buscarContratos([base], 'luiz viana')).toHaveLength(1);
    expect(buscarContratos([base], '053/2020')).toHaveLength(1);
    expect(buscarContratos([base], 'veículos')).toHaveLength(1);
    expect(buscarContratos([base], '2020/201212')).toHaveLength(1);
    expect(buscarContratos([base], 'inexistente')).toHaveLength(0);
  });

  it('devolve tudo quando a busca está vazia', () => {
    expect(buscarContratos([base], '   ')).toHaveLength(1);
  });
});
