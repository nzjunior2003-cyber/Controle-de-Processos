/**
 * Espelha um contrato na planilha institucional (Drive fixo do
 * ggc.cbmpa@gmail.com, ver server.ts /api/sync-planilha-institucional)
 * — em paralelo à sincronização já existente com a planilha oficial
 * "Gestão de Contratos" (essa, com a conta Google de quem está editando).
 * Best-effort: chamado depois de salvar no Firestore, nunca deve travar
 * o cadastro se falhar.
 */
import { getFirebaseAuth } from './firebase';
import type { DadosContratoParaPlanilha } from './planilhaContratos';

export async function sincronizarContratoInstitucional(dados: DadosContratoParaPlanilha): Promise<void> {
  const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Sessão expirada. Faça login novamente para sincronizar a planilha institucional.');
  }

  const resposta = await fetch('/api/sync-planilha-institucional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.error || 'Não foi possível sincronizar com a planilha institucional.');
  }
}
