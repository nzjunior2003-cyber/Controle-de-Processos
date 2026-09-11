#!/usr/bin/env node
/**
 * Reconstrói a coleção `busca_publica` (leitura liberada a qualquer um,
 * sem login — ver firestore.rules) a partir de `processos` e `contratos`
 * — um resumo de cada um com os campos de transparência pedidos (nunca o
 * documento inteiro: sem CNPJ, contatos, e-mails etc.), pra alimentar a
 * busca pública da tela inicial (PublicHome.tsx).
 *
 * Pensado pra rodar periodicamente via GitHub Actions (ver
 * .github/workflows/atualizar-busca-publica.yml), usando a mesma conta
 * de serviço já usada pro backup e pelos alertas.
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *
 * Uso: node scripts/atualizar-busca-publica.mjs
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { differenceInDays } from 'date-fns';

const CREDENCIAIS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

function validarConfiguracao() {
  const faltando = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PROJECT_ID'].filter(
    (chave) => !process.env[chave],
  );
  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
}

/** Aplica até 500 operações de um array por vez (limite de um batch do Firestore). */
async function aplicarEmLotes(db, operacoes) {
  for (let inicio = 0; inicio < operacoes.length; inicio += 450) {
    const lote = db.batch();
    operacoes.slice(inicio, inicio + 450).forEach((op) => op(lote));
    await lote.commit();
  }
}

async function main() {
  validarConfiguracao();

  const credenciais = JSON.parse(readFileSync(CREDENCIAIS_PATH, 'utf-8'));
  initializeApp({ credential: cert(credenciais), projectId: PROJECT_ID });
  const db = getFirestore();

  const [processosSnap, contratosSnap, estadasSnap, atualSnap] = await Promise.all([
    db.collection('processos').get(),
    db.collection('contratos').get(),
    db.collection('estadas_processo').get(),
    db.collection('busca_publica').get(),
  ]);

  // Estada em curso (data_fim vazia) de cada processo, pra calcular há
  // quantos dias ele está no setor/localização atual.
  const estadaEmCursoPorProcesso = new Map();
  estadasSnap.docs.forEach((doc) => {
    const e = doc.data();
    if (e.data_fim || !e.processo_id || !e.data_inicio) return;
    estadaEmCursoPorProcesso.set(e.processo_id, e);
  });

  const agora = new Date();
  const esperados = new Map();
  processosSnap.docs.forEach((doc) => {
    const p = doc.data();
    if (!p.numero_processo) return;
    const estadaAtual = estadaEmCursoPorProcesso.get(doc.id);
    const diasNoSetorAtual = estadaAtual
      ? Math.max(0, differenceInDays(agora, new Date(estadaAtual.data_inicio)))
      : null;
    esperados.set(`processo_${doc.id}`, {
      tipo: 'processo',
      numero: p.numero_processo,
      objeto: p.objeto ?? '',
      setorAtual: p.localizacao_atual ?? null,
      andamento: p.andamento ?? null,
      fonte: p.fonte ?? null,
      naturezaDespesa: p.natureza_despesa ?? null,
      valorEstimado: p.valor_estimado ?? null,
      diasNoSetorAtual,
    });
  });
  contratosSnap.docs.forEach((doc) => {
    const c = doc.data();
    if (!c.numero) return;
    esperados.set(`contrato_${doc.id}`, {
      tipo: 'contrato',
      numero: c.numero,
      empresa: c.empresa ?? '',
      objeto: c.objeto ?? '',
      valorGlobal: c.valorGlobal ?? null,
      saldoAtualFinanceiro: c.saldoAtualFinanceiro ?? null,
      fiscalTitular: c.fiscalTitular ?? null,
      inicioVigencia: c.inicioVigencia ?? null,
      fimVigencia: c.fimVigencia ?? null,
    });
  });

  const idsAtuais = new Set(atualSnap.docs.map((doc) => doc.id));
  const idsRemovidos = [...idsAtuais].filter((id) => !esperados.has(id));
  const operacoes = [];

  for (const [id, dados] of esperados) {
    operacoes.push((lote) => lote.set(db.collection('busca_publica').doc(id), dados));
  }
  for (const id of idsRemovidos) {
    operacoes.push((lote) => lote.delete(db.collection('busca_publica').doc(id)));
  }

  await aplicarEmLotes(db, operacoes);

  console.log(
    `Índice público atualizado: ${esperados.size} registro(s) (${processosSnap.size} processo(s), ${contratosSnap.size} contrato(s)), ${idsRemovidos.length} removido(s) por não existirem mais.`,
  );
}

main().catch((erro) => {
  console.error('Falha ao atualizar o índice de busca pública:', erro);
  process.exit(1);
});
