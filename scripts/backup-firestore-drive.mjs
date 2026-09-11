#!/usr/bin/env node
/**
 * Exporta todas as coleções do Firestore pra um único JSON e envia pro
 * Google Drive — pensado pra rodar diariamente via GitHub Actions (ver
 * .github/workflows/backup-firestore.yml), usando a mesma conta de
 * serviço já usada pra publicar firestore.rules.
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *   DRIVE_BACKUP_FOLDER_ID          id da pasta no Drive (compartilhada
 *                                   com o e-mail da conta de serviço,
 *                                   como Editor) onde o backup é salvo
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
  const faltando = [];
  if (!CREDENCIAIS_PATH) faltando.push('GOOGLE_APPLICATION_CREDENTIALS');
  if (!PROJECT_ID) faltando.push('FIREBASE_PROJECT_ID');
  if (!PASTA_DRIVE_ID) faltando.push('DRIVE_BACKUP_FOLDER_ID');
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

  return { dados, totalDocumentos, credenciais };
}

async function enviarParaDrive(conteudoJson, credenciais) {
  // Precisa do escopo "drive" (não o mais restrito "drive.file"): a pasta
  // de backup foi criada e compartilhada por um usuário humano, não pela
  // própria conta de serviço, e "drive.file" só enxerga arquivos/pastas
  // que o app mesmo criou ou abriu — com ele, a conta de serviço não
  // consegue ver a pasta compartilhada (erro 404 "File not found").
  const auth = new google.auth.GoogleAuth({
    credentials: credenciais,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Confirma que a conta de serviço enxerga a pasta ANTES de tentar
  // gravar — devolve um erro muito mais claro (com o e-mail exato que
  // precisa estar com acesso) do que deixar o create() falhar direto
  // com um genérico "File not found".
  try {
    await drive.files.get({
      fileId: PASTA_DRIVE_ID,
      fields: 'id, name',
      supportsAllDrives: true,
    });
  } catch (erro) {
    throw new Error(
      `Não consegui acessar a pasta do Drive (id "${PASTA_DRIVE_ID}"). Confirme que: ` +
        `1) o ID está correto (é só o trecho final da URL da pasta, sem barras nem parâmetros); ` +
        `2) a pasta foi compartilhada como Editor com a conta de serviço "${credenciais.client_email}". ` +
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
    supportsAllDrives: true,
  });

  return nomeArquivo;
}

async function main() {
  validarConfiguracao();

  console.log('Exportando coleções do Firestore...');
  const { dados, totalDocumentos, credenciais } = await exportarFirestore();
  console.log(`Conta de serviço em uso: ${credenciais.client_email}`);

  const backup = {
    geradoEm: new Date().toISOString(),
    projeto: PROJECT_ID,
    totalDocumentos,
    colecoes: dados,
  };

  console.log(`Enviando backup (${totalDocumentos} documentos) para o Google Drive...`);
  const nomeArquivo = await enviarParaDrive(JSON.stringify(backup, null, 2), credenciais);

  console.log(`Backup concluído: ${nomeArquivo}`);
}

main().catch((erro) => {
  console.error('Falha ao gerar o backup:', erro);
  process.exit(1);
});
