import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import multer from "multer";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const uploadMemoria = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/**
 * Cliente OAuth autenticado como a conta institucional fixa
 * (ggc.cbmpa@gmail.com) via refresh token — usado tanto pro Drive
 * (documentos de contrato) quanto pro Sheets (planilha institucional),
 * pra tudo cair sempre na mesma conta, não na de quem estiver logado no
 * app no momento. `null` quando as credenciais não estão configuradas.
 */
function getInstitucionalAuth() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, DRIVE_CONTRATOS_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !DRIVE_CONTRATOS_REFRESH_TOKEN) {
    return null;
  }
  const oauth2Client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: DRIVE_CONTRATOS_REFRESH_TOKEN });
  return oauth2Client;
}

function getDriveClient() {
  const auth = getInstitucionalAuth();
  return auth ? google.drive({ version: "v3", auth }) : null;
}

function getSheetsClient() {
  const auth = getInstitucionalAuth();
  return auth ? google.sheets({ version: "v4", auth }) : null;
}

const NOME_PASTA_CONTRATOS = "Documentos de Contratos";
const NOME_PLANILHA_INSTITUCIONAL = "Gestão de Contratos - CBMPA (institucional)";
const CABECALHO_PLANILHA_INSTITUCIONAL = [
  "Nº Contrato",
  "PAE",
  "Empresa",
  "CNPJ",
  "Objeto",
  "Início Vigência",
  "Fim Vigência",
  "Valor Global",
  "Saldo Atual Financeiro",
  "Fiscal Titular",
  "Fiscal Suplente",
  "PRD",
  "Empenho",
  "Atualizado em",
];

/** Acha (ou cria, com o cabeçalho já gravado) a planilha institucional dentro da pasta "Documentos de Contratos". */
async function getOrCreateSpreadsheetInstitucional(
  drive: ReturnType<typeof google.drive>,
  sheets: ReturnType<typeof google.sheets>,
  pastaId: string,
): Promise<string> {
  const nomeEscapado = NOME_PLANILHA_INSTITUCIONAL.replace(/'/g, "\\'");
  const lista = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${nomeEscapado}' and trashed=false and '${pastaId}' in parents`,
    fields: "files(id)",
  });
  const existente = lista.data.files?.[0]?.id;
  if (existente) return existente;

  const criada = await sheets.spreadsheets.create({
    requestBody: { properties: { title: NOME_PLANILHA_INSTITUCIONAL } },
    fields: "spreadsheetId",
  });
  const spreadsheetId = criada.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Não foi possível criar a planilha institucional.");

  // Sheets API sempre cria o arquivo na raiz do Drive — move pra dentro da pasta.
  await drive.files.update({ fileId: spreadsheetId, addParents: pastaId, fields: "id, parents" });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: [CABECALHO_PLANILHA_INSTITUCIONAL] },
  });

  return spreadsheetId;
}

