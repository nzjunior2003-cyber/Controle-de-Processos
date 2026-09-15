#!/usr/bin/env node
/**
 * Limpa `fiscalTitular`/`fiscalSuplente` de contratos onde o valor
 * gravado não parece um nome de verdade (ex.: "R$ 22.420,00") — sinal de
 * que, na sincronização com a planilha, a linha caiu no offset errado de
 * layout (ver `detectarOffsetContrato` em src/lib/planilhaContratos.ts,
 * já corrigido pra não acontecer de novo em sincronizações futuras).
 * Este script só limpa o que já ficou gravado errado antes da correção.
 *
 * Por padrão roda em modo "só listar" (não grava nada) — passe
 * APLICAR=true pra gravar de verdade.
 *
 * Variáveis de ambiente esperadas:
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON da conta de serviço
 *   FIREBASE_PROJECT_ID             id do projeto Firebase/GCP
 *   APLICAR                         "true" pra gravar as correções (padrão: só lista)
 *
 * Uso:
 *   node scripts/corrigir-fiscal-invalido.mjs            # só lista o que seria corrigido
 *   APLICAR=true node scripts/corrigir-fiscal-invalido.mjs  # corrige de verdade
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const CREDENCIAIS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const APLICAR = process.env.APLICAR === 'true';

function validarConfiguracao() {
  const faltando = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PROJECT_ID'].filter(
    (chave) => !process.env[chave],
  );
  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
}

/** Mesma regra de src/lib/contratos.ts (pareceNomeDeFiscal) — duplicada aqui porque este script roda fora do bundle TS do app. */
function pareceNomeDeFiscal(texto) {
  const valor = texto.trim();
  if (!valor) return false;
  if (/^r\$/i.test(valor)) return false;
  if (/^-?\d+([.,]\d+)?$/.test(valor)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(valor)) return false;
  return /[a-zà-öø-ÿ]/i.test(valor);
}

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

  const snapshot = await db.collection('contratos').get();
  const operacoes = [];
  let afetados = 0;

  for (const doc of snapshot.docs) {
    const contrato = doc.data();
    const correcoes = {};

    for (const campo of ['fiscalTitular', 'fiscalSuplente']) {
      const valor = contrato[campo];
      if (typeof valor === 'string' && valor.trim() && !pareceNomeDeFiscal(valor)) {
        correcoes[campo] = '';
      }
    }

    if (Object.keys(correcoes).length === 0) continue;

    afetados++;
    const anteriores = Object.fromEntries(Object.keys(correcoes).map((campo) => [campo, contrato[campo]]));
    console.log(
      `Contrato ${contrato.numero ?? doc.id} (${doc.id}): limpar ${JSON.stringify(anteriores)}`,
    );

    if (APLICAR) {
      operacoes.push((lote) =>
        lote.update(doc.ref, { ...correcoes, atualizado_em: new Date().toISOString() }),
      );
    }
  }

  if (APLICAR && operacoes.length > 0) {
    await aplicarEmLotes(db, operacoes);
  }

  console.log(
    `\n${afetados} contrato(s) com Fiscal Titular/Suplente inválido encontrado(s).` +
      (APLICAR
        ? ' Corrigido(s) — os contratos afetados ficam sem nome de fiscal até alguém reeditar e reinserir o correto.'
        : ' Nada foi gravado (modo só-listar) — rode de novo com APLICAR=true pra corrigir de verdade.'),
  );
}

main().catch((erro) => {
  console.error('Falha ao corrigir Fiscal Titular/Suplente inválidos:', erro);
  process.exit(1);
});
