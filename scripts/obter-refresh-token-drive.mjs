#!/usr/bin/env node
/**
 * Rode isso UMA ÚNICA VEZ, na sua máquina (nunca no GitHub Actions), pra
 * gerar o refresh token que o backup usa pra gravar no Google Drive
 * pessoal — ver o motivo em backup-firestore-drive.mjs (contas de
 * serviço não têm cota de armazenamento própria fora de Drives
 * Compartilhados).
 *
 * Pré-requisito: um OAuth Client ID do tipo "Desktop app", criado em
 * Google Cloud Console > APIs e serviços > Credenciais, no mesmo
 * projeto do Firebase.
 *
 * Uso:
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *     node scripts/obter-refresh-token-drive.mjs
 *
 * O script abre um servidorzinho local só pra capturar o retorno do
 * Google depois que você autoriza no navegador; imprime o refresh token
 * no terminal e encerra sozinho.
 */
import http from 'http';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PORTA = 53682;
const REDIRECT_URI = `http://localhost:${PORTA}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Defina GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET antes de rodar.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const urlAutorizacao = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n1. Abra esta URL no navegador, ENTRE COM A CONTA DO GOOGLE DRIVE que vai guardar os backups, e autorize:\n');
console.log(urlAutorizacao);
console.log('\n2. Aguardando você autorizar no navegador...\n');

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);
    const codigo = url.searchParams.get('code');
    if (!codigo) {
      res.end('Nenhum código recebido nessa chamada. Pode fechar esta aba.');
      return;
    }

    res.end('Autorizado! Pode fechar esta aba e voltar ao terminal.');
    servidor.close();

    const { tokens } = await oauth2Client.getToken(codigo);
    if (!tokens.refresh_token) {
      console.error(
        '\nO Google não devolveu um refresh token — provavelmente essa conta já autorizou esse ' +
          'mesmo app antes. Revogue o acesso em myaccount.google.com/permissions e rode de novo.',
      );
      process.exit(1);
    }

    console.log('\nGuarde este valor com segurança — é o secret GOOGLE_OAUTH_REFRESH_TOKEN no GitHub:\n');
    console.log(tokens.refresh_token);
    console.log('');
    process.exit(0);
  } catch (erro) {
    console.error('\nErro ao trocar o código pelo token:', erro);
    res.end('Erro — veja o terminal.');
    servidor.close();
    process.exit(1);
  }
});

servidor.listen(PORTA);
