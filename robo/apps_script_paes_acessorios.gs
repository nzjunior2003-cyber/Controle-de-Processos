// ============================================================================
// PAEs ACESSÓRIOS — bloco para COLAR NO FIM do Apps Script da planilha
// (usa as funções que o script já tem: tokenOk, respostaJson, agoraBr).
//
// Além de colar este bloco, são só 2 mudanças no código existente:
//
// 1) No doGet, no JSON final, acrescente a linha paes_acessorios:
//        return ContentService.createTextOutput(JSON.stringify({
//          status: "success",
//          total: processos.length,
//          processos: processos,
//          paes_acessorios: paesAcessoriosParaRobo()      // <-- NOVA LINHA (não esqueça da vírgula acima)
//        })).setMimeType(ContentService.MimeType.JSON);
//
// 2) No doPost, logo depois da linha  if (payload.acao === "gravar_ordens") ...
//        if (payload.acao === "gravar_paes_acessorios") return gravarPaesAcessorios(payload);
//        if (payload.acao === "atualizar_paes_acessorios") return atualizarPaesAcessorios(payload);
//
// Depois: Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar.
// A aba PAES_ACESSORIOS é criada sozinha na primeira gravação.
// ============================================================================

var ABA_PAES_ACESSORIOS = "PAES_ACESSORIOS";
var CABECALHO_PAES = ["pae", "escopo", "referencia", "finalidade", "relatorio",
  "setor_atual", "ultima_tramitacao", "situacao", "consultado_em"];

/** "E-2026/2617141", "2026-2617141" -> "20262617141" (vazio se não for PAE). */
function chavePaes(texto) {
  var m = String(texto || "").match(/(\d{4})\s*[\/-]\s*(\d+)/);
  return m ? m[1] + m[2] : "";
}

function abaPaesAcessorios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_PAES_ACESSORIOS);
  if (!aba) {
    var abaAtiva = ss.getActiveSheet();
    aba = ss.insertSheet(ABA_PAES_ACESSORIOS);
    ss.setActiveSheet(abaAtiva);
    aba.getRange(1, 1, 1, CABECALHO_PAES.length).setValues([CABECALHO_PAES]);
    aba.setFrozenRows(1);
  }
  // Texto puro: o Sheets não pode transformar "2026/10" em data.
  aba.getRange(1, 1, Math.max(aba.getMaxRows(), 2), CABECALHO_PAES.length).setNumberFormat("@");
  return aba;
}

function lerPaesAcessorios() {
  var aba = abaPaesAcessorios();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  return aba.getRange(2, 1, ultima - 1, CABECALHO_PAES.length).getValues().map(function (l) {
    return {
      pae: String(l[0]), escopo: String(l[1]), referencia: String(l[2]), finalidade: String(l[3]),
      relatorio: String(l[4]).toUpperCase() === "SIM",
      setor_atual: String(l[5]), ultima_tramitacao: String(l[6]), situacao: String(l[7]), consultado_em: String(l[8])
    };
  });
}

/**
 * Lista que o robô consulta (chave paes_acessorios do doGet). Nunca derruba o
 * doGet: se algo falhar aqui, o robô segue com os processos normais.
 */
function paesAcessoriosParaRobo() {
  try {
    return lerPaesAcessorios().filter(function (p) { return chavePaes(p.pae); });
  } catch (erro) {
    return [];
  }
}

/**
 * Sistema -> planilha: reescreve a lista inteira. O que o robô já achou
 * (setor, tramitação, situação, data) é mantido para os PAEs que continuam na lista.
 */
function gravarPaesAcessorios(payload) {
  if (!tokenOk(payload.token)) return respostaJson({ status: "erro", erro: "Token inválido." });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var anteriores = {};
    lerPaesAcessorios().forEach(function (p) { anteriores[chavePaes(p.pae)] = p; });
    var vistos = {};
    var linhas = [];
    (payload.itens || []).forEach(function (i) {
      var chave = chavePaes(i.pae);
      if (!chave || vistos[chave]) return;
      vistos[chave] = true;
      var antes = anteriores[chave] || {};
      linhas.push([String(i.pae), String(i.escopo || ""), String(i.referencia || ""), String(i.finalidade || ""),
        i.relatorio ? "SIM" : "NÃO", antes.setor_atual || "", antes.ultima_tramitacao || "", antes.situacao || "", antes.consultado_em || ""]);
    });
    var aba = abaPaesAcessorios();
    var ultima = aba.getLastRow();
    if (ultima > 1) aba.getRange(2, 1, ultima - 1, CABECALHO_PAES.length).clearContent();
    if (linhas.length) aba.getRange(2, 1, linhas.length, CABECALHO_PAES.length).setValues(linhas);
    return respostaJson({ status: "success", gravados: linhas.length });
  } finally {
    lock.releaseLock();
  }
}

/** Robô -> planilha: grava o resultado da consulta de cada PAE acessório. */
function atualizarPaesAcessorios(payload) {
  if (!tokenOk(payload.token)) return respostaJson({ status: "erro", erro: "Token inválido." });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var aba = abaPaesAcessorios();
    var ultima = aba.getLastRow();
    if (ultima < 2) return respostaJson({ status: "success", atualizados: 0 });
    var linhaPorChave = {};
    aba.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (l, idx) {
      linhaPorChave[chavePaes(l[0])] = idx + 2;
    });
    var agora = agoraBr();
    var feitos = 0;
    (payload.atualizacoes || []).forEach(function (a) {
      var linha = linhaPorChave[chavePaes(a.pae)];
      if (!linha) return;
      var situacao = String(a.situacao || "");
      if (situacao === "SUCESSO") {
        // Setor e tramitação só mudam quando a consulta deu certo.
        aba.getRange(linha, 6, 1, 4).setValues([[String(a.setor_atual || ""), String(a.ultima_tramitacao || ""), situacao, agora]]);
      } else {
        aba.getRange(linha, 8, 1, 2).setValues([[situacao + (a.motivo ? ": " + a.motivo : ""), agora]]);
      }
      feitos++;
    });
    return respostaJson({ status: "success", atualizados: feitos });
  } finally {
    lock.releaseLock();
  }
}
