/**
 * Camada única de segurança do servidor: autenticação por ID token do
 * Firebase + checagem de perfil/ativo, escape de HTML, validação de
 * destinatários e de hosts de push. Sem dependência do firebase-admin: o
 * perfil é lido do Firestore (REST) usando o próprio token de quem chamou,
 * então as Firestore Rules continuam valendo também aqui.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createHash } from "crypto";

export type PerfilServidor =
  | "master" | "contratos" | "apoio" | "gestao" | "fiscal" | "bm4"
  | "financeiro" | "dga" | "dal" | "df" | "dca" | "demandante";

/** Perfis que operam processos (mesmo conjunto que pode gravar `processos` nas Rules). */
export const PERFIS_OPERACIONAIS: PerfilServidor[] = [
  "master", "contratos", "apoio", "gestao", "fiscal", "financeiro", "demandante",
];
export const PERFIS_CONTRATOS: PerfilServidor[] = ["master", "contratos", "gestao", "fiscal", "financeiro"];

export interface UsuarioAutenticado {
  uid: string;
  email: string;
  perfil: PerfilServidor | null;
  ativo: boolean;
  nome: string;
  idToken: string;
}

declare module "express-serve-static-core" {
  interface Request {
    usuario?: UsuarioAutenticado;
  }
}

const CACHE_MS = 30_000;
const cache = new Map<string, { expira: number; usuario: UsuarioAutenticado }>();

function chaveCache(idToken: string): string {
  return createHash("sha256").update(idToken).digest("hex");
}

export function limparCacheAutenticacao(): void {
  cache.clear();
}

function urlFirestore(caminho: string): string {
  const projeto = process.env.VITE_FIREBASE_PROJECT_ID;
  return `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents${caminho}`;
}

/** Valida o ID token (Identity Toolkit) e carrega perfil/ativo do `usuarios/{uid}`. */
export async function carregarUsuario(idToken: string): Promise<UsuarioAutenticado | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey || !process.env.VITE_FIREBASE_PROJECT_ID) return null;

  const chave = chaveCache(idToken);
  const emCache = cache.get(chave);
  if (emCache && emCache.expira > Date.now()) return emCache.usuario;

  try {
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!lookup.ok) return null;
    const dadosLookup = (await lookup.json()) as { users?: { localId?: string; email?: string; disabled?: boolean }[] };
    const conta = dadosLookup.users?.[0];
    if (!conta?.localId || conta.disabled) return null;

    const doc = await fetch(urlFirestore(`/usuarios/${encodeURIComponent(conta.localId)}`), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    let perfil: PerfilServidor | null = null;
    let ativo = false;
    let nome = "";
    if (doc.ok) {
      const d = (await doc.json()) as { fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> };
      ativo = d.fields?.ativo?.booleanValue === true;
      perfil = (d.fields?.perfil?.stringValue as PerfilServidor | undefined) ?? null;
      nome = d.fields?.nome?.stringValue ?? "";
    }

    const usuario: UsuarioAutenticado = {
      uid: conta.localId,
      email: (conta.email ?? "").toLowerCase(),
      perfil,
      ativo,
      nome,
      idToken,
    };
    cache.set(chave, { expira: Date.now() + CACHE_MS, usuario });
    if (cache.size > 500) {
      const agora = Date.now();
      for (const [k, v] of cache) if (v.expira < agora) cache.delete(k);
    }
    return usuario;
  } catch {
    return null;
  }
}

interface OpcoesAutenticacao {
  /** Perfis permitidos; omitido = qualquer usuário ATIVO. */
  perfis?: PerfilServidor[];
  /** Aceita conta ainda inativa (só para o pedido de acesso). */
  permitirInativo?: boolean;
}

