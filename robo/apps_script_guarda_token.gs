// ============================================================================
// GUARDA DE TOKEN — para colar no Apps Script da planilha (substitui o tokenOk
// atual) e publicar JUNTO com o servidor/robô desta versão.
//
// 1) Configurações do projeto > Propriedades do script: TOKEN_ROBO = <senha longa>.
//    (A MESMA senha vai em ROBO_TOKEN no .env do servidor/robô e no campo
//    "Senha do robô" dos PCs.) Sem TOKEN_ROBO definido, TUDO é negado.
// 2) Troque a função tokenOk existente por esta (falha fechada):
function tokenOk(token) {
  var esperado = PropertiesService.getScriptProperties().getProperty("TOKEN_ROBO");
  if (!esperado || !token) return false;
  // comparação em tempo constante (não vaza onde a senha difere)
  var a = String(token), b = String(esperado), dif = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return dif === 0;
}

// 3) Exija o token em TODA entrada. No INÍCIO do doGet (antes de ler a planilha):
//      if (!tokenOk(e && e.parameter && e.parameter.token)) {
//        return respostaJson({ status: "erro", erro: "Não autorizado." });
//      }
//    No INÍCIO do doPost, depois de ler o payload (vale para TODAS as ações:
//    status_robo, atualizacoes, enviar_relatorio, gravar_ordens, solicitar_execucao,
//    sinal_vigia, reivindicar_*, gravar_paes_acessorios, atualizar_paes_acessorios):
//      if (!tokenOk(payload.token)) {
//        return respostaJson({ status: "erro", erro: "Não autorizado." });
//      }
//    Em enviar_relatorio, ignore o campo "destinatario" vindo do pedido e use
//    um e-mail fixo guardado em Propriedades do script (EMAIL_RELATORIO).
//
// 4) Implantar > Gerenciar implantações > lápis > Nova versão > Implantar.
//    Ordem segura: (a) defina TOKEN_ROBO; (b) publique o servidor+robô novos;
//    (c) publique a nova versão do Apps Script. Robôs antigos (sem token nas
//    gravações) param de gravar a partir do passo (c) — atualize os PCs antes.
// ============================================================================
