/**
 * Dispara alertas automáticos de IRPs (Intenções de Registro de Preços)
 * com prazo de manifestação próximo (marcos de 5/2/0 dias) e ainda sem
 * resposta do setor demandante, por e-mail ao responsável pela resposta,
 * rodando sozinho via GitHub Actions
 * (.github/workflows/alertas-irp.yml).
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *                                   mesmas credenciais já configuradas no
 *                                   .env da VPS pro /api/send-email
 *
 * Uso: npx tsx scripts/enviar-alertas-irp.ts
 */
import { readFileSync } from 'fs';
import nodemailer from 'nodemailer';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { IRP } from '../src/types';

const CREDENCIAIS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

const MARCOS_DIAS = [5, 2, 0];

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

async function buscarIrps(): Promise<IRP[]> {
  const credenciais = JSON.parse(readFileSync(CREDENCIAIS_PATH as string, 'utf-8'));
  initializeApp({ credential: cert(credenciais), projectId: PROJECT_ID });
  const db = getFirestore();
  const snap = await db.collection('irps').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as IRP[];
}

function marcoAlertaPrazo(diasRestantes: number): number | null {
  const marco = MARCOS_DIAS.find((m) => diasRestantes <= m);
  return marco ?? null;
}

function montarCorpoEmail(irp: IRP, diasRestantes: number): string {
  return `
    <h2>Alerta de IRP - ${irp.numeroIrp}</h2>
    <p>Prezado(a),</p>
    <p>Este é um alerta automático do sistema informando que a IRP <b>${irp.numeroIrp}</b>
    (${irp.orgaoGerenciador} — ${irp.esferaOrgao}) ainda não teve manifestação de interesse
    registrada, e o prazo final se encerra em <b>${diasRestantes <= 0 ? 'hoje' : `${diasRestantes} dia(s)`}</b>.</p>
    <hr/>
    <p><b>Objeto:</b> ${irp.objeto}</p>
    <p><b>Prazo final para manifestação:</b> ${new Date(irp.prazoManifestacao).toLocaleDateString('pt-BR')}</p>
    <p><b>Setores demandantes:</b> ${irp.setoresDemandantes.join(', ') || '-'}</p>
  `;
}

async function main() {
  validarConfiguracao();

  const irps = await buscarIrps();
  const hoje = new Date();
  const transportador = criarTransportador();

  // Só IRPs ainda em aberto (sem manifestação/resposta definitiva) geram
  // alerta — as demais já tiveram desfecho e não precisam mais de aviso.
  const irpsPendentes = irps.filter((i) => i.status === 'aberta' || i.status === 'em_analise');

  let enviados = 0;
  let semEmail = 0;
  let comErro = 0;

  for (const irp of irpsPendentes) {
    const prazo = new Date(irp.prazoManifestacao);
    if (Number.isNaN(prazo.getTime())) continue;

    const diasRestantes = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const marco = marcoAlertaPrazo(diasRestantes);
    if (marco === null) continue;

    const destinatario = irp.responsavelRespostaEmail;
    if (!destinatario) {
      console.warn(`IRP ${irp.numeroIrp} tem alerta pendente (prazo em ${diasRestantes} dia(s)) mas não tem e-mail de responsável pela resposta cadastrado.`);
      semEmail++;
      continue;
    }

    try {
      await transportador.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: destinatario,
        subject: `[ALERTA AUTOMÁTICO] IRP ${irp.numeroIrp} - Prazo de Manifestação Próximo`,
        html: montarCorpoEmail(irp, diasRestantes),
      });
      console.log(`Alerta enviado: IRP ${irp.numeroIrp} -> ${destinatario} (prazo em ${diasRestantes} dia(s))`);
      enviados++;
    } catch (erro) {
      console.error(`Erro ao enviar alerta da IRP ${irp.numeroIrp}:`, erro);
      comErro++;
    }
  }

  console.log(`\nResumo: ${enviados} enviado(s), ${semEmail} sem e-mail de responsável, ${comErro} com erro.`);
}

main().catch((erro) => {
  console.error('Falha ao processar os alertas de IRP:', erro);
  process.exit(1);
});
