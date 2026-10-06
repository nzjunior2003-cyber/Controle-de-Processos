/**
 * ARPs e atas (adesão, gerenciadas por nós e as que somos partícipes): quanto
 * foi registrado, quanto os contratos derivados já consumiram e quanto sobra
 * pra compras futuras.
 */
import { parseCurrencyBR } from './csv';
import type { Contrato, ProcedimentoLicitatorio } from '../types';

/** Procedimento que é uma ata de registro de preços (adesão, partícipe, gerenciador ou SRP). */
export function ehProcedimentoArp(proc: Pick<ProcedimentoLicitatorio, 'modalidade' | 'registroPrecos'>): boolean {
  const modalidade = (proc.modalidade ?? '').toLowerCase();
  return (
    !!proc.registroPrecos ||
    modalidade.includes('adesão') ||
    modalidade.includes('adesao') ||
    modalidade.includes('partícipe') ||
    modalidade.includes('participe') ||
    modalidade.includes('gerenciador') ||
    modalidade.includes('registro de pre')
  );
}

/** Valor registrado na ata: o valor homologado informado; sem ele, a soma de quantidade × valor dos itens. */
export function valorRegistradoDaArp(
  proc: Pick<ProcedimentoLicitatorio, 'valorHomologado' | 'itens'>,
): number {
  const informado = proc.valorHomologado ? parseCurrencyBR(proc.valorHomologado) : 0;
  if (informado > 0) return informado;
  return (proc.itens ?? []).reduce((acc, item) => {
    const valor = item.valorHomologado ? parseCurrencyBR(item.valorHomologado) : 0;
    const quantidade = Number(String(item.quantidade).replace(',', '.')) || 1;
    return acc + valor * quantidade;
  }, 0);
}

export interface SaldoArp {
  registrado: number;
  utilizado: number;
  /** Pode ficar negativo se os contratos passaram do registrado. */
  saldo: number;
  contratos: Pick<Contrato, 'id' | 'numero' | 'empresa' | 'valorGlobal'>[];
}

/** Contratos originados da ata (campo `arpId` do contrato) e o saldo que sobra dela. */
export function saldoDaArp(
  proc: Pick<ProcedimentoLicitatorio, 'id' | 'valorHomologado' | 'itens'>,
  contratos: Pick<Contrato, 'id' | 'numero' | 'empresa' | 'valorGlobal' | 'arpId'>[],
): SaldoArp {
  const derivados = contratos.filter((c) => c.arpId === proc.id);
  const registrado = valorRegistradoDaArp(proc);
  const utilizado = derivados.reduce((acc, c) => acc + (c.valorGlobal || 0), 0);
  return { registrado, utilizado, saldo: registrado - utilizado, contratos: derivados };
}
