/**
 * Notificações do fluxo NF/fatura → pagamento: o fiscal lança a NF e o
 * Financeiro é avisado; cada mudança de etapa/situação do pagamento avisa o
 * fiscal do contrato. Lógica pura (quem recebe e o que diz); o envio é do
 * AppContext, como nas notificações de processo.
 */
import type { Contrato, Notificacao, PagamentoContrato, Usuario } from '../types';
import { STATUS_PAGAMENTO_LABELS } from '../types';
import { formatarMoeda, type ExecucaoContrato } from './contratos';
import { descreverAndamento, statusDoPagamento, valorDoPagamento } from './financeiro';

/** Tipos de lançamento que são só comprovante/confirmação — não geram pagamento. */
const TIPOS_SEM_PAGAMENTO = ['Recebimento da NE pelo Fornecedor', 'Recibo de Pagamento'];

/** A execução é uma NF/fatura que precisa ser paga? */
export const execucaoEhCobranca = (execucao: Pick<ExecucaoContrato, 'tipo' | 'valor'>): boolean =>
  !TIPOS_SEM_PAGAMENTO.includes(execucao.tipo ?? '') && (execucao.valor ?? 0) > 0;

/** Equipe do Financeiro (e master) ativa. */
export const destinatariosFinanceiro = (usuarios: Usuario[]): Usuario[] =>
  usuarios.filter((u) => u.ativo && (u.perfil === 'financeiro' || u.perfil === 'master'));

/** Fiscal titular e suplente do contrato (casando pelo e-mail), se tiverem conta ativa. */
export function destinatariosFiscais(
  contrato: Pick<Contrato, 'fiscalEmail' | 'fiscalSuplenteEmail'>,
  usuarios: Usuario[],
): Usuario[] {
  const emails = [contrato.fiscalEmail, contrato.fiscalSuplenteEmail]
    .map((e) => (e ?? '').trim().toLowerCase())
    .filter(Boolean);
  return usuarios.filter((u) => u.ativo && emails.includes(u.email.trim().toLowerCase()));
}

export function montarNotificacaoNfAguardando(
  execucao: Pick<ExecucaoContrato, 'nf' | 'valor' | 'tipo'>,
  contrato: Pick<Contrato, 'id' | 'numero' | 'empresa'>,
  destinatarioId: string,
): Omit<Notificacao, 'id'> {
  return {
    destinatarioId,
    tipo: 'nf_aguardando_pagamento',
    titulo: `${execucao.tipo ?? 'NF/Fatura'} ${execucao.nf} aguardando pagamento — Contrato ${contrato.numero}`,
    corpo: `${contrato.empresa}: ${formatarMoeda(execucao.valor)} lançada pelo fiscal.`,
    url: `/sistema/financeiro?aba=a-pagar`,
    lida: false,
    criado_em: new Date().toISOString(),
  };
}

/** Mudou algo que o fiscal quer saber? (situação, setor ou etapa) */
export function mudouAndamentoPagamento(
  anterior: Pick<PagamentoContrato, 'status' | 'setorAtual' | 'etapa'> | undefined,
  novo: Pick<PagamentoContrato, 'status' | 'setorAtual' | 'etapa'>,
): boolean {
  if (!anterior) return true;
  return (
    statusDoPagamento(anterior) !== statusDoPagamento(novo) ||
    (anterior.setorAtual ?? '') !== (novo.setorAtual ?? '') ||
    (anterior.etapa ?? '') !== (novo.etapa ?? '')
  );
}

export function montarNotificacaoAndamentoPagamento(
  pagamento: Pick<PagamentoContrato, 'status' | 'setorAtual' | 'etapa' | 'documentos' | 'valorTotal' | 'valorPago' | 'paeFatura'>,
  contrato: Pick<Contrato, 'id' | 'numero' | 'empresa'>,
  destinatarioId: string,
): Omit<Notificacao, 'id'> {
  const status = statusDoPagamento(pagamento);
  const documentos = (pagamento.documentos ?? []).map((d) => `${d.tipo} ${d.numero}`).join(', ') || 'fatura';
  const situacao =
    status === 'pago' ? 'PAGO' : status === 'arquivado' ? STATUS_PAGAMENTO_LABELS.arquivado : descreverAndamento(pagamento);
  return {
    destinatarioId,
    tipo: 'pagamento_andamento',
    titulo: `Pagamento de ${documentos} — Contrato ${contrato.numero}: ${situacao}`,
    corpo: `${contrato.empresa}: ${formatarMoeda(valorDoPagamento(pagamento))}${pagamento.paeFatura ? ` (PAE ${pagamento.paeFatura})` : ''}.`,
    url: `/sistema/fiscal-contrato/${contrato.id}/gerenciar`,
    lida: false,
    criado_em: new Date().toISOString(),
  };
}
