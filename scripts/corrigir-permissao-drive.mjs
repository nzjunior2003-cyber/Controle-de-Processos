#!/usr/bin/env node
/**
 * Corrige a permissão dos arquivos já enviados pro Drive institucional
 * ("Documentos de Contratos" e subpastas) ANTES do /api/upload-drive
 * passar a marcar todo upload novo como "qualquer pessoa com o link pode
 * visualizar" — sem essa permissão, o fiscal cai numa tela do Google
 * pedindo "solicitar acesso" em vez de abrir o PDF direto.
 *
 * Rode UMA VEZ, na sua máquina (nunca no GitHub Actions, pra não expor o
 * refresh token institucional num log de CI), com as mesmas credenciais
 * já usadas em scripts/obter-refresh-token-drive.mjs:
 *
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *     DRIVE_CONTRATOS_REFRESH_TOKEN=... node scripts/corrigir-permissao-drive.mjs
 *
 * Por padrão só lista o que faria (dry-run). Pra aplicar de verdade:
 *
 *   ...APLICAR=true node scripts/corrigir-permissao-drive.mjs
 */
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_CONTRATOS_REFRESH_TOKEN;
const APLICAR = process.env.APLICAR === 'true';
const NOME_PASTA_CONTRATOS = 'Documentos de Contratos';

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Defina GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e DRIVE_CONTRATOS_REFRESH_TOKEN antes de rodar.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function acharPastaRaiz() {
  const { data } = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${NOME_PASTA_CONTRATOS}' and trashed=false`,
    fields: 'files(id, name)',
  });
  const pasta = data.files?.[0];
  if (!pasta?.id) throw new Error(`Pasta "${NOME_PASTA_CONTRATOS}" não encontrada no Drive institucional.`);
  return pasta.id;
}

/** Lista recursivamente todo arquivo (não-pasta) dentro de `pastaId` e suas subpastas. */
async function listarArquivosRecursivo(pastaId) {
  const arquivos = [];
  const pastasParaVisitar = [pastaId];

  while (pastasParaVisitar.length > 0) {
    const atual = pastasParaVisitar.pop();
    let pageToken;
    do {
      const { data } = await drive.files.list({
        q: `'${atual}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageToken,
      });
      for (const arquivo of data.files ?? []) {
        if (arquivo.mimeType === 'application/vnd.google-apps.folder') {
          pastasParaVisitar.push(arquivo.id);
        } else {
          arquivos.push(arquivo);
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return arquivos;
}

async function jaTemPermissaoPublica(fileId) {
  const { data } = await drive.permissions.list({ fileId, fields: 'permissions(type, role)' });
  return (data.permissions ?? []).some((p) => p.type === 'anyone' && p.role === 'reader');
}

async function main() {
  console.log(APLICAR ? 'Modo: APLICANDO as permissões.' : 'Modo: DRY-RUN (nada será alterado — rode com APLICAR=true pra aplicar).');

  const pastaRaizId = await acharPastaRaiz();
  const arquivos = await listarArquivosRecursivo(pastaRaizId);
  console.log(`Encontrados ${arquivos.length} arquivo(s) em "${NOME_PASTA_CONTRATOS}".`);

  let corrigidos = 0;
  let jaOk = 0;
  let comErro = 0;

  for (const arquivo of arquivos) {
    try {
      if (await jaTemPermissaoPublica(arquivo.id)) {
        jaOk++;
        continue;
      }
      console.log(`${APLICAR ? 'Corrigindo' : 'Precisa corrigir'}: ${arquivo.name} (${arquivo.id})`);
      if (APLICAR) {
        await drive.permissions.create({
          fileId: arquivo.id,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      }
      corrigidos++;
    } catch (erro) {
      comErro++;
      console.error(`Erro em ${arquivo.name} (${arquivo.id}):`, erro instanceof Error ? erro.message : erro);
    }
  }

  console.log(`\nResumo: ${jaOk} já estavam certos, ${corrigidos} ${APLICAR ? 'corrigidos' : 'precisam de correção'}, ${comErro} com erro.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
