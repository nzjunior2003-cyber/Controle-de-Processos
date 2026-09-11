#!/usr/bin/env node
/**
 * Exporta todas as coleções do Firestore pra um único JSON e envia pro
 * Google Drive — pensado pra rodar diariamente via GitHub Actions (ver
 * .github/workflows/backup-firestore.yml).
 *
 * A leitura do Firestore usa a conta de serviço (mesma já usada pra
 * publicar firestore.rules). O envio ao Drive, porém, autentica como um
 * usuário real via OAuth (refresh token) — contas de serviço não têm
 * cota de armazenamento própria no Drive pessoal ("Meu Drive"), só em
 * Drives Compartilhados (recurso do Google Workspace); ver
 * scripts/obter-refresh-token-drive.mjs pra gerar esse refresh token uma
 * única vez.
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *                                   (só usada pra ler o Firestore)
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *   GOOGLE_OAUTH_CLIENT_ID          client id do OAuth (tipo Desktop app)
 *   GOOGLE_OAUTH_CLIENT_SECRET      client secret do mesmo OAuth client
 *   GOOGLE_OAUTH_REFRESH_TOKEN      gerado uma vez com
 *                                   scripts/obter-refresh-token-drive.mjs
 *   DRIVE_BACKUP_FOLDER_ID          id da pasta no Drive (do MESMO usuário
 *                                   que autorizou o refresh token acima)
 *                                   onde o backup é salvo
 *
 * Uso: node scripts/backup-firestore-drive.mjs
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const CREDENCIAIS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const PASTA_DRIVE_ID = process.env.DRIVE_BACKUP_FOLDER_ID;
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

/** Coleções operacionais do sistema — mantidas em lista explícita, não descobertas dinamicamente, pra um backup previsível e fácil de auditar. */
const COLECOES = [
  'usuarios',
  'processos',
  'movimentacoes',
  'estadas_processo',
  'pcas',
  'alertas',
  'pareceres',
  'contratos',
  'execucoes',
  'ocorrencias',
  'aditivos',
  'procedimentos',
  'sancionatorios',
  'portarias',
  'logs_acesso',
  'logs_auditoria',
];

function validarConfiguracao() {
  const faltando = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_PROJECT_ID',
    'DRIVE_BACKUP_FOLDER_ID',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
  ].filter((chave) => !process.env[chave]);
  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
}

async function exportarFirestore() {
  const credenciais = JSON.parse(readFileSync(CREDENCIAIS_PATH, 'utf-8'));
  initializeApp({ credential: cert(credenciais), projectId: PROJECT_ID });
  const db = getFirestore();

  const dados = {};
  let totalDocumentos = 0;

  for (const colecao of COLECOES) {
    const snapshot = await db.collection(colecao).get();
    dados[colecao] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    totalDocumentos += snapshot.size;
    console.log(`  ${colecao}: ${snapshot.size} documento(s)`);
  }

  return { dados, totalDocumentos };
}

function autenticarComoUsuario() {
  const oauth2Client = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
  return oauth2Client;
}

async function enviarParaDrive(conteudoJson) {
  const auth = autenticarComoUsuario();
  const drive = google.drive({ version: 'v3', auth });

  // Confirma que o token enxerga a pasta ANTES de tentar gravar — devolve
  // um erro muito mais claro do que deixar o create() falhar direto com
  // um genérico "File not found" (id errado, ou pasta de outra conta).
  try {
    await drive.files.get({ fileId: PASTA_DRIVE_ID, fields: 'id, name' });
  } catch (erro) {
    throw new Error(
      `Não consegui acessar a pasta do Drive (id "${PASTA_DRIVE_ID}"). Confirme que ela existe ` +
        `na conta do Google que autorizou o GOOGLE_OAUTH_REFRESH_TOKEN, e que o ID está correto ` +
        `(é só o trecho final da URL da pasta, sem barras nem parâmetros). ` +
        `Erro original: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }

  const agora = new Date();
  const nomeArquivo = `backup-controle-processos-${agora.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;

  await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [PASTA_DRIVE_ID],
      mimeType: 'application/json',
    },
    media: {
      mimeType: 'application/json',
      body: conteudoJson,
    },
    fields: 'id, name',
  });

  return nomeArquivo;
}

async function main() {
  validarConfiguracao();

  console.log('Exportando coleções do Firestore...');
  const { dados, totalDocumentos } = await exportarFirestore();

  const backup = {
    geradoEm: new Date().toISOString(),
    projeto: PROJECT_ID,
    totalDocumentos,
    colecoes: dados,
  };

  console.log(`Enviando backup (${totalDocumentos} documentos) para o Google Drive...`);
  const nomeArquivo = await enviarParaDrive(JSON.stringify(backup, null, 2));

  console.log(`Backup concluído: ${nomeArquivo}`);
}

main().catch((erro) => {
  console.error('Falha ao gerar o backup:', erro);
  process.exit(1);
});
