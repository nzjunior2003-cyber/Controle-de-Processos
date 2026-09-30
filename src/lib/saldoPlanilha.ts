import type { Contrato } from '../types';
import { ID_PLANILHA_CONTRATOS } from './csv';
import { getAccessToken } from './googleAuth';
import { sincronizarContratoNaPlanilha } from './sheetsService';
import { contratoParaDadosPlanilha } from './planilhaContratos';
import type { ContratoComStatus } from './contratos';

/**
 * Depois de uma execução (NF) ou aditivo lançado no app mudar o saldo/
 * valor global do contrato, empurra esses campos de volta pra planilha —
 * só se já houver uma sessão Google autenticada (não força um popup de
 * login no meio do lançamento); falha aqui não deve travar o fluxo.
 */
export async function pushSaldoNaPlanilha(
  contrato: ContratoComStatus,
  atualizacao: Partial<Pick<Contrato, 'valorGlobal' | 'saldoAtualFinanceiro'>>,
): Promise<void> {
  try {
    const googleToken = await getAccessToken();
    if (!googleToken) return;
    await sincronizarContratoNaPlanilha(
      googleToken,
      ID_PLANILHA_CONTRATOS,
      contratoParaDadosPlanilha({ ...contrato, ...atualizacao }),
      contrato.planilha_linha,
    );
  } catch (erro) {
    console.error('Erro ao sincronizar saldo do contrato com a planilha:', erro);
  }
}
