/**
 * Regras de vigência de contratos compartilhadas por GestaoContratos e
 * FiscalContrato (antes duplicadas nas duas páginas).
 */
import { differenceInDays } from 'date-fns';
import type { Contrato } from '../types';

export interface ContratoComStatus extends Contrato {
  diasRestantes: number;
  status: 'VIGENTE' | 'FALTA MENOS DE 90 DIAS' | 'FALTA MENOS DE 30 DIAS' | 'VENCIDO';
  cor: string;
  badge: string;
}

export function calcularStatusContrato(
  contrato: Contrato,
  hoje: Date = new Date(),
): ContratoComStatus {
  const dataFim = new Date(contrato.fimVigencia);
  const diasRestantes = Number.isNaN(dataFim.getTime())
    ? 0
    : differenceInDays(dataFim, hoje);

  let status: ContratoComStatus['status'] = 'VIGENTE';
  let cor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  let badge = 'Vigente';

  if (diasRestantes < 0) {
    status = 'VENCIDO';
    cor = 'bg-red-100 text-red-800 border-red-200';
    badge = 'Vencido';
  } else if (diasRestantes <= 30) {
    status = 'FALTA MENOS DE 30 DIAS';
    cor = 'bg-orange-100 text-orange-800 border-orange-200';
    badge = '< 30 Dias';
  } else if (diasRestantes <= 90) {
    status = 'FALTA MENOS DE 90 DIAS';
    cor = 'bg-amber-100 text-amber-800 border-amber-200';
    badge = '< 90 Dias';
  }

  return { ...contrato, diasRestantes, status, cor, badge };
}

/** Restringe a lista aos contratos que um fiscal pode ver. */
export function filtrarContratosDoFiscal<T extends Contrato>(
  contratos: T[],
  usuario: { email: string; nome: string } | null,
): T[] {
  if (!usuario) return [];
  return contratos.filter(
    (c) =>
      c.fiscalEmail === usuario.email ||
      c.fiscalSuplenteEmail === usuario.email ||
      (!!c.fiscalTitular && !!usuario.nome && c.fiscalTitular.includes(usuario.nome)) ||
      (!!c.fiscalSuplente && !!usuario.nome && c.fiscalSuplente.includes(usuario.nome)),
  );
}

/** Busca textual usada nas telas de contratos. */
export function buscarContratos<T extends Contrato>(contratos: T[], busca: string): T[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return contratos;
  return contratos.filter(
    (c) =>
      (c.empresa ?? '').toLowerCase().includes(termo) ||
      (c.numero ?? '').toLowerCase().includes(termo) ||
      (c.objeto ?? '').toLowerCase().includes(termo) ||
      (c.pae ?? '').toLowerCase().includes(termo),
  );
}

/** Lançamento de execução financeira (NF/fatura/recibo) de um contrato. */
export interface ExecucaoContrato {
  id: number;
  contratoId: string;
  tipo?: string;
  nf: string;
  data: string;
  valor: number;
  quantidade?: number;
  observacao?: string;
  arquivoLink?: string | null;
}

/** Ocorrência/notificação registrada sobre um contrato. */
export interface NotificacaoContrato {
  id: number;
  contratoId: string;
  texto: string;
  data: string;
}

export const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0,
  );