/** Middleware único: token válido + usuário ativo + perfil permitido. */
export function exigirUsuario(opcoes: OpcoesAutenticacao = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cabecalho = req.headers.authorization ?? "";
    const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    const usuario = idToken ? await carregarUsuario(idToken) : null;
    if (!usuario) return res.status(401).json({ error: "Não autenticado." });
    if (!opcoes.permitirInativo && !usuario.ativo) {
      return res.status(403).json({ error: "Acesso não autorizado." });
    }
    if (opcoes.perfis && (!usuario.perfil || !opcoes.perfis.includes(usuario.perfil))) {
      return res.status(403).json({ error: "Acesso não autorizado." });
    }
    req.usuario = usuario;
    next();
  };
}

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escaparHtml(valor: unknown): string {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/**
 * HTML recebido do cliente é tratado como texto com marcações simples:
 * remove tags perigosas (script/style/iframe/etc.), atributos on*, e
 * esquemas javascript:/data: em href/src. Allowlist de tags de formatação.
 */
const TAGS_PERMITIDAS = new Set([
  "p", "br", "b", "i", "u", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3", "h4",
  "table", "thead", "tbody", "tr", "th", "td", "div", "span", "a", "hr",
]);
export function sanitizarHtmlEmail(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (trecho, nome: string, attrs: string) => {
      const tag = nome.toLowerCase();
      if (!TAGS_PERMITIDAS.has(tag)) return "";
      if (trecho.startsWith("</")) return `</${tag}>`;
      let href = "";
      if (tag === "a") {
        const m = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
        const alvo = (m?.[2] ?? m?.[3] ?? "").trim();
        if (/^https?:\/\//i.test(alvo)) href = ` href="${escaparHtml(alvo)}" rel="noopener noreferrer"`;
      }
      const estilo = /style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
      const estiloSeguro = estilo && !/(expression|url\(|javascript:|@import)/i.test(estilo) ? ` style="${escaparHtml(estilo)}"` : "";
      return `<${tag}${href}${estiloSeguro}>`;
    });
}

/** Domínios autorizados para destinatários (env EMAIL_DOMINIOS_PERMITIDOS, separados por vírgula). */
export function dominiosPermitidos(): string[] {
  return (process.env.EMAIL_DOMINIOS_PERMITIDOS ?? "")
    .split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

export function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(email);
}

/** Normaliza e-mail para comparação: sem espaços nas pontas e sem diferença de maiúsculas. */
export function normalizarEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

let cacheAtivos: { expira: number; emails: Set<string> } | null = null;
export function limparCacheEmailsAtivos(): void {
  cacheAtivos = null;
}

/**
 * E-mails (normalizados) de todos os usuários ATIVOS cadastrados. A consulta usa
 * o token de quem chamou (as Rules valem) e compara em código, para ignorar
 * maiúsculas/espaços do que foi digitado no cadastro. Falha => conjunto vazio
 * (nega por padrão).
 */
export async function emailsDeUsuariosAtivos(idToken: string): Promise<Set<string>> {
  if (cacheAtivos && cacheAtivos.expira > Date.now()) return cacheAtivos.emails;
  try {
    const resposta = await fetch(urlFirestore(":runQuery"), {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "usuarios" }],
          where: { fieldFilter: { field: { fieldPath: "ativo" }, op: "EQUAL", value: { booleanValue: true } } },
          select: { fields: [{ fieldPath: "email" }] },
          limit: 5000,
        },
      }),
    });
    if (!resposta.ok) return new Set();
    const linhas = (await resposta.json()) as { document?: { fields?: { email?: { stringValue?: string } } } }[];
    const emails = new Set(
      linhas.map((l) => normalizarEmail(l.document?.fields?.email?.stringValue)).filter(Boolean),
    );
    cacheAtivos = { expira: Date.now() + 30_000, emails };
    return emails;
  } catch {
    return new Set();
  }
}

/**
 * Devolve os destinatários NÃO autorizados. Autorizado = usuário ativo
 * cadastrado (com o mesmo e-mail, ignorando caixa/espaços) OU domínio listado
 * em EMAIL_DOMINIOS_PERMITIDOS. Variável vazia = só usuários ativos; nunca
 * "qualquer destinatário".
 */
export async function destinatariosNaoAutorizados(destinos: string[], idToken: string): Promise<string[]> {
  const dominios = dominiosPermitidos();
  const ativos = await emailsDeUsuariosAtivos(idToken);
  return destinos.filter((d) => {
    const alvo = normalizarEmail(d);
    if (!emailValido(alvo)) return true;
    if (ativos.has(alvo)) return false;
    return !dominios.includes(alvo.split("@")[1]);
  });
}

/** Endpoints de push aceitos: só os serviços oficiais dos navegadores (evita SSRF). */
const HOSTS_PUSH = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)web\.push\.apple\.com$/];
export function endpointPushPermitido(endpoint: unknown): boolean {
  if (typeof endpoint !== "string") return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && HOSTS_PUSH.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

/** Tipos de arquivo aceitos no upload de documentos (extensão + mimetype). */
const TIPOS_UPLOAD: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
export function arquivoUploadPermitido(nome: string, mimetype: string): boolean {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  return !!TIPOS_UPLOAD[ext]?.includes(mimetype);
}
/** Nome de arquivo/pasta seguro: sem separadores, controle ou aspas; tamanho limitado. */
export function nomeSeguro(nome: string, max = 120): string {
  // eslint-disable-next-line no-control-regex
  return nome.replace(/[\\/\u0000-\u001f"'<>|?*:]/g, "_").replace(/^\.+/, "").trim().slice(0, max) || "arquivo";
}

/** E-mails dos masters ativos (consulta com o token de quem chamou). */
export async function emailsDosMasters(idToken: string): Promise<string[]> {
  try {
    const resposta = await fetch(urlFirestore(":runQuery"), {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "usuarios" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: "perfil" }, op: "EQUAL", value: { stringValue: "master" } } },
                { fieldFilter: { field: { fieldPath: "ativo" }, op: "EQUAL", value: { booleanValue: true } } },
              ],
            },
          },
          limit: 20,
        },
      }),
    });
    if (!resposta.ok) return [];
    const linhas = (await resposta.json()) as { document?: { fields?: { email?: { stringValue?: string } } } }[];
    return linhas.map((l) => l.document?.fields?.email?.stringValue ?? "").filter(emailValido);
  } catch {
    return [];
  }
}
