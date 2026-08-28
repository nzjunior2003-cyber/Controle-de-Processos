# Sistema de Controle de Processos — CBMPA

Aplicação web do **Corpo de Bombeiros Militar do Pará** para acompanhamento de
processos administrativos de aquisição e da gestão de contratos: tramitação por
setor, integração com o PCA (Plano de Contratações Anual), controle de
pregões/dispensas/inexigibilidades/adesões, portarias de fiscais, vigência e
execução financeira dos contratos.

## Sumário

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Configuração do Firebase (passo a passo manual)](#configuração-do-firebase-passo-a-passo-manual)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar](#como-rodar)
- [Scripts](#scripts)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Modelo de dados (Firestore)](#modelo-de-dados-firestore)
- [Perfis de acesso](#perfis-de-acesso)
- [Segurança](#segurança)

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + React Router 7 |
| Autenticação | Firebase Authentication (e-mail/senha) |
| Banco de dados | Cloud Firestore (tempo real via `onSnapshot`) |
| Back-end | Express (`server.ts`) — serve o front e expõe `/api/health` e `/api/send-email` |
| Anexos | Google Drive API (Google Sign-In separado, escopo `drive.file`) |
| Importações | Planilhas públicas do Google Sheets (PCA e efetivo de militares) via CSV |
| Testes / Qualidade | Vitest + Testing Library, ESLint (flat config), `tsc --noEmit`, GitHub Actions |

O `server.ts` mantém a rota `POST /api/send-email` (nodemailer) porque ela ainda é
usada pelo **Painel de Alertas** de contratos (`src/components/AlertasModal.tsx`).
Sem as variáveis `SMTP_*` configuradas, o envio é apenas simulado (log no
servidor). A recuperação de senha **não** usa essa rota — ela é feita pelo
próprio Firebase Authentication (link seguro por e-mail).

## Pré-requisitos

- Node.js 20 ou superior (e npm)
- Um projeto no [Firebase Console](https://console.firebase.google.com/)

## Configuração do Firebase (passo a passo manual)

> **Importante:** estes passos **precisam ser executados manualmente** por um
> administrador no Firebase Console. Enquanto não forem feitos, a aplicação abre
> normalmente, mostra um aviso na tela de login e **não persiste nada**.

1. **Criar/selecionar o projeto** em <https://console.firebase.google.com/>.
2. **Ativar Authentication**: menu *Build → Authentication → Get started →
   Sign-in method* e habilite o provedor **E-mail/senha**.
   - Opcional (para anexar arquivos ao Drive): habilite também o provedor
     **Google**.
3. **Ativar o Cloud Firestore**: menu *Build → Firestore Database → Create
   database*. Escolha a região (ex.: `southamerica-east1`) e comece em **modo de
   produção** — as regras corretas estão em [`firestore.rules`](firestore.rules).
4. **Copiar as chaves do app web**: *Configurações do projeto → Seus apps →
   Web*. Copie os valores para um arquivo `.env` na raiz (veja
   [Variáveis de ambiente](#variáveis-de-ambiente)).
5. **Publicar as regras de segurança** (requer o Firebase CLI autenticado):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <ID-DO-PROJETO>
   firebase deploy --only firestore:rules
   ```

   Alternativa sem CLI: abrir *Firestore Database → Regras* no Console, colar o
   conteúdo de `firestore.rules` e publicar.
6. **Criar o primeiro usuário master** (não há usuários pré-cadastrados no
   código — o array mock foi removido):
   1. Rode a aplicação (`npm run dev`) e, na tela de login, use
      **"Solicitar Acesso"** para criar sua conta.
   2. No Firebase Console, abra *Firestore Database → coleção `usuarios`* e
      localize o documento cujo id é o UID da sua conta
      (*Authentication → Users* mostra o UID).
   3. Edite o documento e defina `perfil: "master"` e `ativo: true`.
   4. Faça login normalmente. A partir daí, novos pedidos de acesso podem ser
      aprovados pela própria tela **Administração de Usuários** do sistema.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Opcionalmente, para o disparo real de e-mails de alerta:

```
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=  SMTP_FROM=
```

O arquivo `.env` está no `.gitignore` e **nunca** deve ser versionado. O antigo
`firebase-applet-config.json` foi removido do repositório: as chaves agora vêm
apenas do ambiente.

## Como rodar

```bash
npm install
cp .env.example .env   # e preencha as chaves do Firebase
npm run dev            # http://localhost:3000
```

Para produção:

```bash
npm run build
npm start
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe o Express com o Vite em middleware (porta 3000) |
| `npm run build` | Build do front (`vite build`) + bundle do servidor (`esbuild`) |
| `npm start` | Executa o servidor já buildado (`dist/server.cjs`) |
| `npm run preview` | Preview do build do Vite |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint (flat config, TypeScript + react-hooks) |
| `npm test` | Testes com Vitest |
| `npm run test:watch` | Vitest em modo watch |

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda
`typecheck`, `lint`, `test` e `build` em cada push/PR.

## Estrutura de pastas

```
server.ts                     Express (API + serve o front)
firestore.rules               Regras de segurança do Firestore
src/
  context/AppContext.tsx      Estado global; leitura/escrita no Firestore
  lib/
    firebase.ts               Inicialização única de App/Auth/Firestore
    csv.ts                    Parsing do PCA (parseCurrencyBR, mapSheetRowToPca)
    contratos.ts              Regras de vigência/busca de contratos
    googleAuth.ts             Google Sign-In isolado (anexos no Drive)
    driveService.ts           Upload de arquivos para o Drive
  components/
    ui/FormField.tsx          Campo de formulário com rótulo + ícone
    contratos/                Tabela, KPIs e modal de execução compartilhados
  pages/
    contratos-arps/           Abas, tabelas e formulários de Contratos e ARPs
    gestao-contratos/         Módulo de Gestão de Contratos
    fiscal-contrato/          Módulo do Fiscal do Contrato
```

## Modelo de dados (Firestore)

| Coleção | Conteúdo |
| --- | --- |
| `usuarios` | Perfil do usuário. **O id do documento é o UID do Firebase Auth.** Campos: `nome`, `email`, `setor_id`, `perfil`, `ativo`, `cargo`. Nunca contém senha. |
| `processos` | Processos administrativos (PAE) |
| `movimentacoes` | Tramitações entre setores |
| `pcas` | Itens do PCA importados da planilha pública |
| `alertas`, `pareceres` | Alertas e pareceres dos processos |
| `contratos` | Entidade única de contrato, compartilhada por Contratos/ARPs, Gestão e Fiscal |
| `procedimentos` | Pregões, inexigibilidades, dispensas, adesões e partícipes |
| `sancionatorios` | Processos sancionatórios |
| `portarias` | Portarias de nomeação de fiscais |

Os setores do fluxo (DEM, DF/FEBOM, GCG, SEPLAD, GTAF, CONJUR, DCA) são
configuração estática em `src/context/AppContext.tsx`.

## Perfis de acesso

`master`, `contratos`, `apoio`, `gestao`, `fiscal` (rótulos em
`src/types.ts`). Somente `master` administra usuários; `contratos`/`gestao`
escrevem nos módulos de contratos; `fiscal` enxerga apenas os contratos sob sua
fiscalização.

## Segurança

- Autenticação é feita pelo Firebase Authentication. **Não há mais login mock,
  senha em texto plano nem "senha universal" no código.**
- O envio de senha por e-mail foi substituído pelo fluxo padrão
  `sendPasswordResetEmail` (link seguro, com expiração).
- Contas novas nascem com `ativo: false` e precisam ser aprovadas por um master.
- As permissões efetivas são aplicadas no servidor pelo `firestore.rules` — as
  checagens de perfil na interface são apenas conveniência de UX.
- Excluir um usuário na tela de administração remove o **perfil** (documento em
  `usuarios`). A conta no Firebase Authentication precisa ser removida pelo
  Console (o SDK do cliente não permite excluir contas de terceiros).
