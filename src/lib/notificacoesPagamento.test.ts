import { describe, expect, it } from 'vitest';
import {
  destinatariosFinanceiro,
  destinatariosFiscais,
  execucaoEhCobranca,
  montarNotificacaoAndamentoPagamento,
  montarNotificacaoNfAguardando,
  mudouAndamentoPagamento,
} from './notificacoesPagamento';
import type { Usuario } from '../types';

const u = (id: string, perfil: Usuario['perfil'], email: string, ativo = true) =>
  ({ id, nome: id, email, perfil, ativo, setor_id: '' }) as Usuario;
const usuarios = [
  u('fin', 'financeiro', 'fin@x.com'),
  u('fin2', 'financeiro', 'fin2@x.com', false),
  u('mas', 'master', 'm@x.com'),
  u('fisc', 'fiscal', 'Fiscal@X.com'),
  u('sup', 'fiscal', 'sup@x.com'),
  u('outro', 'fiscal', 'outro@x.com'),
];
const contrato = { id: 'c1', numero: '529/2026', empresa: 'JDR', fiscalEmail: 'fiscal@x.com', fiscalSuplenteEmail: 'sup@x.com' };

describe('destinatários', () => {
  it('financeiro e master ativos', () => {
    expect(destinatariosFinanceiro(usuarios).map((x) => x.id)).toEqual(['fin', 'mas']);
  });
  it('fiscal titular e suplente, ignorando caixa do e-mail', () => {
    expect(destinatariosFiscais(contrato, usuarios).map((x) => x.id)).toEqual(['fisc', 'sup']);
  });
  it('contrato sem e-mail de fiscal não notifica ninguém', () => {
    expect(destinatariosFiscais({}, usuarios)).toEqual([]);
  });
});

describe('execucaoEhCobranca', () => {
  it('NF/fatura com valor gera pagamento; recibo e recebimento de NE não', () => {
    expect(execucaoEhCobranca({ tipo: 'NF/Fatura', valor: 10 })).toBe(true);
    expect(execucaoEhCobranca({ valor: 10 })).toBe(true);
    expect(execucaoEhCobranca({ tipo: 'Recibo de Pagamento', valor: 10 })).toBe(false);
    expect(execucaoEhCobranca({ tipo: 'NF/Fatura', valor: 0 })).toBe(false);
  });
});

describe('mensagens', () => {
  it('NF aguardando pagamento aponta pra fila do Financeiro', () => {
    const n = montarNotificacaoNfAguardando({ nf: '123', valor: 1000, tipo: 'NF/Fatura' }, contrato, 'fin');
    expect(n.tipo).toBe('nf_aguardando_pagamento');
    expect(n.titulo).toContain('123');
    expect(n.titulo).toContain('529/2026');
    expect(n.url).toContain('a-pagar');
  });

  it('andamento mostra a etapa; pago vira PAGO', () => {
    const base = { documentos: [{ tipo: 'NF' as const, numero: '123' }], valorTotal: 1000 };
    const t = montarNotificacaoAndamentoPagamento({ ...base, status: 'em_tramitacao', setorAtual: 'GAB', etapa: 'P/ ASS DE NE' }, contrato, 'fisc');
    expect(t.titulo).toContain('GAB - P/ ASS DE NE');
    expect(t.url).toBe('/sistema/fiscal-contrato/c1/gerenciar');
    expect(montarNotificacaoAndamentoPagamento({ ...base, status: 'pago' }, contrato, 'fisc').titulo).toContain('PAGO');
  });

  it('detecta mudança de situação, setor ou etapa', () => {
    const a = { status: 'em_tramitacao' as const, setorAtual: 'GAB', etapa: 'X' };
    expect(mudouAndamentoPagamento(a, { ...a })).toBe(false);
    expect(mudouAndamentoPagamento(a, { ...a, etapa: 'Y' })).toBe(true);
    expect(mudouAndamentoPagamento(a, { ...a, status: 'pago' })).toBe(true);
    expect(mudouAndamentoPagamento(undefined, a)).toBe(true);
  });
});
