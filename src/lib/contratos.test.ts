import { describe, expect, it } from 'vitest';
import {
  abaterSaldo,
  aplicarAditivoFinanceiro,
  buscarContratos,
  calcularStatusContrato,
  devolverSaldo,
  extrairAnoNumeroContrato,
  filtrarContratosDoFiscal,
  filtrarContratosPorGestor,
  gestorRaizDe,
  marcoAlertaVencimento,
  ordenarContratosPorNumero,
  validarLimiteFiscal,
} from './contratos';
import type { Contrato } from '../types';

const base: Contrato = {
  id: 'c1',
  pae: '2020/201212',
  numero: '053/2020',
  objeto: 'Locação de veículos',
  empresa: 'LUIZ VIANA TRANSPORTE LTDA',
  valorGlobal: 1000,
  saldoInicialFinanceiro: 1000,
  saldoAtualFinanceiro: 1000,
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

  it('marca como concluído quando sinalizado manualmente, mesmo vencido ou vigente', () => {
    const vencido = calcularStatusContrato({ ...base, fimVigencia: '2026-01-10', concluido: true }, hoje);
    expect(vencido.status).toBe('CONCLUÍDO');
    expect(vencido.badge).toBe('Concluído');

    const vigente = calcularStatusContrato({ ...base, concluido: true }, hoje);
    expect(vigente.status).toBe('CONCLUÍDO');
  });
});

describe('marcoAlertaVencimento', () => {
  it('cai no marco mais apertado que o contrato já alcançou', () => {
    expect(marcoAlertaVencimento(180)).toBe(180);
    expect(marcoAlertaVencimento(150)).toBe(180);
    expect(marcoAlertaVencimento(90)).toBe(90);
    expect(marcoAlertaVencimento(75)).toBe(90);
    expect(marcoAlertaVencimento(60)).toBe(60);
    expect(marcoAlertaVencimento(45)).toBe(60);
    expect(marcoAlertaVencimento(30)).toBe(30);
    expect(marcoAlertaVencimento(0)).toBe(30);
  });

  it('devolve null pra mais de 180 dias ou já vencido', () => {
    expect(marcoAlertaVencimento(181)).toBeNull();
    expect(marcoAlertaVencimento(-1)).toBeNull();
  });
});

describe('extrairAnoNumeroContrato', () => {
  it('extrai número e ano de um "nnn/aaaa" simples', () => {
    expect(extrairAnoNumeroContrato('053/2020')).toEqual({ numero: 53, ano: 2020 });
  });

  it('usa a última ocorrência "nnn/aaaa" em textos com mais contexto', () => {
    expect(extrairAnoNumeroContrato('4º Termo Aditivo ao Contrato 021/2022/CBMPA')).toEqual({
      numero: 21,
      ano: 2022,
    });
  });

  it('devolve null quando não encontra nenhum padrão "nnn/aaaa"', () => {
    expect(extrairAnoNumeroContrato('Contrato sem número')).toBeNull();
  });
});

