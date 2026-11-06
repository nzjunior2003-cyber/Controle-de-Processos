/**
 * PAEs acessórios — trecho para ACRESCENTAR ao Apps Script da planilha
 * (o mesmo projeto que já tem doGet/doPost do robô). Não substitui nada.
 *
 * Aba criada sozinha: PAES_ACESSORIOS
 *   pae | escopo | referencia | finalidade | relatorio | setor_atual | ultima_tramitacao | situacao | consultado_em
 *
 * Como ligar ao código que você já tem (3 pequenas inclusões):
 *
 * 1) No doGet(e) que devolve { processos: [...] } ao robô, acrescente a chave:
 *        paes_acessorios: paesAcessoriosParaRobo_()
 *
 * 2) No doPost(e), onde o código decide pelo campo "acao" (como "gravar_ordens"),
 *    acrescente dois casos (dados = JSON já lido do corpo do pedido):
 *        if (dados.acao === 'gravar_paes_acessorios') {      // vem do sistema (servidor)
 *          if (!tokenPaesOk_(dados.token)) return respostaPaes_({ status: 'error', erro: 'Token inválido' });
 *          return respostaPaes_({ status: 'success', gravados: gravarPaesAcessorios_(dados.itens || []) });
 *        }
 *        if (dados.acao === 'atualizar_paes_acessorios') {   // vem do robô
 *          if (!tokenPaesOk_(dados.token)) return respostaPaes_({ status: 'error', erro: 'Token inválido' });
 *          return respostaPaes_({ status: 'success', atualizados: atualizarPaesAcessorios_(dados.atualizacoes || []) });
 *        }
 *    Se o seu doPost já tem função própria para conferir o token, use-a no lugar de tokenPaesOk_
 *    e de respostaPaes_ (devolver JSON no mesmo formato dos outros casos).
 *
 * 3) Salve e publique NOVA VERSÃO (Implantar > Gerenciar implantações > lápis > Nova versão).
 */

var ABA_PAES_ACESSORIOS = 'PAES_ACESSORIOS';
var CABECALHO_PAES = ['pae', 'escopo', 'referencia', 'finalidade', 'relatorio',
  'setor_atual', 'ultima_tramitacao', 'situacao', 'consultado_em'];

function tokenPaesOk_(token) {
  var esperado = PropertiesService.getScriptProperties().getProperty('TOKEN_ROBO');
  return !!esperado && String(token) === esperado;
}

function respostaPaes_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

/** "E-2026/2617141", "2026-2617141" -> "20262617141" (vazio se não for PAE). */
function chavePaes_(texto) {
  var m = String(texto || '').match(/(\d{4})\s*[\/-]\s*(\d+)/);
  return m ? m[1] + m[2] : '';
}

function abaPaesAcessorios_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_PAES_ACESSORIOS);
  if (!aba) {
    aba = planilha.insertSheet(ABA_PAES_ACESSORIOS);
    aba.getRange(1, 1, 1, CABECALHO_PAES.length).setValues([CABECALHO_PAES]);
    aba.setFrozenRows(1);
  }
  // Texto puro: o Sheets não pode transformar "2026/10" em data.
  aba.getRange(1, 1, Math.max(aba.getMaxRows(), 2), CABECALHO_PAES.length).setNumberFormat('@');
  return aba;
}

function lerPaesAcessorios_() {
  var aba = abaPaesAcessorios_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  return aba.getRange(2, 1, ultima - 1, CABECALHO_PAES.length).getValues().map(function (l) {
    return {
      pae: String(l[0]), escopo: String(l[1]), referencia: String(l[2]), finalidade: String(l[3]),
      relatorio: String(l[4]).toUpperCase() === 'SIM',
      setor_atual: String(l[5]), ultima_tramitacao: String(l[6]), situacao: String(l[7]), consultado_em: String(l[8])
    };
  });
}

/** Lista que o robô consulta (vai na chave paes_acessorios do doGet). */
function paesAcessoriosParaRobo_() {
  return lerPaesAcessorios_().filter(function (p) { return chavePaes_(p.pae); });
}

/**
 * Sistema -> planilha: reescreve a lista inteira. O que o robô já achou
 * (setor, tramitação, situação, data) é mantido para os PAEs que continuam na lista.
 */
function gravarPaesAcessorios_(itens) {
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    var anteriores = {};
    lerPaesAcessorios_().forEach(function (p) { anteriores[chavePaes_(p.pae)] = p; });
    var vistos = {};
    var linhas = [];
    itens.forEach(function (i) {
      var chave = chavePaes_(i.pae);
      if (!chave || vistos[chave]) return;
      vistos[chave] = true;
      var antes = anteriores[chave] || {};
      linhas.push([String(i.pae), String(i.escopo || ''), String(i.referencia || ''), String(i.finalidade || ''),
        i.relatorio ? 'SIM' : 'NÃO', antes.setor_atual || '', antes.ultima_tramitacao || '', antes.situacao || '', antes.consultado_em || '']);
    });
    var aba = abaPaesAcessorios_();
    var ultima = aba.getLastRow();
    if (ultima > 1) aba.getRange(2, 1, ultima - 1, CABECALHO_PAES.length).clearContent();
    if (linhas.length) aba.getRange(2, 1, linhas.length, CABECALHO_PAES.length).setValues(linhas);
    return linhas.length;
  } finally {
    trava.releaseLock();
  }
}

/** Robô -> planilha: grava o resultado da consulta de cada PAE acessório. */
function atualizarPaesAcessorios_(atualizacoes) {
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    var aba = abaPaesAcessorios_();
    var ultima = aba.getLastRow();
    if (ultima < 2) return 0;
    var linhaPorChave = {};
    aba.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (l, idx) {
      linhaPorChave[chavePaes_(l[0])] = idx + 2;
    });
    var agora = Utilities.formatDate(new Date(), 'America/Belem', 'dd/MM/yyyy HH:mm:ss');
    var feitos = 0;
    atualizacoes.forEach(function (a) {
      var linha = linhaPorChave[chavePaes_(a.pae)];
      if (!linha) return;
      var situacao = String(a.situacao || '');
      if (situacao === 'SUCESSO') {
        // Setor e tramitação só mudam quando a consulta deu certo.
        aba.getRange(linha, 6, 1, 4).setValues([[String(a.setor_atual || ''), String(a.ultima_tramitacao || ''), situacao, agora]]);
      } else {
        aba.getRange(linha, 8, 1, 2).setValues([[situacao + (a.motivo ? ': ' + a.motivo : ''), agora]]);
      }
      feitos++;
    });
    return feitos;
  } finally {
    trava.releaseLock();
  }
}
