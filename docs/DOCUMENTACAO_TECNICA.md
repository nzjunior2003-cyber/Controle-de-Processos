# Documentação Técnica — Sistema de Controle de Processos (CBMPA)

> Documento elaborado para atender ao Capítulo 11 (Documentação, Conhecimento e
> Capacitação) da Política Institucional de Desenvolvimento de Sistemas
> (PIDS/DTIC), como parte do processo de acolhimento do sistema previsto no
> Capítulo 14. Complementa, sem substituir, o [`README.md`](../README.md), que
> mantém o passo a passo de instalação/execução local.

## 1. Identificação e finalidade

| Item | Descrição |
| --- | --- |
| Nome do sistema | Sistema de Controle de Processos — CBMPA |
| Unidade demandante | Setor de Gestão/Fiscalização de Contratos do CBMPA |
| Origem | Iniciativa setorial (não desenvolvido pela DTIC) — sujeito ao Capítulo 14 da PIDS |
| Finalidade | Tramitação de processos administrativos de aquisição, acompanhamento do PCA, e gestão/fiscalização de contratos, atas de registro de preços e partícipes |
| Público-alvo | Gestores de contratos, fiscais titulares/suplentes, setor de aquisições/apoio, administradores (master) |
| Ambiente | Produção única, hospedada em VPS própria (Docker), sem ambiente de homologação separado |

## 2. Perfis de acesso e permissões

Definidos em `src/types.ts` (`Perfil`) e aplicados tanto na interface quanto nas
regras de segurança do Firestore (`firestore.rules`):

| Perfil | Pode escrever em | Observações |
| --- | --- | --- |
| `master` | Todos os módulos, inclusive Usuários e Auditoria | Único perfil que aprova/edita contas de outros usuários |
| `gestao` | Gestão de Contratos (contratos, execuções, aditivos, ocorrências) | |
| `contratos` | Contratos e ARP's (procedimentos licitatórios, sancionatórios, portarias) | |
| `apoio` | Apoio e Suprimento (processos administrativos) | |
| `fiscal` | Só lançamentos (execuções/ocorrências) dos contratos em que é fiscal titular ou suplente | Vínculo automático por Matrícula (MF) ou, alternativamente, e-mail/nome |

Todos os perfis conseguem **navegar e visualizar** os módulos operacionais; a
escrita é que é restrita por perfil (verificação replicada na interface, por
usabilidade, e nas regras do Firestore, que são a barreira efetiva de
segurança).

