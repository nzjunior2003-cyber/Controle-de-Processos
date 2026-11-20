# Segurança — Sistema de Controle de Processos (CBMPA)

Documento vivo. Status: **Fase 1 implementada na branch, aguardando aprovação da matriz de permissões e publicação**. Marcações `[a confirmar]` dependem de decisão ou acesso do responsável.

## 1. O que foi corrigido (Fase 1)

| Área | Mudança |
|---|---|
| Servidor (`server.ts`, `server/seguranca.ts`) | Middleware único: ID token válido **+ usuário ativo + perfil permitido por rota**; validação de entrada com zod; limite de corpo (512 KB) e de upload (50 MB, 1 arquivo); `helmet` (HSTS, nosniff, frame-ancestors, CSP em modo *report-only*); rate limit por IP (geral, envios e pedido de acesso); CORS fechado (só a própria origem); erros genéricos; `x-powered-by` desligado. |
| E-mail | Destinatário só entre **usuários ativos cadastrados** ou domínios em `EMAIL_DOMINIOS_PERMITIDOS`; HTML recebido é sanitizado; textos de formulários são escapados nos e-mails (cliente). |
| Pedido de acesso | O aviso aos masters passou para `POST /api/acesso/notificar`: o servidor monta a mensagem a partir do cadastro (não do corpo da requisição). |
| Drive | Upload só de PDF/imagem/Word/Excel; nome de arquivo/pasta saneado; **sem link público** — leitura por `GET /api/drive/arquivo/:id` (autenticada, restrita à pasta "Documentos de Contratos"). |
| Push | Só endpoints oficiais de push dos navegadores (anti-SSRF), payload validado e limitado. |
| Planilhas | Texto gravado em planilha ganha proteção contra injeção de fórmula. |
| Links | Só `http(s)` é aberto, sempre com `noopener,noreferrer`. |
| Firestore Rules | Autocadastro só como `fiscal` **inativo**, com o próprio e-mail e só campos do formulário; usuário não muda perfil/ativo/e-mail/MF/unidade; `matriculas` só por `get` (sem listar); `processos` com exclusão lógica; auditoria só em nome de si mesmo e só por ativo; limites nos logs; nega por padrão. **1270 testes no emulador** (`npm run test:rules`), rodando no CI antes da publicação. |
| Processos | Exclusão **lógica** (`excluido`, `excluido_em`, `excluido_por`), só master/contratos/apoio; apagar de vez só o master (pelo console). Diagnóstico/limpeza também passou a ser lógico (reversível). |

## 2. Matriz de permissões (Firestore Rules)

Fonte: `firestore-tests/matriz.ts` (os testes são gerados dela). Perfis: master, contratos, apoio, gestao, fiscal, bm4, financeiro, dga, dal, df, dca, demandante. "todos ativos" = qualquer usuário aprovado. Usuário inativo/anônimo: nada (exceto `busca_publica` e `get` de `matriculas`).

| Coleção | Ler | Criar | Editar | Apagar |
|---|---|---|---|---|
| processos | todos ativos | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master |
| movimentacoes | todos ativos | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante |
| estadas_processo | todos ativos | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante |
| alertas | todos ativos | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante |
| pareceres | todos ativos | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante | master, contratos, apoio, gestao, fiscal, financeiro, demandante |
| pcas | todos ativos | master, bm4 | master, bm4 | master, bm4 |
| contratos | todos ativos | master, contratos, gestao | master, contratos, gestao | master |
| execucoes | todos ativos | master, contratos, gestao | master, contratos, gestao | master, contratos, gestao |
| ocorrencias | todos ativos | master, contratos, gestao | master, contratos, gestao | master, contratos, gestao |
| aditivos | todos ativos | master, contratos, gestao | master, contratos, gestao | master, contratos, gestao |
| procedimentos | todos ativos | master, contratos | master, contratos | master, contratos |
| sancionatorios | todos ativos | master, contratos | master, contratos | master, contratos |
| portarias | todos ativos | master, contratos | master, contratos | master, contratos |
| irps | todos ativos | master, bm4 | master, bm4 | master, bm4 |
| sincronizacoes | master, apoio, contratos, gestao | master, apoio, contratos, gestao | master, apoio, contratos, gestao | master, apoio, contratos, gestao |
| pagamentos | todos ativos | master, financeiro | master, financeiro | master, financeiro |
| empenhos | todos ativos | master, financeiro | master, financeiro | master, financeiro |
| dotacoes | todos ativos | master, financeiro | master, financeiro | master, financeiro |
| aditivos_arp | todos ativos | master, contratos | master, contratos | master, contratos |
| apostilamentos | todos ativos | master, contratos, gestao | master, contratos, gestao | master, contratos, gestao |
| ajustes_rito | todos ativos | master | master | master |
| catalogo_orcamentario | todos ativos | master, financeiro, apoio, contratos, gestao | master, financeiro, apoio, contratos, gestao | master, financeiro |
| usuarios | todos ativos | master | master | master |
| logs_acesso | master | — | — | — |
| logs_auditoria | master | — | — | — |

