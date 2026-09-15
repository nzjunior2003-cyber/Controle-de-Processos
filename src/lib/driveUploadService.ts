/**
 * Envio de arquivos (PDF do contrato, Nota de Empenho, NF) pro Drive
 * institucional via o endpoint /api/upload-drive (server.ts) — a conta
 * Google que recebe os arquivos é fixa, configurada no servidor, então
 * todo documento cai sempre no mesmo Drive, não no de quem estiver
 * logado no app no momento. O endpoint exige um ID token do Firebase
 * Auth (mesmo padrão do /api/send-email).
 */
import { getFirebaseAuth } from './firebase';

/**
 * Envia um arquivo pra pasta `pasta` dentro de "Documentos de
 * Contratos" no Drive institucional. Devolve o link (`webViewLink`) do
 * arquivo criado.
 */
export async function uploadArquivoContrato(pasta: string, arquivo: File): Promise<string> {
  const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Sessão expirada. Faça login novamente para enviar arquivos.');
  }

  const form = new FormData();
  form.append('pasta', pasta);
  form.append('arquivo', arquivo);

  const resposta = await fetch('/api/upload-drive', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.error || 'Não foi possível enviar o arquivo.');
  }

  const dados = await resposta.json();
  return dados.link as string;
}
