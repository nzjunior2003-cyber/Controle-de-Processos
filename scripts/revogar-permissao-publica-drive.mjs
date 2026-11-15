#!/usr/bin/env node
/**
 * Remove a permissão "qualquer pessoa com o link" (type: anyone) de TODOS os
 * arquivos de "Documentos de Contratos" e subpastas. Os documentos passam a
 * ser abertos só dentro do sistema (rota autenticada /api/drive/arquivo/<id>).
 *
 * ATENÇÃO: depois de rodar com APLICAR=true, os links antigos do Google Drive
 * (drive.google.com/...) salvos nos contratos deixam de abrir para quem não
 * é a conta institucional. O sistema só abre os documentos novos (e os
 * antigos que forem reenviados) pela rota autenticada. Rode só quando o
 * responsável decidir — antes, avalie reenviar os PDFs mais usados.
 *
 * Rode na sua máquina (nunca no CI), com as credenciais do .env:
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *     DRIVE_CONTRATOS_REFRESH_TOKEN=... node scripts/revogar-permissao-publica-drive.mjs
 * Por padrão só LISTA (dry-run). Para aplicar: ...APLICAR=true node ...
 */
import { google } from 'googleapis';

const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, DRIVE_CONTRATOS_REFRESH_TOKEN } = process.env;
const APLICAR = process.env.APLICAR === 'true';
const NOME_PASTA_CONTRATOS = 'Documentos de Contratos';

if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !DRIVE_CONTRATOS_REFRESH_TOKEN) {
  console.error('Defina GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e DRIVE_CONTRATOS_REFRESH_TOKEN.');
  process.exit(1);
}

const auth = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
auth.setCredentials({ refresh_token: DRIVE_CONTRATOS_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

async function filhos(pastaId) {
  const itens = [];
  let pageToken;
  do {
    const r = await drive.files.list({
      q: `'${pastaId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      pageToken,
    });
    itens.push(...(r.data.files ?? []));
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  return itens;
}

async function percorrer(pastaId) {
  let revogados = 0;
  for (const item of await filhos(pastaId)) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      revogados += await percorrer(item.id);
      continue;
    }
    const perms = await drive.permissions.list({ fileId: item.id, fields: 'permissions(id,type)' });
    for (const p of perms.data.permissions ?? []) {
      if (p.type !== 'anyone') continue;
      console.log(`${APLICAR ? 'Revogando' : '[dry-run] revogaria'} link público de: ${item.name}`);
      if (APLICAR) await drive.permissions.delete({ fileId: item.id, permissionId: p.id });
      revogados += 1;
    }
  }
  return revogados;
}

const raiz = await drive.files.list({
  q: `mimeType='application/vnd.google-apps.folder' and name='${NOME_PASTA_CONTRATOS}' and trashed=false`,
  fields: 'files(id)',
});
const raizId = raiz.data.files?.[0]?.id;
if (!raizId) {
  console.error(`Pasta "${NOME_PASTA_CONTRATOS}" não encontrada.`);
  process.exit(1);
}
const total = await percorrer(raizId);
console.log(`${APLICAR ? 'Revogados' : 'Seriam revogados'}: ${total} arquivo(s).${APLICAR ? '' : ' Rode com APLICAR=true para aplicar.'}`);