## 3. Arquitetura e tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19 + TypeScript 5 + Vite 6 + Tailwind CSS 4 + React Router 7 |
| Autenticação | Firebase Authentication (e-mail/senha), com fluxo próprio de primeiro acesso por matrícula (ver Seção 6) |
| Banco de dados | Cloud Firestore (tempo real, via `onSnapshot`) |
| Back-end | Express (`server.ts`) — serve o front e expõe rotas de e-mail e upload de documentos |
| Anexos de contrato | Google Drive API, conta institucional fixa (OAuth2 com refresh token), pasta "Documentos de Contratos" |
| Planilha institucional | Google Sheets espelhado automaticamente a cada contrato criado/editado |
| PWA | Instalável, `registerType: autoUpdate`, cache do app shell (não dos dados) |
| Testes / Qualidade | Vitest + Testing Library, ESLint, `tsc --noEmit`, GitHub Actions (CI) |
| Hospedagem | VPS própria, Docker Compose, nginx como proxy reverso com TLS (Let's Encrypt) |

Não há separação entre ambiente de desenvolvimento, homologação e produção —
todo `push` para `main` que passa no CI é implantado diretamente em produção
(ver Seção 8).

## 4. Modelo de dados (coleções do Firestore)

| Coleção | Conteúdo |
| --- | --- |
| `usuarios` | Perfil funcional do usuário. Id do documento = UID do Firebase Auth. Campos: `nome`, `email`, `perfil`, `ativo`, `cargo`, `mf`, `nomeGuerra`, `ubm` |
| `matriculas` | Índice público matrícula → e-mail, usado no login/cadastro por MF (criação única, imutável) |
| `processos` | Processos administrativos (PAE) do módulo Apoio e Suprimento |
| `estadas_processo`, `movimentacoes` | Histórico de tramitação entre setores |
| `pcas` | Itens do Plano de Contratações Anual, importados de planilha pública |
| `alertas`, `pareceres` | Alertas e pareceres dos processos |
| `contratos` | Entidade única de contrato, compartilhada pelos módulos Contratos e ARP's, Gestão de Contratos e Fiscal do Contrato |
| `execucoes` | Lançamentos financeiros/de quantidade sobre um contrato (NF/Fatura, Recibo de Pagamento, Recebimento da NE) |
| `aditivos` | Aditivos financeiros, de prazo e de quantidade, aplicados a um contrato |
| `ocorrencias` | Registros de ocorrências/esclarecimentos sobre um contrato |
| `procedimentos` | Pregões, inexigibilidades, dispensas, adesões e partícipes de ARP |
| `sancionatorios` | Processos sancionatórios contra fornecedores |
| `portarias` | Portarias de nomeação de fiscais |
| `logs_acesso` | Tentativas de login (sucesso/falha) |
| `logs_auditoria` | Trilha de auditoria de criações/edições/exclusões (ver Seção 7) |

Os setores do fluxo de processos (DEM, DF/FEBOM, GCG, SEPLAD, GTAF, CONJUR,
DCA) são configuração estática em `src/context/AppContext.tsx`, não uma
coleção própria.

**Não há integração com o SI3.** Dados de militares (nome, matrícula, cargo)
usados para vincular fiscais a contratos vêm de uma planilha pública do Google
Sheets ("Militares e Matrícula BM"), mantida fora do sistema. Isso está
registrado como exceção formal em
[`EXCECOES_CONFORMIDADE_PIDS.md`](./EXCECOES_CONFORMIDADE_PIDS.md).

## 5. Integrações externas

| Integração | Finalidade | Autenticação |
| --- | --- | --- |
| Google Drive | Upload/armazenamento de PDFs de contrato, nota de empenho e comprovantes de execução | OAuth2 (conta institucional fixa, refresh token em variável de ambiente) |
| Google Sheets (institucional) | Espelho automático dos dados de cada contrato, para consulta gerencial fora do sistema | Mesma credencial OAuth2 do Drive |
| Google Sheets (públicas) | Leitura do PCA e da planilha de efetivo/matrícula de militares (fonte de dados, não escrita) | Nenhuma — exportação pública em CSV (`gviz/tq`) |
| SMTP (Gmail) | Envio de e-mails de alerta de vencimento de contrato (Painel de Alertas) e do alerta diário automatizado | Usuário/senha de aplicativo, em variável de ambiente |
| Firebase Authentication | Autenticação de usuários | Isolado por projeto Firebase |

Nenhuma dessas integrações usa Keycloak ou SI3 — ver
[`EXCECOES_CONFORMIDADE_PIDS.md`](./EXCECOES_CONFORMIDADE_PIDS.md).

## 6. Autenticação e controle de acesso

- Autenticação via **Firebase Authentication** (e-mail/senha), não via
  Keycloak.
- Primeiro acesso pode ser feito por **matrícula (MF)**: o sistema busca a
  matrícula na planilha pública de efetivo; se encontrada, pré-preenche nome e
  cargo e o usuário completa cadastro (Nome de Guerra, UBM, e-mail, senha); se
  não encontrada, o usuário preenche manualmente e aguarda aprovação do
  master.
- Contas novas nascem com `ativo: false` — só entram no sistema após um master
  aprová-las na tela "Usuários".
- Vínculo automático de contratos ao fiscal correto é feito preferencialmente
  pela matrícula (`fiscalTitularMf`/`fiscalSuplenteMf`), com fallback por
  e-mail/nome para contratos legados sem matrícula cadastrada.
- Autorização por perfil é aplicada tanto na interface (conveniência) quanto
  nas regras do Firestore (`firestore.rules`), que são a barreira efetiva.

## 7. Auditoria e rastreabilidade

- Toda criação, edição e exclusão de: processos, usuários, contratos,
  execuções, ocorrências, aditivos, procedimentos licitatórios,
  sancionatórios e portarias é registrada na coleção `logs_auditoria`, com
  usuário responsável, data/hora, ação, coleção/documento afetado e um resumo
  dos campos alterados (antes → depois).
- Tentativas de login (sucesso e falha) são registradas em `logs_acesso`.
- Os logs são visíveis apenas a usuários com permissão de auditoria (tela
  "Auditoria", restrita a `master`).
- **Não implementado:** autenticação multifator; política formal de retenção
  de logs (hoje não há expurgo automático — os logs se acumulam
  indefinidamente no Firestore).

## 8. Implantação, backup e continuidade

- **CI/CD**: todo `push` para `main` roda `tsc --noEmit`, ESLint, Vitest e
  `vite build` (workflow [`ci.yml`](../.github/workflows/ci.yml)); se tudo
  passar, o job de deploy conecta via SSH na VPS, faz `git pull` e
  `docker compose up -d --build`.
- **Não há ambiente de homologação** — a implantação vai direto para
  produção após o CI passar. Não há também janela de manutenção formal nem
  plano de reversão automatizado (reversão hoje seria manual, via
  `git revert` + novo deploy).
- **Backup diário automatizado** ([`backup-firestore.yml`](../.github/workflows/backup-firestore.yml)):
  exporta todas as coleções do Firestore e envia para uma pasta no Google
  Drive, via `scripts/backup-firestore-drive.mjs`.
- **Alertas automáticos diários** ([`alertas-contratos.yml`](../.github/workflows/alertas-contratos.yml)):
  envia e-mail aos fiscais de contratos próximos do vencimento
  (`scripts/enviar-alertas-contratos.ts`).
- **Monitoramento**: não há ferramenta de monitoramento de disponibilidade ou
  de erros em produção (ex.: Sentry, Uptime Robot) — falhas só são percebidas
  por relato de usuário.

## 9. Funcionalidades principais, por módulo

| Módulo | Funcionalidades |
| --- | --- |
| Apoio e Suprimento | Cadastro e tramitação de processos administrativos entre setores |
| Contratos e ARP's | Listagem de contratos (com fornecedor, objeto, vigência), controle de ARP's e partícipes |
| Gestão de Contratos | Cadastro/edição de contratos, aditivos, painel de alertas de vencimento, sincronização com planilha oficial e institucional, diretório de fiscais |
| Fiscal do Contrato | Contratos sob responsabilidade do fiscal logado, lançamento de execuções financeiras (NF/Fatura, Recibo de Pagamento, Recebimento da NE), registro de ocorrências, geração de relatório de auditoria em PDF |
| Usuários (master) | Aprovação/edição/inativação de contas, atribuição de perfil e matrícula |
| Auditoria (master) | Consulta das trilhas de auditoria e dos logs de acesso |

## 10. Manual do usuário

O manual de acesso e uso para o perfil Fiscal do Contrato foi produzido em
formato de uma folha, pronto para distribuição em grupo, e deve ser mantido
atualizado a cada mudança relevante de fluxo. (Arquivo entregue à parte —
recomenda-se anexá-lo neste diretório como `docs/manual_fiscal_do_contrato.pdf`
para referência futura.)

## 11. Histórico de versões

O histórico completo de alterações do sistema está no histórico de commits do
repositório Git (mensagens de commit descrevem cada mudança e seu motivo).
Não há, até o momento, um changelog institucional resumido — pode ser criado
como evolução futura desta documentação.

## 12. Responsáveis

| Papel | Responsável |
| --- | --- |
| Gestor de negócio / unidade demandante | Gestor de Contratos do CBMPA |
| Responsável técnico | A definir formalmente junto à DTIC no processo de acolhimento (Capítulo 14 da PIDS) |
