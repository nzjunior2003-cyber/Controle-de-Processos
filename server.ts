import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import multer from "multer";
import { google } from "googleapis";
import dotenv from "dotenv";
import webpush from "web-push";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  PERFIS_CONTRATOS,
  PERFIS_OPERACIONAIS,
  arquivoUploadPermitido,
  destinatariosNaoAutorizados,
  emailsDosMasters,
  endpointPushPermitido,
  escaparHtml,
  exigirUsuario,
  nomeSeguro,
  sanitizarHtmlEmail,
} from "./server/seguranca";

dotenv.config();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:ggc.cbmpa@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const uploadMemoria = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

/**
 * Erros do multer (ex.: arquivo maior que o limite) acontecem antes do
 * handler da rota rodar — sem isso, o handler default do Express devolve
 * uma página HTML de erro, e o cliente (que espera sempre JSON) mostra a
 * mensagem genérica "Não foi possível enviar o arquivo."
 */
function tratarErroUpload(err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err instanceof multer.MulterError) {
    const mensagem =
      err.code === "LIMIT_FILE_SIZE"
        ? "Arquivo muito grande. O limite é 50MB."
        : "Falha ao processar o arquivo enviado.";
    return res.status(400).json({ error: mensagem });
  }
  if (err) {
    console.error("Erro no upload:", err);
    return res.status(400).json({ error: "Falha ao processar o arquivo enviado." });
  }
  next();
}

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

/** Chama o Apps Script do robô/planilha (URL e token só no servidor). */
async function chamarAppsScript(corpo: Record<string, unknown>) {
  const urlRobo = process.env.ROBO_WEBAPP_URL;
  if (!urlRobo) return { naoConfigurado: true as const };
  const resposta = await fetch(urlRobo, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...corpo, token: process.env.ROBO_TOKEN ?? "" }),
    redirect: "follow",
  });
  const dados = (await resposta.json().catch(() => null)) as { status?: string; erro?: string; gravados?: number } | null;
  return { naoConfigurado: false as const, ok: resposta.ok && dados?.status === "success", dados };
}

const emailSchema = z.object({
  to: z.union([z.string().max(254), z.array(z.string().max(254)).min(1).max(10)]),
  subject: z.string().min(1).max(200),
  text: z.string().max(50_000).optional(),
  html: z.string().max(200_000).optional(),
}).refine((v) => v.text || v.html, { message: "text ou html obrigatório" });

const ordensSchema = z.object({
  itens: z.array(z.object({
    paes: z.array(z.string().max(30)).max(5).optional(),
    objeto: z.string().max(300).optional(),
    ordem: z.coerce.number().int().positive(),
  })).max(200),
});

const paesSchema = z.object({
  itens: z.array(z.object({
    pae: z.string().max(30),
    escopo: z.string().optional(),
    referencia: z.string().max(60).optional(),
    finalidade: z.string().max(120).optional(),
    relatorio: z.boolean().optional(),
  })).max(500),
});

const pushSchema = z.object({
  // `usuarioIds` é o formato novo (o servidor não aceita mais inscrições vindas do cliente).
  subscriptions: z.array(z.object({
    endpoint: z.string().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  })).min(1).max(200),
  payload: z.object({
    title: z.string().max(120).optional(),
    body: z.string().max(400).optional(),
    url: z.string().max(300).optional(),
    tag: z.string().max(100).optional(),
  }).passthrough(),
});

const planilhaInstSchema = z.object({
  numero: z.string().min(1).max(60),
  pae: z.string().max(60).optional(),
  empresa: z.string().max(200).optional(),
  cnpj: z.string().max(30).optional(),
  objeto: z.string().max(1000).optional(),
  inicioVigencia: z.string().max(30).optional(),
  fimVigencia: z.string().max(30).optional(),
  valorGlobal: z.number().optional(),
  saldoAtualFinanceiro: z.number().optional(),
  fiscalTitular: z.string().max(200).optional(),
  fiscalSuplente: z.string().max(200).optional(),
  prd: z.string().max(60).optional(),
  empenho: z.string().max(60).optional(),
});

