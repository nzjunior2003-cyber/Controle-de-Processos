/**
 * Dispara os alertas automáticos de contratos — vencimento nos marcos de
 * 90/60/30 dias (ver `marcoAlertaVencimento`) e saldo baixo (≤ 20%) — por
 * e-mail aos fiscais, rodando sozinho via GitHub Actions
 * (.github/workflows/alertas-contratos.yml), sem precisar abrir o app e
 * clicar em "Disparar Emails" no Painel de Alertas manualmente.
 *
 * Mesma regra de negócio do painel manual (src/components/AlertasModal.tsx)
 * — importada diretamente daqui pra nunca divergir das duas.
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *                                   mesmas credenciais já configuradas no
 *                                   .env da VPS pro /api/send-email
 *
 * Uso: npx tsx scripts/enviar-alertas-contratos.ts
 */
import { readFileSync } from 'fs';
import nodemailer from 'nodemailer';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { marcoAlertaVencimento, formatarMoeda, type ExecucaoContrato } from '../src/lib/contratos';
import type { Contrato } from '../src/types';

const CREDENCIAIS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

function validarConfiguracao() {
  const faltando = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PROJECT_ID', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    .filter((chave) => !process.env[chave]);
  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
}

function criarTransportador() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function buscarDados() {
  const credenciais = JSON.parse(readFileSync(CREDENCIAIS_PATH as string, 'utf-8'));
  initializeApp({ credential: cert(credenciais), projectId: PROJECT_ID });
  const db = getFirestore();

  const [contratosSnap, execucoesSnap] = await Promise.all([
    db.collection('contratos').get(),
    db.collection('execucoes').get(),
  ]);

  const contratos = contratosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Contrato[];
  const execucoes = execucoesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ExecucaoContrato[];
  return { contratos, execucoes };
}

function saldoDoContrato(contrato: Contrato, execucoes: ExecucaoContrato[]): number {
  const executado = execucoes
    .filter((e) => e.contratoId === contrato.id)
    .reduce((acc, atual) => acc + atual.valor, 0);
  return contrato.saldoAtualFinanceiro ?? (contrato.valorGlobal || 0) - executado;
}

function montarCorpoEmail(
  contrato: Contrato,
  motivos: string[],
  saldo: number,
): string {
  return `
    <h2>Alerta de Contrato - ${contrato.numero}</h2>
    <p>Prezado Fiscal,</p>
    <p>Este é um alerta automático do sistema informando as seguintes urgências para o contrato <b>${contrato.numero}</b> (${contrato.empresa}):</p>
    <ul>${motivos.map((m) => `<li><b>Atenção:</b> ${m}</li>`).join('')}</ul>
    <p>Lembre-se também de observar o prazo regular para o envio e conferência de Notas Fiscais/Faturas e recibos para pagamento em tempo hábil.</p>
    <hr/>
    <p><b>Dados do Contrato:</b></p>
    <p>Fim da Vigência: ${contrato.fimVigencia}<br/>Saldo Atual: ${formatarMoeda(saldo)}</p>
  `;
}

async function main() {
  validarConfiguracao();

  const { contratos, execucoes } = await buscarDados();
  const hoje = new Date();
  const transportador = criarTransportador();

  // Contratos já concluídos não geram alerta, mesmo com vigência vencida
  // ou saldo baixo — não há mais nada a fazer.
  const contratosAtivos = contratos.filter((c) => !c.concluido);

  let enviados = 0;
  let semEmail = 0;
  let comErro = 0;

  for (const contrato of contratosAtivos) {
    const motivos: string[] = [];

    if (contrato.fimVigencia) {
      const fim = new Date(contrato.fimVigencia);
      if (!Number.isNaN(fim.getTime())) {
        const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const marco = marcoAlertaVencimento(diasRestantes);
        if (marco !== null) motivos.push(`vencimento em até ${marco} dias`);
      }
    }

    const saldo = saldoDoContrato(contrato, execucoes);
    if (contrato.valorGlobal && (saldo / contrato.valorGlobal) * 100 <= 20) {
      motivos.push('saldo baixo (< 20%)');
    }

    if (motivos.length === 0) continue;

    const destinatario = contrato.fiscalEmail || contrato.contatoEmail;
    if (!destinatario) {
      console.warn(`Contrato ${contrato.numero} tem alerta pendente (${motivos.join(', ')}) mas não tem e-mail de fiscal cadastrado.`);
      semEmail++;
      continue;
    }

    try {
      await transportador.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: destinatario,
        subject: `[ALERTA AUTOMÁTICO] Contrato ${contrato.numero} - Ações Necessárias`,
        html: montarCorpoEmail(contrato, motivos, saldo),
      });
      console.log(`Alerta enviado: contrato ${contrato.numero} -> ${destinatario} (${motivos.join(', ')})`);
      enviados++;
    } catch (erro) {
      console.error(`Erro ao enviar alerta do contrato ${contrato.numero}:`, erro);
      comErro++;
    }
  }

  console.log(`\nResumo: ${enviados} enviado(s), ${semEmail} sem e-mail de fiscal, ${comErro} com erro.`);
}

main().catch((erro) => {
  console.error('Falha ao processar os alertas:', erro);
  process.exit(1);
});
