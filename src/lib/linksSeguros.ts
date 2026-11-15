/**
 * Abertura segura de links vindos de dados (campos de formulário, Drive).
 * - só http(s) é aberto (bloqueia javascript:, data:, file:, etc.);
 * - sempre com noopener/noreferrer;
 * - documentos do Drive institucional (`/api/drive/arquivo/<id>`) exigem
 *   login: o arquivo é baixado com o token do usuário e aberto como blob.
 */
import { getFirebaseAuth } from './firebase';

const PREFIXO_DRIVE_INTERNO = '/api/drive/arquivo/';

/** Devolve a URL se for http(s) (ou link interno de documento do Drive); senão, null. */
export function urlSegura(link: string | undefined | null): string | null {
  const texto = (link ?? '').trim();
  if (!texto) return null;
  if (texto.startsWith(PREFIXO_DRIVE_INTERNO)) return texto;
  try {
    const u = new URL(texto);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function abrirLink(link: string | undefined | null): Promise<void> {
  const url = urlSegura(link);
  if (!url) {
    alert('Este link não é válido (só endereços http/https são abertos).');
    return;
  }
  if (!url.startsWith(PREFIXO_DRIVE_INTERNO)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  // Abre a aba antes do download (evita bloqueio de pop-up) e preenche depois.
  const aba = window.open('', '_blank');
  try {
    const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sessão expirada. Faça login novamente.');
    const resposta = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!resposta.ok) throw new Error('Não foi possível abrir o documento.');
    const blob = await resposta.blob();
    const objeto = URL.createObjectURL(blob);
    if (aba) aba.location.href = objeto;
    else window.open(objeto, '_blank');
    setTimeout(() => URL.revokeObjectURL(objeto), 5 * 60_000);
  } catch (erro) {
    aba?.close();
    alert(erro instanceof Error ? erro.message : 'Não foi possível abrir o documento.');
  }
}
