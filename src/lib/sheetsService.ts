/**
 * Escrita na planilha de controle de processos via API do Google Sheets,
 * usando o access token OAuth do usuário (mesmo fluxo já usado para o
 * Google Drive, em googleAuth.ts) — precisa que a conta autenticada
 * tenha permissão de edição na planilha.
 */

/**
 * Insere uma linha ao final da primeira aba da planilha (a API do Sheets
 * já resolve "depois da última linha com dados", que é o que se quer ao
 * inserir "na última linha em branco").
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  valores: string[],
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [valores] }),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(
      dados?.error?.message || 'Não foi possível gravar na planilha (verifique a permissão de edição).',
    );
  }
}