/** Acha (ou cria) uma pasta pelo nome dentro de `parentId` (raiz do Drive quando ausente). */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  nome: string,
  parentId?: string,
): Promise<string> {
  const nomeEscapado = nome.replace(/'/g, "\\'");
  const q =
    `mimeType='application/vnd.google-apps.folder' and name='${nomeEscapado}' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : "");
  const lista = await drive.files.list({ q, fields: "files(id)" });
  const existente = lista.data.files?.[0]?.id;
  if (existente) return existente;

  const criada = await drive.files.create({
    requestBody: {
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!criada.data.id) throw new Error("Não foi possível criar a pasta no Drive.");
  return criada.data.id;
}

// Create default transpoter if env variables exist
const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback to testing/logged transporter for dev without SMTP vars
  return null;
};

/**
 * Confirma que a requisição trouxe um ID token válido de um usuário
 * autenticado neste projeto Firebase — sem depender do firebase-admin,
 * usando a API pública do Identity Toolkit (a mesma api key, já pública
 * no bundle do front, faz a validação). Sem isso, /api/send-email fica
 * aberto pra qualquer um na internet disparar e-mail em nome do sistema.
 */
async function idTokenValido(idToken: string | undefined): Promise<boolean> {
  if (!idToken) return false;
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return false;
  try {
    const resposta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!resposta.ok) return false;
    const dados = await resposta.json();
    return Array.isArray(dados.users) && dados.users.length > 0;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Usada pelo Painel de Alertas de contratos (src/components/AlertasModal.tsx).
  // NÃO é mais usada para recuperação de senha: isso agora é feito pelo
  // Firebase Authentication (sendPasswordResetEmail).
  app.post("/api/send-email", async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (!(await idTokenValido(idToken))) {
        return res.status(401).json({ error: "Não autenticado." });
      }

      const { to, subject, text, html } = req.body;

      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "Missing required fields (to, subject, text/html)" });
      }

      const transporter = getTransporter();

      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
          html,
        });

        console.log("Email sent:", info.messageId);
        return res.json({ success: true, messageId: info.messageId });
      } else {
        // If SMTP vars are missing, just simulate sending email so the UI works
        console.log("[MOCK EMAIL SENT]");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("Body:", text || html);
        return res.json({ success: true, mock: true, message: "Email simulated. Configure SMTP variables in .env to send real emails." });
      }

    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Upload de documentos de contrato (PDF do contrato, Nota de Empenho,
  // NF) pro Drive institucional (conta fixa, ver getDriveClient) — usado
  // por ContratoForm.tsx e ExecucaoModal.tsx via src/lib/driveUploadService.ts.
  app.post("/api/upload-drive", uploadMemoria.single("arquivo"), async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (!(await idTokenValido(idToken))) {
        return res.status(401).json({ error: "Não autenticado." });
      }

      const pasta = typeof req.body?.pasta === "string" ? req.body.pasta.trim() : "";
      if (!pasta || !req.file) {
        return res.status(400).json({ error: "Campos obrigatórios: pasta, arquivo." });
      }

      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({
          error: "Upload para o Drive não está configurado no servidor (faltam credenciais).",
        });
      }

      const pastaRaiz = await getOrCreateFolder(drive, NOME_PASTA_CONTRATOS);
      const pastaContrato = await getOrCreateFolder(drive, pasta, pastaRaiz);

      const criado = await drive.files.create({
        requestBody: { name: req.file.originalname, parents: [pastaContrato] },
        media: { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) },
        fields: "id, webViewLink",
      });

      return res.json({ link: criado.data.webViewLink || criado.data.id });
    } catch (error) {
      console.error("Error uploading to Drive:", error);
      res.status(500).json({ error: "Falha ao enviar o arquivo para o Drive." });
    }
  });

  // Espelha um contrato editado/criado na planilha institucional (Drive
  // fixo, mesma conta usada pra Documentos de Contratos) — em paralelo à
  // sincronização já existente com a planilha oficial "Gestão de
  // Contratos" (essa, feita pelo navegador com a conta Google de quem
  // está editando). Upsert por Nº do Contrato: atualiza a linha se já
  // existir, senão acrescenta uma nova.
  app.post("/api/sync-planilha-institucional", async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (!(await idTokenValido(idToken))) {
        return res.status(401).json({ error: "Não autenticado." });
      }

      const dados = req.body ?? {};
      if (!dados.numero) {
        return res.status(400).json({ error: "Campo obrigatório: numero." });
      }

      const drive = getDriveClient();
      const sheets = getSheetsClient();
      if (!drive || !sheets) {
        return res.status(500).json({
          error: "Sincronização com a planilha institucional não está configurada no servidor (faltam credenciais).",
        });
      }

      const pastaRaiz = await getOrCreateFolder(drive, NOME_PASTA_CONTRATOS);
      const spreadsheetId = await getOrCreateSpreadsheetInstitucional(drive, sheets, pastaRaiz);

      const coluna = await sheets.spreadsheets.values.get({ spreadsheetId, range: "A2:A" });
      const numeros = coluna.data.values ?? [];
      const indiceExistente = numeros.findIndex((linha) => (linha[0] ?? "") === dados.numero);
      const linha = indiceExistente >= 0 ? indiceExistente + 2 : numeros.length + 2;

      const valores = [
        dados.numero ?? "",
        dados.pae ?? "",
        dados.empresa ?? "",
        dados.cnpj ?? "",
        dados.objeto ?? "",
        dados.inicioVigencia ?? "",
        dados.fimVigencia ?? "",
        typeof dados.valorGlobal === "number" ? dados.valorGlobal : "",
        typeof dados.saldoAtualFinanceiro === "number" ? dados.saldoAtualFinanceiro : "",
        dados.fiscalTitular ?? "",
        dados.fiscalSuplente ?? "",
        dados.prd ?? "",
        dados.empenho ?? "",
        new Date().toISOString(),
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `A${linha}:N${linha}`,
        valueInputOption: "RAW",
        requestBody: { values: [valores] },
      });

      return res.json({ success: true, linha });
    } catch (error) {
      console.error("Error syncing institutional spreadsheet:", error);
      res.status(500).json({ error: "Falha ao sincronizar com a planilha institucional." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