describe('ordenarContratosPorNumero', () => {
  const contratos: Contrato[] = [
    { ...base, id: 'a', numero: '010/2025' },
    { ...base, id: 'b', numero: '005/2024' },
    { ...base, id: 'c', numero: '020/2025' },
    { ...base, id: 'd', numero: 'sem número reconhecível' },
  ];

  it('ordena crescente por ano e depois por número', () => {
    const resultado = ordenarContratosPorNumero(contratos, 'asc');
    expect(resultado.map((c) => c.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('ordena decrescente por ano e depois por número', () => {
    const resultado = ordenarContratosPorNumero(contratos, 'desc');
    expect(resultado.map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('não muta o array original', () => {
    const copia = [...contratos];
    ordenarContratosPorNumero(contratos, 'asc');
    expect(contratos).toEqual(copia);
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

describe('abaterSaldo', () => {
  it('subtrai o valor da execução do saldo financeiro atual', () => {
    const resultado = abaterSaldo({ saldoAtualFinanceiro: 1000 }, { valor: 300 });
    expect(resultado.saldoAtualFinanceiro).toBe(700);
    expect(resultado.saldoAtualQuantitativo).toBeUndefined();
  });

  it('também abate a quantidade quando o contrato controla saldo quantitativo', () => {
    const resultado = abaterSaldo(
      { saldoAtualFinanceiro: 1000, saldoAtualQuantitativo: 50 },
      { valor: 300, quantidade: 10 },
    );
    expect(resultado.saldoAtualFinanceiro).toBe(700);
    expect(resultado.saldoAtualQuantitativo).toBe(40);
  });

  it('permite saldo negativo (a chamada decide se isso é um problema)', () => {
    const resultado = abaterSaldo({ saldoAtualFinanceiro: 100 }, { valor: 300 });
    expect(resultado.saldoAtualFinanceiro).toBe(-200);
  });
});

describe('devolverSaldo', () => {
  it('devolve o valor da execução removida ao saldo financeiro atual', () => {
    const resultado = devolverSaldo({ saldoAtualFinanceiro: 700 }, { valor: 300 });
    expect(resultado.saldoAtualFinanceiro).toBe(1000);
  });

  it('também devolve a quantidade quando o contrato controla saldo quantitativo', () => {
    const resultado = devolverSaldo(
      { saldoAtualFinanceiro: 700, saldoAtualQuantitativo: 40 },
      { valor: 300, quantidade: 10 },
    );
    expect(resultado.saldoAtualFinanceiro).toBe(1000);
    expect(resultado.saldoAtualQuantitativo).toBe(50);
  });

  it('abater seguido de devolver volta ao saldo original', () => {
    const original = { saldoAtualFinanceiro: 1000, saldoAtualQuantitativo: 50 };
    const execucao = { valor: 250, quantidade: 5 };
    const depoisDeAbater = abaterSaldo(original, execucao);
    const depoisDeDevolver = devolverSaldo(depoisDeAbater, execucao);
    expect(depoisDeDevolver).toEqual(original);
  });
});

describe('validarLimiteFiscal', () => {
  const fiscalEmail = 'fiscal@cbmpa.gov.br';

  const contratoAtivo = (id: string): Contrato => ({
    ...base,
    id,
    fiscalEmail,
    fimVigencia: '2099-12-31',
  });

  const contratoVencido = (id: string): Contrato => ({
    ...base,
    id,
    fiscalEmail,
    fimVigencia: '2000-01-01',
  });

  it('permite quando o fiscal tem menos de 3 contratos ativos', () => {
    const contratos = [contratoAtivo('c1'), contratoAtivo('c2')];
    const resultado = validarLimiteFiscal(contratos, fiscalEmail);
    expect(resultado.valido).toBe(true);
    expect(resultado.contratosAtivos).toBe(2);
  });

  it('bloqueia o 4º contrato quando o fiscal já tem 3 ativos', () => {
    const contratos = [contratoAtivo('c1'), contratoAtivo('c2'), contratoAtivo('c3')];
    const resultado = validarLimiteFiscal(contratos, fiscalEmail);
    expect(resultado.valido).toBe(false);
    expect(resultado.contratosAtivos).toBe(3);
  });

  it('não conta contratos vencidos', () => {
    const contratos = [
      contratoAtivo('c1'),
      contratoAtivo('c2'),
      contratoVencido('c3'),
      contratoVencido('c4'),
    ];
    const resultado = validarLimiteFiscal(contratos, fiscalEmail);
    expect(resultado.valido).toBe(true);
    expect(resultado.contratosAtivos).toBe(2);
  });

  it('não conta o próprio contrato sendo editado', () => {
    const contratos = [contratoAtivo('c1'), contratoAtivo('c2'), contratoAtivo('c3')];
    const resultado = validarLimiteFiscal(contratos, fiscalEmail, 'c3');
    expect(resultado.valido).toBe(true);
    expect(resultado.contratosAtivos).toBe(2);
  });

  it('ignora contratos de outros fiscais', () => {
    const contratos = [
      contratoAtivo('c1'),
      { ...contratoAtivo('c2'), fiscalEmail: 'outro@cbmpa.gov.br' },
      { ...contratoAtivo('c3'), fiscalEmail: 'outro@cbmpa.gov.br' },
    ];
    const resultado = validarLimiteFiscal(contratos, fiscalEmail);
    expect(resultado.valido).toBe(true);
    expect(resultado.contratosAtivos).toBe(1);
  });
});

describe('gestorRaizDe', () => {
  it('devolve o próprio id quando o usuário é Gestor raiz (sem gestorResponsavelId)', () => {
    expect(gestorRaizDe({ id: 'g1' })).toBe('g1');
  });

  it('devolve o gestorResponsavelId quando o usuário é Auxiliar', () => {
    expect(gestorRaizDe({ id: 'aux1', gestorResponsavelId: 'g1' })).toBe('g1');
  });

  it('devolve undefined sem usuário', () => {
    expect(gestorRaizDe(null)).toBeUndefined();
  });
});

describe('filtrarContratosPorGestor', () => {
  const doGestor1 = { ...base, id: 'c1', gestorGeralId: 'g1' };
  const doGestor2 = { ...base, id: 'c2', gestorGeralId: 'g2' };
  const semGestor = { ...base, id: 'c3', gestorGeralId: undefined };
  const contratos = [doGestor1, doGestor2, semGestor];

  it('um Gestor raiz (sem gestorResponsavelId) vê todos os contratos', () => {
    const resultado = filtrarContratosPorGestor(contratos, {});
    expect(resultado).toEqual(contratos);
  });

  it('um Auxiliar vê os contratos do seu Gestor responsável e os ainda sem gestor atribuído', () => {
    const resultado = filtrarContratosPorGestor(contratos, { gestorResponsavelId: 'g1' });
    expect(resultado.map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('um Auxiliar não vê contratos já atribuídos a outro Gestor', () => {
    const resultado = filtrarContratosPorGestor(contratos, { gestorResponsavelId: 'g1' });
    expect(resultado.map((c) => c.id)).not.toContain('c2');
  });

  it('devolve todos os contratos sem usuário (nada para restringir)', () => {
    expect(filtrarContratosPorGestor(contratos, null)).toEqual(contratos);
  });
});

describe('aplicarAditivoFinanceiro', () => {
  it('soma o valor acrescido ao valor global, saldo inicial e saldo atual', () => {
    const resultado = aplicarAditivoFinanceiro(
      { valorGlobal: 1000, saldoInicialFinanceiro: 1000, saldoAtualFinanceiro: 400 },
      500,
    );
    expect(resultado).toEqual({
      valorGlobal: 1500,
      saldoInicialFinanceiro: 1500,
      saldoAtualFinanceiro: 900,
    });
  });

  it('preserva o quanto já havia sido executado (diferença global - atual)', () => {
    const antes = { valorGlobal: 1000, saldoInicialFinanceiro: 1000, saldoAtualFinanceiro: 300 };
    const executado = antes.valorGlobal - antes.saldoAtualFinanceiro;
    const depois = aplicarAditivoFinanceiro(antes, 200);
    expect(depois.valorGlobal - depois.saldoAtualFinanceiro).toBe(executado);
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