Casos especiais (testados): fiscal do contrato altera só campos de saldo e cria execução/ocorrência do **próprio** contrato; financeiro altera só saldo/dotação do contrato; demandante responde só IRP da própria unidade e só campos de resposta; `notificacoes` e `push_subscriptions` só do dono; processos: marcar como excluído só master/contratos/apoio. Campos do fluxo de compras em `processos` (etapa atual, rito do fluxo e as 5 decisões): só master/apoio/contratos; `etapaConfirmadaPor` = uid de quem grava; etapa E01–E35, origem auto/manual, rito e decisões validados. `config_fluxo/prazos` (prazos do fluxo de compras): leitura para todo usuário ativo; escrita só Master e perfil `dal`, só o documento `prazos`, chaves E01–E35/ritos válidos, números de 0 a 365 e `atualizado_por` = uid de quem grava.

## 3. Pendente / decisão do responsável

- `[a confirmar]` Restringir leitura de `usuarios`, exigir e-mail verificado, App Check, porta 3001 — **não aplicados** (podem travar usuários); só com aviso.
- Leitura de `push_subscriptions` por qualquer ativo (necessária hoje para o disparo de push) — Fase 2: mover o disparo para o servidor.
- `logs_acesso` continua com criação pública (necessário para registrar logins falhos); limitado por formato/tamanho.
- Fase 2: backup cifrado diário no Drive (todas as coleções; retenção 7/4/6; teste de restauração), dependências/Dependabot/`npm audit`, CI/CD (pin de Actions, permissões mínimas), Docker/VPS (usuário não-root, healthcheck, ufw/fail2ban/SSH por chave).
- Fase 3: App Check, CSP obrigatória, 2FA, monitoramento, LGPD.

## 4. Variáveis novas (`.env` do servidor)

- `EMAIL_DOMINIOS_PERMITIDOS` — **deixar VAZIO** (decisão: a equipe usa Gmail/Hotmail etc.). Vazio = só recebem e-mail do sistema **usuários ATIVOS cadastrados** (a comparação ignora maiúsculas/minúsculas e espaços); nunca significa "qualquer destinatário" (coberto por teste). Fiscal sem cadastro ativo **não recebe** e-mail: a tela mostra "Destinatário sem cadastro ativo no sistema: <e-mail>…", e a aba "Fiscais e Suplentes" de Gestão de Contratos lista os contratos cujo fiscal não tem cadastro ativo.
- `ACESSO_NOTIFICAR_EMAILS` — quem recebe o aviso de novo pedido de acesso (vazio = masters ativos).

## 5. Dependência das planilhas públicas

Se o compartilhamento das planilhas for restringido, **quebram** (leitura direta do navegador, via link público): sincronização de processos, status do robô, etapas dos ritos, busca de militares no cadastro/login, sincronização do PCA e o diagnóstico. **Não dependem** do link público: o robô (usa a URL do Apps Script), gravações dos usuários (OAuth do próprio usuário) e o servidor (OAuth institucional). Por isso: só restrinja o compartilhamento depois de a leitura passar pelo servidor (próximo passo).

## 5.1 Pendências da Fase 2 — escopo de escrita em processos

Perfis que escrevem em `processos`, `movimentacoes`, `estadas_processo`, `alertas` e `pareceres` (todos menos dga, dal, df, dca e bm4): **master, contratos, apoio, gestao, fiscal, financeiro e demandante** (7 de 12).

- As Rules **não** limitam por unidade nem por perfil além dessa lista: um `fiscal` ou `demandante` ativo consegue, chamando o Firestore diretamente (fora da tela), **editar processos de outras unidades**. A tela só oferece edição a master/apoio, mas isso é só interface.
- Todos os perfis ativos também **leem** todos os processos de todas as unidades.
- Fase 2: restringir `fiscal`/`demandante`/`financeiro` a leitura (ou a campos específicos) e, para `demandante`, limitar por `unidade_demandante`; testar no emulador antes de publicar. `[a confirmar]` o desenho com o responsável (alguns fluxos, como notificações e dotação, escrevem nessas coleções hoje).

## 6. Apps Script do robô `[a confirmar]`

O robô (código no repositório) agora envia o `TOKEN_ROBO` em **todas** as chamadas (antes faltava na leitura da lista, nas gravações de setor, no status e no e-mail do relatório). O trecho do Apps Script que exige o token em toda entrada, com falha fechada, está em `robo/apps_script_guarda_token.gs` — publicar junto com o robô novo. Resumo:

O script não está no repositório. Em **toda** ação do `doPost`/`doGet`, exija o token e falhe fechado:

```javascript
function tokenValido_(token) {
  var esperado = PropertiesService.getScriptProperties().getProperty('TOKEN_ROBO');
  return !!esperado && token === esperado; // sem TOKEN_ROBO definido => nega tudo
}
// no início de doPost: if (!tokenValido_(dados.token)) return saida_({status:'error', erro:'não autorizado'});
```

## 7. Documentos do Drive já enviados

Link público antigo continua funcionando até você rodar `scripts/revogar-permissao-publica-drive.mjs` (dry-run por padrão). Depois de revogar, só abrem pelo sistema os documentos novos/reenviados.

## 8. Incidente e checklist trimestral

Rascunho — será completado na entrega final (Fase 2/3): rotacionar segredos, revogar sessões, restaurar backup, revisar usuários ativos e perfis, rodar `npm audit` e `npm run test:rules`.