/** Evita injeção de fórmula (=, +, -, @) ao gravar texto em planilha. */
function textoPlanilha(valor: unknown): string {
  const t = String(valor ?? "");
  return /^[=+\-@]/.test(t) ? `'${t}` : t;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const producao = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  // Atrás do nginx da VPS (1 salto) — necessário para o rate limit enxergar o IP real.
  app.set("trust proxy", 1);

  if (producao) {
    app.use(
      helmet({
        // CSP em modo "somente relatório" por enquanto: não bloqueia nada, só
        // mostra no console o que seria bloqueado. Depois de validar, vira obrigatório.
        contentSecurityPolicy: {
          reportOnly: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://accounts.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
          },
        },
        // O login do Firebase abre popup (Google) — COOP estrito quebraria.
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        crossOriginEmbedderPolicy: false,
        strictTransportSecurity: { maxAge: 15_552_000 },
      }),
    );
  }

  // CORS: nenhum cabeçalho Access-Control-* é enviado — a API só atende a
  // própria origem do app (navegadores bloqueiam chamadas de outros sites).
  app.use(express.json({ limit: "512kb" }));

  const limiteGeral = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
  const limiteEnvios = rateLimit({
    windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  });
  const limiteAcesso = rateLimit({
    windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente mais tarde." },
  });
  app.use("/api", limiteGeral);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // E-mail do Painel de Alertas. Destinatário: usuário ativo cadastrado ou
  // domínio autorizado (EMAIL_DOMINIOS_PERMITIDOS). HTML é sanitizado.
  app.post("/api/send-email", limiteEnvios, exigirUsuario(), async (req, res) => {
    try {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos (to, subject, text/html)." });
      const { subject, text, html } = parsed.data;
      const destinos = (Array.isArray(parsed.data.to) ? parsed.data.to : parsed.data.to.split(/[;,]/))
        .map((d) => d.trim()).filter(Boolean);
      if (destinos.length === 0 || destinos.length > 10) return res.status(400).json({ error: "Destinatários inválidos." });
      const recusados = await destinatariosNaoAutorizados(destinos, req.usuario!.idToken);
      if (recusados.length > 0) {
        return res.status(403).json({
          error:
            `Destinatário sem cadastro ativo no sistema: ${recusados.map(escaparHtml).join(", ")}. ` +
            "A pessoa precisa solicitar acesso e ser aprovada em Usuários para receber e-mails do sistema.",
          naoAutorizados: recusados,
        });
      }
      const htmlSeguro = html ? sanitizarHtmlEmail(html) : undefined;

      const transporter = getTransporter();
      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: destinos,
          subject: subject.replace(/[\r\n]+/g, " "),
          text,
          html: htmlSeguro,
        });
        return res.json({ success: true, messageId: info.messageId });
      }
      console.log("[MOCK EMAIL SENT] destinatários:", destinos.length);
      return res.json({ success: true, mock: true, message: "Email simulated. Configure SMTP variables in .env to send real emails." });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Aviso aos masters de um novo pedido de acesso. O solicitante ainda está
  // inativo; por isso a rota aceita conta inativa — mas o conteúdo do e-mail
  // vem do cadastro do próprio usuário (lido do Firestore), nunca do corpo.
  app.post("/api/acesso/notificar", limiteAcesso, exigirUsuario({ permitirInativo: true }), async (req, res) => {
    try {
      const u = req.usuario!;
      if (u.ativo) return res.json({ ok: true, ignorado: true });
      const fixos = (process.env.ACESSO_NOTIFICAR_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
      const destinos = fixos.length ? fixos : await emailsDosMasters(u.idToken);
      const transporter = getTransporter();
      if (destinos.length && transporter) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: destinos,
          subject: "Novo pedido de acesso ao Sistema de Controle de Processos",
          html:
            `<p>Há um novo pedido de acesso aguardando aprovação.</p>` +
            `<p><b>Nome:</b> ${escaparHtml(u.nome)}<br><b>E-mail:</b> ${escaparHtml(u.email)}<br><b>Perfil solicitado:</b> ${escaparHtml(u.perfil ?? "")}</p>` +
            `<p>Acesse o sistema (Gerenciar Usuários) para aprovar ou recusar.</p>`,
        });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error("Error notifying access request:", error);
      res.status(500).json({ error: "Falha ao notificar o pedido de acesso." });
    }
  });

  app.post("/api/robo/solicitar", limiteEnvios, exigirUsuario({ perfis: ["master", "contratos", "apoio", "gestao"] }), async (req, res) => {
    try {
      const quem = nomeSeguro(String(req.body?.quem ?? req.usuario!.nome), 80);
      const r = await chamarAppsScript({ acao: "solicitar_execucao", quem });
      if (r.naoConfigurado) return res.status(500).json({ error: "O robô não está configurado no servidor." });
      if (!r.ok) return res.status(502).json({ error: r.dados?.erro ?? "O Apps Script do robô recusou o pedido." });
      return res.json({ ok: true });
    } catch (error) {
      console.error("Error requesting robot run:", error);
      res.status(500).json({ error: "Falha ao enviar o pedido ao robô." });
    }
  });

  app.post("/api/planilha/ordens", limiteEnvios, exigirUsuario({ perfis: PERFIS_OPERACIONAIS }), async (req, res) => {
    try {
      const parsed = ordensSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
      const itens = parsed.data.itens.map((i) => ({
        paes: (i.paes ?? []).map(textoPlanilha),
        objeto: textoPlanilha(i.objeto ?? ""),
        ordem: i.ordem,
      }));
      const r = await chamarAppsScript({ acao: "gravar_ordens", itens });
      if (r.naoConfigurado) return res.status(500).json({ error: "Planilha não configurada no servidor." });
      if (!r.ok) return res.status(502).json({ error: r.dados?.erro ?? "O Apps Script recusou o pedido." });
      return res.json({ ok: true, gravados: r.dados?.gravados ?? 0 });
    } catch (error) {
      console.error("Error writing order numbers:", error);
      res.status(500).json({ error: "Falha ao gravar os nºs de ordem na planilha." });
    }
  });

  app.post("/api/planilha/paes-acessorios", limiteEnvios, exigirUsuario({ perfis: PERFIS_OPERACIONAIS }), async (req, res) => {
    try {
      const parsed = paesSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
      const itens = parsed.data.itens
        .filter((i) => /\d{4}\s*[/-]\s*\d+/.test(i.pae))
        .map((i) => ({
          pae: textoPlanilha(i.pae),
          escopo: i.escopo === "contrato" ? "contrato" : "processo",
          referencia: textoPlanilha(i.referencia ?? ""),
          finalidade: textoPlanilha(i.finalidade ?? ""),
          relatorio: i.relatorio === true,
        }));
      const r = await chamarAppsScript({ acao: "gravar_paes_acessorios", itens });
      if (r.naoConfigurado) return res.status(500).json({ error: "Planilha não configurada no servidor." });
      if (!r.ok) return res.status(502).json({ error: r.dados?.erro ?? "O Apps Script recusou o pedido." });
      return res.json({ ok: true, gravados: r.dados?.gravados ?? itens.length });
    } catch (error) {
      console.error("Error writing accessory PAEs:", error);
      res.status(500).json({ error: "Falha ao publicar os PAEs acessórios na planilha." });
    }
  });

  // Push: só endpoints oficiais de push dos navegadores (anti-SSRF) e payload limitado.
  app.post("/api/send-push", limiteEnvios, exigirUsuario({ perfis: PERFIS_OPERACIONAIS }), async (req, res) => {
    try {
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return res.status(500).json({ error: "Push não está configurado no servidor." });
      }
      const parsed = pushSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
      const { subscriptions, payload } = parsed.data;
      const validas = subscriptions.filter((s) => endpointPushPermitido(s.endpoint));
      if (validas.length === 0) return res.status(400).json({ error: "Nenhuma inscrição válida." });
      const resultados = await Promise.allSettled(
        validas.map((subscription) => webpush.sendNotification(subscription, JSON.stringify(payload))),
      );
      const falhas = resultados.filter((r) => r.status === "rejected").length;
      return res.json({ enviados: resultados.length - falhas, falhas });
    } catch (error) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Falha ao enviar a notificação push." });
    }
  });

  // Upload pro Drive institucional: só tipos de documento aceitos, acesso
  // RESTRITO (sem link público) — a leitura passa por /api/drive/arquivo/:id.
  app.post(
    "/api/upload-drive",
    limiteEnvios,
    exigirUsuario({ perfis: PERFIS_CONTRATOS }),
    uploadMemoria.single("arquivo"),
    tratarErroUpload,
    async (req, res) => {
      try {
        const pasta = typeof req.body?.pasta === "string" ? nomeSeguro(req.body.pasta.trim()) : "";
        if (!pasta || !req.file) return res.status(400).json({ error: "Campos obrigatórios: pasta, arquivo." });
        if (!arquivoUploadPermitido(req.file.originalname, req.file.mimetype)) {
          return res.status(400).json({ error: "Tipo de arquivo não permitido (use PDF, imagem, Word ou Excel)." });
        }
        const drive = getDriveClient();
        if (!drive) return res.status(500).json({ error: "Upload para o Drive não está configurado no servidor." });

        const pastaRaiz = await getOrCreateFolder(drive, NOME_PASTA_CONTRATOS);
        const pastaContrato = await getOrCreateFolder(drive, pasta, pastaRaiz);
        const criado = await drive.files.create({
          requestBody: { name: nomeSeguro(req.file.originalname, 200), parents: [pastaContrato] },
          media: { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) },
          fields: "id",
        });
        if (!criado.data.id) throw new Error("Drive não devolveu o id do arquivo.");
        return res.json({ link: `/api/drive/arquivo/${criado.data.id}`, id: criado.data.id });
      } catch (error) {
        console.error("Error uploading to Drive:", error);
        res.status(500).json({ error: "Falha ao enviar o arquivo para o Drive." });
      }
    },
  );

  // Leitura autenticada de documento do Drive: só arquivos dentro da pasta
  // "Documentos de Contratos" (o token institucional não vira leitor universal do Drive).
  app.get("/api/drive/arquivo/:id", limiteEnvios, exigirUsuario(), async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return res.status(400).json({ error: "Identificador inválido." });
      const drive = getDriveClient();
      if (!drive) return res.status(500).json({ error: "Drive não configurado no servidor." });

      const arquivo = await drive.files.get({ fileId: id, fields: "name,mimeType,parents" });
      const pastaRaiz = await getOrCreateFolder(drive, NOME_PASTA_CONTRATOS);
      const pai = arquivo.data.parents?.[0];
      const paiMeta = pai ? await drive.files.get({ fileId: pai, fields: "parents" }) : null;
      if (!pai || !(pai === pastaRaiz || paiMeta?.data.parents?.includes(pastaRaiz))) {
        return res.status(404).json({ error: "Arquivo não encontrado." });
      }

      const conteudo = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "stream" });
      const nome = nomeSeguro(arquivo.data.name ?? "arquivo");
      res.setHeader("Content-Type", arquivo.data.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(nome)}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");
      (conteudo.data as NodeJS.ReadableStream).pipe(res);
    } catch (error) {
      console.error("Error reading Drive file:", error);
      res.status(404).json({ error: "Arquivo não encontrado." });
    }
  });

  app.post("/api/sync-planilha-institucional", limiteEnvios, exigirUsuario({ perfis: PERFIS_CONTRATOS }), async (req, res) => {
    try {
      const parsed = planilhaInstSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos (numero obrigatório)." });
      const dados = parsed.data;

      const drive = getDriveClient();
      const sheets = getSheetsClient();
      if (!drive || !sheets) return res.status(500).json({ error: "Planilha institucional não configurada no servidor." });

      const pastaRaiz = await getOrCreateFolder(drive, NOME_PASTA_CONTRATOS);
      const spreadsheetId = await getOrCreateSpreadsheetInstitucional(drive, sheets, pastaRaiz);

      const coluna = await sheets.spreadsheets.values.get({ spreadsheetId, range: "A2:A" });
      const numeros = coluna.data.values ?? [];
      const indiceExistente = numeros.findIndex((linha) => (linha[0] ?? "") === dados.numero);
      const linha = indiceExistente >= 0 ? indiceExistente + 2 : numeros.length + 2;

      const valores = [
        textoPlanilha(dados.numero),
        textoPlanilha(dados.pae),
        textoPlanilha(dados.empresa),
        textoPlanilha(dados.cnpj),
        textoPlanilha(dados.objeto),
        textoPlanilha(dados.inicioVigencia),
        textoPlanilha(dados.fimVigencia),
        typeof dados.valorGlobal === "number" ? dados.valorGlobal : "",
        typeof dados.saldoAtualFinanceiro === "number" ? dados.saldoAtualFinanceiro : "",
        textoPlanilha(dados.fiscalTitular),
        textoPlanilha(dados.fiscalSuplente),
        textoPlanilha(dados.prd),
        textoPlanilha(dados.empenho),
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

  // Erros não tratados: resposta genérica, sem stack nem detalhes internos.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Erro não tratado:", err);
    res.status(500).json({ error: "Erro interno." });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
